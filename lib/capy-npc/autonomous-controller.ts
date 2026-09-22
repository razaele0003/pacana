import { useState, useEffect, useRef, useCallback } from "react";
import { CapyPose } from "../../components/capy-sprite";
import { playCompanionSound } from "../companion-sound";
import {
  Point,
  Rect,
  ViewportBounds,
  queryUIObstacles,
  WALL_MARGIN_X,
  WALL_MARGIN_Y,
  CAPPY_WIDTH,
  CAPPY_HEIGHT,
} from "./obstacle-manager";

export type CompanionMode =
  | "wander"
  | "walk_to_focus"
  | "focusing"
  | "walk_to_snack"
  | "eating"
  | "walk_home"
  | "resting"
  | "waking"
  | "dragged"
  | "planting"
  | "thinking"
  | "reading"
  | "curious"
  | "happy"
  | "shouting"
  | "idle";

export type CapyGoalType =
  | "wander"
  | "press_focus"
  | "eat_snack"
  | "go_home"
  | "plant"
  | "alarm"
  | "rest";

export type EmoteType =
  | "snack"
  | "happy"
  | "curious"
  | "excited"
  | "eating"
  | "thinking"
  | "reading"
  | "read"
  | "rest";

export interface ActiveEmote {
  type: EmoteType;
  id: string;
  duration: number;
}

export type LeafStage = "sprouting" | "growing" | "ready";

export interface SpawnedLeaf {
  id: string;
  x: number;
  y: number;
  createdAt: number;
  stage: LeafStage;
  treeStage?: number;
  isBeingEaten: boolean;
}

export interface UseAutonomousCapyOptions {
  enabled: boolean;
  initialPos?: Point;
  onPosChange?: (pos: Point) => void;
  walkSpeed?: number;
  isFullScreen?: boolean;
}

export function useAutonomousCapy({
  enabled,
  initialPos,
  onPosChange,
  walkSpeed = 50,
  isFullScreen = false,
}: UseAutonomousCapyOptions) {
  const [pos, setPos] = useState<Point>(() => initialPos || { x: 500, y: 400 });
  const [facing, setFacing] = useState<"left" | "right">(() => {
    const initX = initialPos?.x ?? 500;
    const vpW = typeof window !== "undefined" ? window.innerWidth : 1200;
    return initX > vpW * 0.5 ? "left" : "right";
  });
  const [pose, setPose] = useState<CapyPose>("walk");
  const [mode, setMode] = useState<CompanionMode>("wander");
  const [activeLeaf, setActiveLeaf] = useState<SpawnedLeaf | null>(null);
  const [activeEmote, setActiveEmote] = useState<ActiveEmote | null>(null);
  const [showHearts, setShowHearts] = useState(false);
  const [landingBounce, setLandingBounce] = useState(false);

  // References for continuous animation loop & goal system
  const posRef = useRef<Point>(pos);
  posRef.current = pos;

  const modeRef = useRef<CompanionMode>(mode);
  modeRef.current = mode;

  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMovedPosRef = useRef<Point>({ x: 0, y: 0 });
  const stalledFramesCountRef = useRef<number>(0);
  const lastMovementOrActionTimeRef = useRef<number>(0);
  const resumeGoalRef = useRef<() => void>(() => {});

  const currentGoalRef = useRef<CapyGoalType>("wander");
  const interruptedGoalRef = useRef<CapyGoalType | null>(null);
  const temporaryActionRef = useRef<"happy" | "curious" | "reading" | "resting" | "planting" | "microphone" | null>(null);
  const isEmoteActiveRef = useRef<boolean>(false);
  const pausedWaypointsRef = useRef<Point[]>([]);
  const treeGrowthTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dynamicTargetRef = useRef<Point | HTMLElement | string | (() => Point | null) | null>(null);

  const resolveTargetPoint = useCallback(
    (t: Point | HTMLElement | string | (() => Point | null) | null): Point | null => {
      if (!t) return null;
      if (typeof t === "function") {
        return t();
      }
      if (typeof t === "object" && "x" in t && "y" in t) {
        return t;
      }
      const el =
        typeof t === "string"
          ? (document.querySelector(t) as HTMLElement | null)
          : (t as HTMLElement | null);
      if (!el) return null;
      const cr = el.getBoundingClientRect();
      return {
        x: Math.max(8, cr.left + (cr.width - 76) / 2),
        y: Math.max(8, cr.top + (cr.height - 76) / 2),
      };
    },
    []
  );

  const changeMode = useCallback((newMode: CompanionMode) => {
    modeRef.current = newMode;
    setMode(newMode);

    if (newMode !== "walk_home" && newMode !== "eating") {
      dynamicTargetRef.current = null;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pacana:cappy-status", {
          detail: { mode: newMode, goal: currentGoalRef.current },
        })
      );
    }

    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = null;
    }

    // Safety fallback timeouts: guarantee Capy never gets permanently stuck in transient modes
    if (newMode === "eating") {
      actionTimeoutRef.current = setTimeout(() => {
        actionTimeoutRef.current = null;
        if (modeRef.current === "eating") {
          setActiveLeaf(null);
          currentGoalRef.current = "wander";
          resumeGoalRef.current();
        }
      }, 2500);
    } else if (newMode === "focusing") {
      actionTimeoutRef.current = setTimeout(() => {
        actionTimeoutRef.current = null;
        if (modeRef.current === "focusing") {
          currentGoalRef.current = "wander";
          resumeGoalRef.current();
        }
      }, 2500);
    } else if (
      newMode === "reading" ||
      newMode === "thinking" ||
      newMode === "curious" ||
      newMode === "happy"
    ) {
      actionTimeoutRef.current = setTimeout(() => {
        actionTimeoutRef.current = null;
        if (modeRef.current === newMode) {
          isEmoteActiveRef.current = false;
          temporaryActionRef.current = null;
          resumeGoalRef.current();
        }
      }, 3500);
    } else if (newMode === "waking") {
      actionTimeoutRef.current = setTimeout(() => {
        actionTimeoutRef.current = null;
        if (modeRef.current === "waking") {
          isEmoteActiveRef.current = false;
          temporaryActionRef.current = null;
          resumeGoalRef.current();
        }
      }, 2500);
    }
  }, []);

  const activeLeafRef = useRef<SpawnedLeaf | null>(activeLeaf);
  activeLeafRef.current = activeLeaf;

  const targetButtonElRef = useRef<HTMLElement | null>(null);
  const targetPosRef = useRef<Point | null>(null);
  const onFocusCompleteRef = useRef<(() => void) | null>(null);

  const waypointsRef = useRef<Point[]>([]);
  const obstaclesRef = useRef<Rect[]>([]);
  const viewportRef = useRef<ViewportBounds>({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  const lastFrameTimeRef = useRef<number>(0);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const emoteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const planNextWanderRef = useRef<() => void>(() => {});
  const onArrivedRef = useRef<(() => void) | null>(null);
  const wanderStepCountRef = useRef(0);

  // Synchronize cached UI obstacles
  const refreshObstacles = useCallback(() => {
    if (typeof window === "undefined") return;
    const { obstacles, viewport } = queryUIObstacles();
    obstaclesRef.current = obstacles;
    viewportRef.current = viewport;
  }, []);

  // Temporary Emote Trigger (~0.8 - 2.4s) - stationary world position, preserves persistent goal!
  // Ignores duplicate clicks while an emote is playing.
  const triggerEmote = useCallback(
    (type: EmoteType, duration = 1100) => {
      if (
        isDraggingRef.current ||
        (isEmoteActiveRef.current && modeRef.current !== "resting") ||
        modeRef.current === "planting" ||
        modeRef.current === "eating"
      ) {
        return;
      }

      // If Cappy is resting, clicking an action emoji disturbs/wakes him up to perform the action!
      if (modeRef.current === "resting" || currentGoalRef.current === "rest") {
        if (sleepTimerRef.current) {
          clearTimeout(sleepTimerRef.current);
          sleepTimerRef.current = null;
        }
        if (!activeLeafRef.current || activeLeafRef.current.isBeingEaten) {
          currentGoalRef.current = "wander";
        }
      }

      isEmoteActiveRef.current = true;
      temporaryActionRef.current =
        type === "curious"
          ? "curious"
          : type === "happy"
          ? "happy"
          : type === "reading" || type === "read"
          ? "reading"
          : "happy";

      if (emoteTimerRef.current) {
        clearTimeout(emoteTimerRef.current);
        emoteTimerRef.current = null;
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      // Temporarily pause waypoints without destroying persistent goal
      if (waypointsRef.current.length > 0 && pausedWaypointsRef.current.length === 0) {
        pausedWaypointsRef.current = [...waypointsRef.current];
        waypointsRef.current = [];
      }

      const emoteDuration =
        type === "curious"
          ? 1000 // ~0.8-1.2s per user specs
          : type === "happy"
          ? 1100 // ~1.0-1.5s
          : type === "reading" || type === "read"
          ? 1800
          : duration;

      if (type === "curious") {
        setPose("curious");
        changeMode("curious");
        setActiveEmote(null);
      } else if (type === "reading" || type === "read") {
        setPose("read");
        changeMode("reading");
        setActiveEmote({
          type: "reading",
          id: `emote-${Date.now()}-${Math.random()}`,
          duration: emoteDuration,
        });
      } else if (type === "happy") {
        setPose("happy");
        changeMode("happy");
        setShowHearts(true);
        setActiveEmote(null);
        playCompanionSound("pet");
      } else if (type === "thinking") {
        setPose("thinking");
        changeMode("thinking");
        setActiveEmote({
          type: "thinking",
          id: `emote-${Date.now()}-${Math.random()}`,
          duration: emoteDuration,
        });
      } else if (type === "excited" || type === "snack") {
        setPose("happy");
        changeMode("happy");
        setActiveEmote(null);
        playCompanionSound("pet");
      }

      emoteTimerRef.current = setTimeout(() => {
        emoteTimerRef.current = null;
        isEmoteActiveRef.current = false;
        temporaryActionRef.current = null;
        setActiveEmote(null);
        setShowHearts(false);

        // Resume persistent goal (e.g. eating tree snack) or return to wander
        resumeGoalRef.current();
      }, emoteDuration);
    },
    [changeMode]
  );

  // Plan next continuous wander path
  const planNextWander = useCallback(
    (forcedSide?: "left" | "right") => {
      if (
        !enabled ||
        isDraggingRef.current ||
        modeRef.current === "walk_to_snack" ||
        modeRef.current === "walk_to_focus" ||
        modeRef.current === "focusing" ||
        modeRef.current === "eating" ||
        modeRef.current === "planting" ||
        modeRef.current === "resting"
      ) {
        return;
      }

      refreshObstacles();
      const vp = viewportRef.current;
      const current = posRef.current;

      // Bias destination: if on right half, walk left towards the room; if on left half, walk right
      const preferredSide: "left" | "right" | undefined =
        forcedSide ??
        (current.x > vp.width * 0.55
          ? "left"
          : current.x < vp.width * 0.42
          ? "right"
          : undefined);

      // Pick a random destination in available screen space without obstacle restrictions
      const minX = 32;
      const maxX = Math.max(minX + 50, vp.width - 80);
      const minY = 48;
      const maxY = Math.max(minY + 50, vp.height - 90);

      let targetX: number;
      if (preferredSide === "left") {
        targetX = minX + Math.random() * (Math.max(minX + 50, vp.width * 0.45) - minX);
      } else if (preferredSide === "right") {
        const startX = Math.min(maxX - 50, vp.width * 0.55);
        targetX = startX + Math.random() * (maxX - startX);
      } else {
        targetX = minX + Math.random() * (maxX - minX);
      }
      const targetY = minY + Math.random() * (maxY - minY);
      const target: Point = {
        x: Math.round(Math.max(minX, Math.min(maxX, targetX))),
        y: Math.round(Math.max(minY, Math.min(maxY, targetY))),
      };

      // Direct straight path to destination (no obstacle blocking)
      const path: Point[] = [target];

      waypointsRef.current = path;
      currentGoalRef.current = "wander";
      changeMode("wander");
      setPose("walk");

      if (path.length > 0) {
        const nextDx = path[0].x - current.x;
        if (Math.abs(nextDx) > 0.5) {
          setFacing(nextDx > 0 ? "right" : "left");
        }
      }
    },
    [enabled, refreshObstacles, changeMode]
  );

  planNextWanderRef.current = planNextWander;

  // Route towards a fully grown / ready leaf
  const startApproachingReadyLeaf = useCallback(
    (leaf: SpawnedLeaf) => {
      if (
        isDraggingRef.current ||
        modeRef.current === "eating"
      ) {
        return;
      }

      if (modeRef.current === "resting") {
        interruptedGoalRef.current = "eat_snack";
        changeMode("waking");
        setPose("stretch");
        playCompanionSound("pet");
        return;
      }

      if (
        modeRef.current === "reading" ||
        modeRef.current === "thinking" ||
        modeRef.current === "curious" ||
        modeRef.current === "happy"
      ) {
        setActiveEmote(null);
        setShowHearts(false);
        if (emoteTimerRef.current) {
          clearTimeout(emoteTimerRef.current);
          emoteTimerRef.current = null;
        }
        if (transitionTimerRef.current) {
          clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = null;
        }
      }

      refreshObstacles();
      const currentPos = posRef.current;

      // If Capy is already within eating distance (36px) of the tree, start eating immediately!
      const distToTree = Math.hypot(leaf.x - currentPos.x, leaf.y - currentPos.y);
      if (distToTree <= 36) {
        if (leaf.x !== currentPos.x) {
          setFacing(leaf.x > currentPos.x ? "right" : "left");
        }
        waypointsRef.current = [];
        currentGoalRef.current = "eat_snack";
        setActiveLeaf((curr) => {
          const ready = curr ? { ...curr, stage: "ready" as const, treeStage: 10 } : null;
          activeLeafRef.current = ready;
          return ready;
        });
        changeMode("eating");
        setPose("eating");
        return;
      }

      const path: Point[] = [{ x: leaf.x, y: leaf.y }];

      if (path.length > 0) {
        const first = path[0];
        if (first.x !== currentPos.x) {
          setFacing(first.x > currentPos.x ? "right" : "left");
        }
      }

      // Immediately set path and walk towards the tree snack
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      waypointsRef.current = path;
      currentGoalRef.current = "eat_snack";
      changeMode("walk_to_snack");
      setPose("walk");
    },
    [refreshObstacles, changeMode]
  );

  // Steer autonomously to a specific point or dynamic target (e.g. walking home to the cushion/tree)
  const walkToPoint = useCallback(
    (
      target: Point | HTMLElement | string | (() => Point | null),
      onArrived?: () => void,
      targetElement?: HTMLElement | string | (() => Point | null)
    ) => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      setShowHearts(false);
      onArrivedRef.current = onArrived || null;

      refreshObstacles();
      const current = posRef.current;

      let initialPoint: Point | null = null;
      let dynamicTarget: Point | HTMLElement | string | (() => Point | null) | null = null;

      if (targetElement) {
        dynamicTarget = targetElement;
      }

      if (
        typeof target === "string" ||
        (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) ||
        typeof target === "function"
      ) {
        dynamicTarget = target;
        initialPoint = resolveTargetPoint(target);
      } else if (typeof target === "object" && target !== null && "x" in target && "y" in target) {
        initialPoint = target as Point;
      }

      if (!initialPoint) {
        initialPoint = current;
      }

      dynamicTargetRef.current = dynamicTarget;
      const path: Point[] = [initialPoint];

      waypointsRef.current = path;
      currentGoalRef.current = "go_home";
      changeMode("walk_home");
      setPose("walk");

      if (path.length > 0) {
        const nextDx = path[0].x - current.x;
        if (Math.abs(nextDx) > 0.5) {
          setFacing(nextDx > 0 ? "right" : "left");
        }
      }
    },
    [refreshObstacles, changeMode, resolveTargetPoint]
  );

  // Focus Button Interaction Sequence
  const startPressFocus = useCallback(
    (customTarget?: HTMLElement | string, onComplete?: () => void) => {
      if (isDraggingRef.current) return;

      // Wake up if resting
      if (modeRef.current === "resting") {
        changeMode("waking");
        setPose("stretch");
        interruptedGoalRef.current = "press_focus";
        return;
      }

      refreshObstacles();
      const vp = viewportRef.current;
      const current = posRef.current;

      // Locate target button (custom target, primary timer, or sidebar focus tab button)
      let btn: HTMLElement | null = null;
      if (customTarget) {
        if (typeof customTarget === "string") {
          btn = document.querySelector(customTarget) as HTMLElement | null;
        } else {
          btn = customTarget;
        }
      }
      if (!btn) {
        btn = (document.querySelector('[data-capybara-target="focus"]') ||
          document.querySelector('[data-capybara-target="nav-focus"]') ||
          document.querySelector('button[data-tab="Focus"]') ||
          document.querySelector(".fullscreen-actions button.primary") ||
          document.querySelector(".card button.primary") ||
          Array.from(document.querySelectorAll("button")).find(
            (b) =>
              b.offsetParent !== null &&
              /start focus|resume|start short break|start long break|pause/i.test(
                b.textContent || ""
              )
          )) as HTMLElement | null;
      }

      if (!btn) {
        // Fallback: if no focus button currently in DOM, wander
        planNextWander();
        return;
      }

      targetButtonElRef.current = btn;
      onFocusCompleteRef.current = onComplete || null;
      const rect = btn.getBoundingClientRect();

      // Position Cappy so his raised paw reaches the center of the target button
      // In focus-5.png, paw is at 13.4px from top of sprite, and 65px from left (when facing right)
      const targetX = Math.max(
        WALL_MARGIN_X,
        Math.min(vp.width - CAPPY_WIDTH - WALL_MARGIN_X, rect.left + Math.min(rect.width * 0.35, 36))
      );
      const targetY = Math.max(
        48,
        Math.min(vp.height - CAPPY_HEIGHT - WALL_MARGIN_Y, rect.top + rect.height * 0.5 - 14)
      );
      const targetPoint: Point = { x: targetX, y: targetY };
      targetPosRef.current = targetPoint;

      // Direct path to focus button (no obstacle blocking)
      const path: Point[] = [targetPoint];

      waypointsRef.current = path;
      currentGoalRef.current = "press_focus";
      changeMode("walk_to_focus");
      setPose("walk");

      playCompanionSound("pop");

      if (path.length > 0) {
        const nextDx = path[0].x - current.x;
        if (Math.abs(nextDx) > 0.5) {
          setFacing(nextDx > 0 ? "right" : "left");
        }
      }
    },
    [refreshObstacles, planNextWander, changeMode]
  );

  // Resume persistent goal: calculates path to current persistent goal target
  const resumeGoal = useCallback(() => {
    if (isDraggingRef.current) return;
    const goal = currentGoalRef.current;

    // 1. Persistent Goal: Eat snack tree (must persist through disturbances until eaten!)
    if (
      (goal === "eat_snack" || activeLeafRef.current) &&
      activeLeafRef.current &&
      !activeLeafRef.current.isBeingEaten
    ) {
      currentGoalRef.current = "eat_snack";
      startApproachingReadyLeaf(activeLeafRef.current);
      return;
    }

    // 2. Persistent Goal: Press focus button
    if (goal === "press_focus") {
      startPressFocus(
        targetButtonElRef.current || undefined,
        onFocusCompleteRef.current || undefined
      );
      return;
    }

    // 3. Persistent Goal: Go home to cushion
    if (goal === "go_home") {
      window.dispatchEvent(new CustomEvent("pacana:call-cappy-home"));
      return;
    }

    // 4. Persistent Goal: Rest
    if (goal === "rest") {
      changeMode("resting");
      setPose("sleep");
      return;
    }

    // 5. Normal continuous wander
    currentGoalRef.current = "wander";
    changeMode("wander");
    setPose("walk");
    waypointsRef.current = [];
    pausedWaypointsRef.current = [];
    planNextWander();
  }, [startApproachingReadyLeaf, startPressFocus, planNextWander, changeMode]);

  resumeGoalRef.current = resumeGoal;

  // Spawns a tree snack randomly on the page (Cappy does NOT plant it)
  // Cappy is shocked/surprised, then walks to the tree and eats it
  const spawnLeaf = useCallback(
    (customPoint?: Point) => {
      if (isDraggingRef.current) {
        return;
      }

      // If Cappy is resting, clicking leaves emoji disturbs/wakes him up!
      if (modeRef.current === "resting" || currentGoalRef.current === "rest") {
        if (sleepTimerRef.current) {
          clearTimeout(sleepTimerRef.current);
          sleepTimerRef.current = null;
        }
      }

      if (emoteTimerRef.current) {
        clearTimeout(emoteTimerRef.current);
        emoteTimerRef.current = null;
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      if (treeGrowthTimerRef.current) {
        clearInterval(treeGrowthTimerRef.current);
        treeGrowthTimerRef.current = null;
      }

      // Stop current wandering movement
      waypointsRef.current = [];
      pausedWaypointsRef.current = [];

      refreshObstacles();
      const vp = viewportRef.current;
      const cur = posRef.current;

      // Choose a random safe position across the page away from Cappy
      let treeX: number;
      let treeY: number;

      if (customPoint) {
        treeX = customPoint.x;
        treeY = customPoint.y;
      } else {
        const minX = 60;
        const maxX = Math.max(minX + 80, vp.width - 120);
        const minY = 80;
        const maxY = Math.max(minY + 80, vp.height - 140);

        treeX = minX + Math.random() * (maxX - minX);
        treeY = minY + Math.random() * (maxY - minY);

        // Try to pick a location at least 120px away from Cappy so he has space to react and walk
        for (let i = 0; i < 15; i++) {
          const candX = minX + Math.random() * (maxX - minX);
          const candY = minY + Math.random() * (maxY - minY);
          if (Math.hypot(candX - cur.x, candY - cur.y) >= 120) {
            treeX = candX;
            treeY = candY;
            break;
          }
        }
      }

      const leaf: SpawnedLeaf = {
        id: `leaf-${Date.now()}`,
        x: Math.round(treeX),
        y: Math.round(treeY),
        createdAt: Date.now(),
        stage: "sprouting",
        treeStage: 1,
        isBeingEaten: false,
      };

      setActiveLeaf(leaf);
      activeLeafRef.current = leaf;
      currentGoalRef.current = "eat_snack";

      // Rapid tree growth (10 stages, 150ms per stage)
      let stage = 1;
      treeGrowthTimerRef.current = setInterval(() => {
        stage += 1;
        if (stage >= 10) {
          if (treeGrowthTimerRef.current) {
            clearInterval(treeGrowthTimerRef.current);
            treeGrowthTimerRef.current = null;
          }
          setActiveLeaf((curr) => {
            if (curr && curr.id === leaf.id) {
              const updated: SpawnedLeaf = {
                ...curr,
                stage: "ready",
                treeStage: 10,
              };
              activeLeafRef.current = updated;
              return updated;
            }
            return curr;
          });
        } else {
          setActiveLeaf((curr) => {
            if (curr && curr.id === leaf.id) {
              const updated: SpawnedLeaf = {
                ...curr,
                stage: stage >= 6 ? "growing" : "sprouting",
                treeStage: stage,
              };
              activeLeafRef.current = updated;
              return updated;
            }
            return curr;
          });
        }
      }, 150);

      // Cappy reacts with shock / surprise!
      // Turn to face the newly appeared tree
      if (Math.abs(leaf.x - cur.x) > 4) {
        setFacing(leaf.x > cur.x ? "right" : "left");
      }
      isEmoteActiveRef.current = true;
      temporaryActionRef.current = "curious";
      changeMode("curious");
      setPose("curious");
      playCompanionSound("pop");

      // After shock reaction (~900ms), start walking to the tree to eat it!
      transitionTimerRef.current = setTimeout(() => {
        transitionTimerRef.current = null;
        isEmoteActiveRef.current = false;
        temporaryActionRef.current = null;
        if (activeLeafRef.current && !activeLeafRef.current.isBeingEaten) {
          startApproachingReadyLeaf(activeLeafRef.current);
        }
      }, 900);
    },
    [refreshObstacles, changeMode, startApproachingReadyLeaf]
  );

  const lastAlarmIdRef = useRef<string | null>(null);

  // Start shouting/microphone animation when timer completes (focus, short break, long break)
  const startShouting = useCallback(() => {
    if (isDraggingRef.current || modeRef.current === "shouting") return;

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (emoteTimerRef.current) {
      clearTimeout(emoteTimerRef.current);
      emoteTimerRef.current = null;
    }

    waypointsRef.current = [];
    currentGoalRef.current = "alarm";
    temporaryActionRef.current = "microphone";
    changeMode("shouting");
    setPose("shout");
  }, [changeMode]);

  // Rest & Waking System: stays sleeping until disturbed, then wakes and resumes goal or wanders
  const wakeUp = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    currentGoalRef.current = "wander";
    temporaryActionRef.current = null;
    isEmoteActiveRef.current = false;
    if (pausedWaypointsRef.current.length > 0) {
      waypointsRef.current = [...pausedWaypointsRef.current];
      pausedWaypointsRef.current = [];
    }

    changeMode("waking");
    setPose("stretch"); // 10-frame stretch wakeup from Stretch wakeup.png
    playCompanionSound("pet");

    // Stretch wakeup duration (~1.0s) then resume goal (e.g. tree snack) or wander!
    setTimeout(() => {
      if (modeRef.current === "waking") {
        isEmoteActiveRef.current = false;
        temporaryActionRef.current = null;
        resumeGoalRef.current();
      }
    }, 1000);
  }, [changeMode]);

  // Petting interaction (temporary reaction that DOES NOT cancel current goal!)
  const triggerPet = useCallback(() => {
    if (modeRef.current === "resting") {
      // Waking up
      wakeUp();
      return;
    }

    // Temporary happy reaction without canceling persistent goal!
    triggerEmote("happy", 1100);
  }, [wakeUp, triggerEmote]);

  const toggleSleep = useCallback(() => {
    if (
      modeRef.current === "resting" ||
      pose === "sleep" ||
      currentGoalRef.current === "rest"
    ) {
      // Clicking sleep/wake button while already resting wakes Cappy!
      wakeUp();
      return;
    }
    if (
      modeRef.current === "waking" ||
      isDraggingRef.current
    ) {
      // Ignore duplicate clicks while waking
      return;
    }

    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (emoteTimerRef.current) {
      clearTimeout(emoteTimerRef.current);
      emoteTimerRef.current = null;
    }

    isEmoteActiveRef.current = true;
    temporaryActionRef.current = "resting";
    currentGoalRef.current = "rest";

    // Pause current waypoints
    if (waypointsRef.current.length > 0 && pausedWaypointsRef.current.length === 0) {
      pausedWaypointsRef.current = [...waypointsRef.current];
      waypointsRef.current = [];
    }

    changeMode("resting");
    setPose("sleep"); // peaceful sleeping artwork from Sleeping.png (no Zzz)
    playCompanionSound("drop");

    // NO AUTO-WAKE TIMER: Cappy remains sleeping indefinitely until disturbed by drag, click, or other action emoji!
  }, [wakeUp, changeMode, pose]);

  // Frame callback from CapySprite (for precise button press timing)
  const onFrame = useCallback((frameIdx: number) => {
    if (modeRef.current === "focusing") {
      // Frame 5 is the exact moment Cappy reaches up and presses the button!
      if (frameIdx === 5) {
        if (targetButtonElRef.current) {
          targetButtonElRef.current.click();
          targetButtonElRef.current.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true })
          );
          playCompanionSound("pop");
        }
      }
    } else if (modeRef.current === "eating") {
      // Around frame 5-6, Cappy takes a bite! Show burst & crunch
      if (frameIdx === 5) {
        setActiveLeaf((curr) => (curr ? { ...curr, isBeingEaten: true } : null));
        playCompanionSound("snack");
        setTimeout(() => {
          setActiveLeaf(null);
          activeLeafRef.current = null;
          if (treeGrowthTimerRef.current) {
            clearInterval(treeGrowthTimerRef.current);
            treeGrowthTimerRef.current = null;
          }
        }, 350);
      }
    }
  }, []);

  // Animation complete callback from CapySprite
  const onAnimationComplete = useCallback(() => {
    if (modeRef.current === "focusing") {
      // Ensure button click is executed
      if (targetButtonElRef.current) {
        targetButtonElRef.current.click();
        targetButtonElRef.current.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
      }

      // Focus sequence completed (10 frames finished)
      if (onFocusCompleteRef.current) {
        const cb = onFocusCompleteRef.current;
        onFocusCompleteRef.current = null;
        cb();
        return;
      }

      // Satisfied reaction, then return to normal wandering
      currentGoalRef.current = "wander";
      setPose("happy");
      changeMode("happy");
      triggerEmote("happy", 900);
      playCompanionSound("pet");
    } else if (modeRef.current === "eating") {
      // Eating sequence completed (10 frames finished)
      setActiveLeaf(null);
      activeLeafRef.current = null;
      if (treeGrowthTimerRef.current) {
        clearInterval(treeGrowthTimerRef.current);
        treeGrowthTimerRef.current = null;
      }
      currentGoalRef.current = "wander";
      setPose("happy");
      changeMode("happy");
      triggerEmote("happy", 800);
      playCompanionSound("pet");
    } else if (modeRef.current === "planting") {
      // 8-frame planting animation completed
      // Spawn the tree snack and start its independent background growth
      const vp = viewportRef.current;
      const cur = posRef.current;
      const offsetX = facing === "right" ? 54 : -54;
      const plantX = Math.max(40, Math.min(vp.width - 40, cur.x + offsetX));
      const plantY = Math.max(48, Math.min(vp.height - 48, cur.y + 12));

      const leaf: SpawnedLeaf = {
        id: `leaf-${Date.now()}`,
        x: plantX,
        y: plantY,
        createdAt: Date.now(),
        stage: "sprouting",
        treeStage: 1,
        isBeingEaten: false,
      };

      setActiveLeaf(leaf);

      // Independent background tree growth (10 stages: 400ms per stage)
      // Cappy does NOT interact with it during growth or when ready!
      let step = 1;
      const growthInterval = setInterval(() => {
        step += 1;
        if (step >= 10) {
          clearInterval(growthInterval);
          setActiveLeaf((curr) => {
            if (curr && curr.id === leaf.id) {
              return {
                ...curr,
                stage: "ready",
                treeStage: 10,
              };
            }
            return curr;
          });
        } else {
          setActiveLeaf((curr) =>
            curr && curr.id === leaf.id
              ? {
                  ...curr,
                  stage: step >= 6 ? "growing" : "sprouting",
                  treeStage: step,
                }
              : curr
          );
        }
      }, 400);

      // Cappy celebrates planting briefly (~0.8s), then returns to normal wandering
      setPose("happy");
      changeMode("happy");
      setShowHearts(true);
      playCompanionSound("pet");

      setTimeout(() => {
        setShowHearts(false);
        isEmoteActiveRef.current = false;
        temporaryActionRef.current = null;
        currentGoalRef.current = "wander";
        changeMode("wander");
        setPose("walk");
        planNextWander();
      }, 800);
    } else if (
      modeRef.current === "waking" ||
      modeRef.current === "thinking" ||
      modeRef.current === "reading" ||
      modeRef.current === "curious" ||
      modeRef.current === "happy" ||
      pose === "curious"
    ) {
      if (emoteTimerRef.current) {
        clearTimeout(emoteTimerRef.current);
        emoteTimerRef.current = null;
      }
      isEmoteActiveRef.current = false;
      temporaryActionRef.current = null;
      setActiveEmote(null);
      setShowHearts(false);
      if (pausedWaypointsRef.current.length > 0) {
        waypointsRef.current = pausedWaypointsRef.current;
        pausedWaypointsRef.current = [];
      }
      resumeGoalRef.current();
    } else if (modeRef.current === "shouting") {
      // Microphone sequence finished (audio ended and Frame 7 played)
      temporaryActionRef.current = null;
      isEmoteActiveRef.current = false;
      currentGoalRef.current = "wander";
      changeMode("wander");
      setPose("walk");
      planNextWander();
    }
  }, [triggerEmote, changeMode, facing, pose, planNextWander]);

  // Trigger shouting animation when timer completes (focus, short break, long break)
  useEffect(() => {
    const handleTimerComplete = (e: Event) => {
      const ce = e as CustomEvent<{ timerId?: string }>;
      const timerId = ce.detail?.timerId || `alarm-${Date.now()}`;
      if (lastAlarmIdRef.current === timerId) return;
      lastAlarmIdRef.current = timerId;
      startShouting();
    };
    window.addEventListener("pacana:timer-complete", handleTimerComplete);
    return () => {
      window.removeEventListener("pacana:timer-complete", handleTimerComplete);
    };
  }, [startShouting]);

  // Viewport & Obstacle resize adapt
  useEffect(() => {
    if (typeof window === "undefined") return;

    refreshObstacles();

    const handleResize = () => {
      refreshObstacles();
      setPos((curr) => {
        const vp = viewportRef.current;
        const clientW =
          typeof document !== "undefined"
            ? document.documentElement.clientWidth || vp.width
            : vp.width;
        const clientH =
          typeof document !== "undefined"
            ? document.documentElement.clientHeight || vp.height
            : vp.height;
        const screenW = Math.min(vp.width, clientW);
        const screenH = Math.min(vp.height, clientH);
        const minX = 24;
        const maxX = Math.max(minX + 40, screenW - 88 - 24);
        const minY = 48;
        const maxY = Math.max(minY + 40, screenH - 88 - 20);

        const clamped: Point = {
          x: Math.max(minX, Math.min(maxX, curr.x)),
          y: Math.max(minY, Math.min(maxY, curr.y)),
        };
        posRef.current = clamped;
        return clamped;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [refreshObstacles]);

  // Adapt to fullscreen changes
  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;

    const adaptToFullscreen = () => {
      refreshObstacles();
      setPos((curr) => {
        const vp = viewportRef.current;
        const clientW =
          typeof document !== "undefined"
            ? document.documentElement.clientWidth || vp.width
            : vp.width;
        const clientH =
          typeof document !== "undefined"
            ? document.documentElement.clientHeight || vp.height
            : vp.height;
        const screenW = Math.min(vp.width, clientW);
        const screenH = Math.min(vp.height, clientH);
        const minX = 24;
        const maxX = Math.max(minX + 40, screenW - 88 - 24);
        const minY = 48;
        const maxY = Math.max(minY + 40, screenH - 88 - 20);

        const clamped: Point = {
          x: Math.max(minX, Math.min(maxX, curr.x)),
          y: Math.max(minY, Math.min(maxY, curr.y)),
        };
        posRef.current = clamped;
        return clamped;
      });

      if (modeRef.current === "wander") {
        planNextWander();
      }
    };

    adaptToFullscreen();
    const timer = setTimeout(adaptToFullscreen, 120);
    return () => clearTimeout(timer);
  }, [isFullScreen, enabled, refreshObstacles, planNextWander]);

  // Continuous movement loop (30 FPS)
  useEffect(() => {
    if (!enabled) return;

    let animFrameId: number;

    const tick = (time: number) => {
      const FRAME_INTERVAL = 1000 / 30; // 30 FPS pacing
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = time;
      }
      if (time - lastFrameTimeRef.current < FRAME_INTERVAL) {
        animFrameId = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min((time - lastFrameTimeRef.current) / 1000, 0.35);
      lastFrameTimeRef.current = time;

      const currentMode = modeRef.current;
      const vp = viewportRef.current;
      const clientW =
        typeof document !== "undefined"
          ? document.documentElement.clientWidth || vp.width
          : vp.width;
      const clientH =
        typeof document !== "undefined"
          ? document.documentElement.clientHeight || vp.height
          : vp.height;
      const screenW = Math.min(vp.width, clientW);
      const screenH = Math.min(vp.height, clientH);

      const minX = 24;
      const maxX = Math.max(minX + 40, screenW - 88 - 24);
      const minY = 48;
      const maxY = Math.max(minY + 40, screenH - 88 - 20);

      const cur = posRef.current;

      // Active Wall Collision & Reversal in Wander Mode:
      // If Cappy touches or reaches near a wall, immediately turn around and walk away into open space
      if (currentMode === "wander" && !isDraggingRef.current) {
        // Hitting Right Wall while facing or moving right
        if (
          cur.x >= maxX - 6 &&
          (facing === "right" ||
            (waypointsRef.current.length > 0 && waypointsRef.current[0].x >= cur.x))
        ) {
          const clamped: Point = {
            x: maxX,
            y: Math.max(minY, Math.min(maxY, cur.y)),
          };
          posRef.current = clamped;
          setPos(clamped);
          setFacing("left");
          waypointsRef.current = [];
          planNextWander("left");
          animFrameId = requestAnimationFrame(tick);
          return;
        }

        // Hitting Left Wall while facing or moving left
        if (
          cur.x <= minX + 6 &&
          (facing === "left" ||
            (waypointsRef.current.length > 0 && waypointsRef.current[0].x <= cur.x))
        ) {
          const clamped: Point = {
            x: minX,
            y: Math.max(minY, Math.min(maxY, cur.y)),
          };
          posRef.current = clamped;
          setPos(clamped);
          setFacing("right");
          waypointsRef.current = [];
          planNextWander("right");
          animFrameId = requestAnimationFrame(tick);
          return;
        }
      }

      const isWalkingMode =
        currentMode === "wander" ||
        currentMode === "walk_to_focus" ||
        currentMode === "walk_to_snack" ||
        currentMode === "walk_home";

      // Stalled movement detector:
      // If Capy is supposed to be walking but has moved less than 2px over 75 frames (~2.5s), handle or recover!
      if (isWalkingMode && !isDraggingRef.current) {
        const movedDist = Math.hypot(
          cur.x - lastMovedPosRef.current.x,
          cur.y - lastMovedPosRef.current.y
        );
        if (movedDist >= 1.5) {
          lastMovementOrActionTimeRef.current = time;
          lastMovedPosRef.current = { x: cur.x, y: cur.y };
          stalledFramesCountRef.current = 0;
        } else {
          stalledFramesCountRef.current++;
          if (stalledFramesCountRef.current >= 75) {
            stalledFramesCountRef.current = 0;
            if (currentMode === "walk_to_snack") {
              if (activeLeafRef.current && !activeLeafRef.current.isBeingEaten) {
                const distToLeaf = Math.hypot(
                  activeLeafRef.current.x - cur.x,
                  activeLeafRef.current.y - cur.y
                );
                if (distToLeaf <= 65) {
                  setActiveLeaf((curr) => {
                    const ready = curr ? { ...curr, stage: "ready" as const, treeStage: 10 } : null;
                    activeLeafRef.current = ready;
                    return ready;
                  });
                  changeMode("eating");
                  setPose("eating");
                } else {
                  startApproachingReadyLeaf(activeLeafRef.current);
                }
              } else {
                waypointsRef.current = [];
                currentGoalRef.current = "wander";
                changeMode("wander");
                setPose("walk");
                planNextWander();
              }
            } else if (currentMode === "walk_to_focus") {
              changeMode("focusing");
              setPose("focus");
            } else if (currentMode === "walk_home") {
              if (onArrivedRef.current) {
                const cb = onArrivedRef.current;
                onArrivedRef.current = null;
                cb();
              } else {
                waypointsRef.current = [];
                changeMode("wander");
                setPose("walk");
                planNextWander();
              }
            } else {
              waypointsRef.current = [];
              const preferredSide = cur.x > vp.width * 0.5 ? "left" : "right";
              planNextWander(preferredSide);
            }
          }
        }
      } else {
        lastMovedPosRef.current = { x: cur.x, y: cur.y };
        stalledFramesCountRef.current = 0;
      }

      if (
        isWalkingMode &&
        waypointsRef.current.length > 0 &&
        !isDraggingRef.current
      ) {
        // Dynamically pursue target (like cushion/tree) so Cappy follows it even when the user scrolls up or down
        if (dynamicTargetRef.current && currentMode === "walk_home") {
          const livePoint = resolveTargetPoint(dynamicTargetRef.current);
          if (livePoint) {
            waypointsRef.current = [livePoint];
          }
        }

        const nextTarget = waypointsRef.current[0];
        const targetX = Math.max(minX, Math.min(maxX, nextTarget.x));
        const targetY = Math.max(minY, Math.min(maxY, nextTarget.y));
        const dx = targetX - cur.x;
        const dy = targetY - cur.y;
        const dist = Math.hypot(dx, dy);

        // Turn facing direction smoothly based on movement vector
        if (Math.abs(dx) > 0.5) {
          setFacing(dx > 0 ? "right" : "left");
        } else if (waypointsRef.current.length > 1) {
          const futureDx = Math.max(minX, Math.min(maxX, waypointsRef.current[1].x)) - cur.x;
          if (Math.abs(futureDx) > 0.5) {
            setFacing(futureDx > 0 ? "right" : "left");
          }
        }

        const effectiveSpeed =
          currentMode === "walk_home" ||
          currentMode === "walk_to_focus" ||
          currentMode === "walk_to_snack"
            ? 160
            : walkSpeed;
        const stepDist = effectiveSpeed * dt;

        const arrivalThreshold =
          currentMode === "walk_to_snack" ? 32 : currentMode === "walk_to_focus" ? 20 : 12;

        // For walk_home, calculate actual distance to the target (even if target is scrolled outside viewport)
        // This prevents Cappy from prematurely finishing arrival if the target is currently scrolled off-screen
        const actualTargetDist =
          currentMode === "walk_home"
            ? Math.hypot(nextTarget.x - cur.x, nextTarget.y - cur.y)
            : dist;

        if (actualTargetDist <= Math.max(stepDist, arrivalThreshold)) {
          // Reached this waypoint
          const reached: Point = {
            x: targetX,
            y: targetY,
          };
          waypointsRef.current.shift();
          posRef.current = reached;
          setPos(reached);
          if (onPosChange) onPosChange(reached);

          // If there is another waypoint queued, face towards it
          if (waypointsRef.current.length > 0) {
            const nextWp = waypointsRef.current[0];
            const nextDx = Math.max(minX, Math.min(maxX, nextWp.x)) - reached.x;
            if (Math.abs(nextDx) > 0.5) {
              setFacing(nextDx > 0 ? "right" : "left");
            }
          }

          // If arrived at final destination
          if (waypointsRef.current.length === 0) {
            if (currentMode === "walk_home") {
              // Arrived at home cushion
              if (onArrivedRef.current) {
                const cb = onArrivedRef.current;
                onArrivedRef.current = null;
                cb();
              }
            } else if (currentMode === "walk_to_focus") {
              // Arrived at Focus button! Face button and start 10-frame Focus interaction
              if (targetButtonElRef.current) {
                const br = targetButtonElRef.current.getBoundingClientRect();
                setFacing(posRef.current.x < br.left + br.width / 2 ? "right" : "left");
              }
              changeMode("focusing");
              setPose("focus");
            } else if (currentMode === "walk_to_snack") {
              // Arrived at plant! Start 10-frame eating sequence from Eating.png
              setActiveLeaf((curr) => {
                const ready = curr ? { ...curr, stage: "ready" as const, treeStage: 10 } : null;
                activeLeafRef.current = ready;
                return ready;
              });
              changeMode("eating");
              setPose("eating");
            } else {
              // Reached regular wander waypoint
              wanderStepCountRef.current++;
              const stepCount = wanderStepCountRef.current;

              // Periodic autonomous idle variety every 4 wander waypoints:
              // Reading a book with 📖 emoji, cozy sleep nap with Zzz, wild tree sprouting, or thinking with 💭
              if (stepCount % 4 === 0) {
                const roll = Math.random();
                if (roll < 0.35) {
                  // 1. Read a book with 📖 reading emoji!
                  setPose("read");
                  changeMode("reading");
                  triggerEmote("reading", 2400);
                } else if (roll < 0.65) {
                  // 2. Cozy sleep nap with Zzz, then wake up and stretch!
                  setPose("sleep");
                  changeMode("resting");
                  if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
                  sleepTimerRef.current = setTimeout(() => {
                    sleepTimerRef.current = null;
                    if (modeRef.current === "resting" && currentGoalRef.current !== "rest") {
                      wakeUp();
                    }
                  }, 3200);
                } else if (roll < 0.85) {
                  // 3. Curious pause with ✨ curious emote!
                  setPose("curious");
                  changeMode("curious");
                  triggerEmote("curious", 1200);
                } else {
                  // 4. Thinking pause with 💭 emoji!
                  setPose("thinking");
                  changeMode("thinking");
                  triggerEmote("thinking", 1400);
                }
              } else {
                setPose("walk");
                transitionTimerRef.current = setTimeout(() => {
                  transitionTimerRef.current = null;
                  planNextWander();
                }, 220 + Math.random() * 220);
              }
            }
          }
        } else {
          // Step along path, strictly clamped within screen boundaries
          const moveX = Math.max(minX, Math.min(maxX, cur.x + (dx / dist) * stepDist));
          const moveY = Math.max(minY, Math.min(maxY, cur.y + (dy / dist) * stepDist));
          const nextPos: Point = { x: moveX, y: moveY };
          posRef.current = nextPos;
          setPos(nextPos);
          if (onPosChange) onPosChange(nextPos);
        }
      }

      // While eating at the tree, dynamically follow the tree if the user scrolls
      if (dynamicTargetRef.current && currentMode === "eating" && !isDraggingRef.current) {
        const livePoint = resolveTargetPoint(dynamicTargetRef.current);
        if (livePoint) {
          posRef.current = livePoint;
          setPos(livePoint);
          if (onPosChange) onPosChange(livePoint);
        }
      }

      // Safety watchdog 1: If in any walking/idle mode with no waypoints and no active timers, resume roaming
      if (
        (currentMode === "wander" ||
          currentMode === "idle" ||
          currentMode === "walk_to_snack" ||
          currentMode === "walk_to_focus" ||
          currentMode === "walk_home") &&
        waypointsRef.current.length === 0 &&
        !transitionTimerRef.current &&
        !emoteTimerRef.current &&
        !isDraggingRef.current
      ) {
        transitionTimerRef.current = setTimeout(() => {
          transitionTimerRef.current = null;
          if (
            (modeRef.current === "wander" ||
              modeRef.current === "idle" ||
              modeRef.current === "walk_to_snack" ||
              modeRef.current === "walk_to_focus" ||
              modeRef.current === "walk_home") &&
            !isDraggingRef.current
          ) {
            setPose("walk");
            changeMode("wander");
            planNextWander();
          }
        }, 400);
      }

      // Safety watchdog 2: Universal anti-freeze watchdog
      // Guarantees Cappy NEVER stays permanently stuck or frozen in ANY mode or position
      const timeSinceLastMove = time - (lastMovementOrActionTimeRef.current || time);
      const isUserResting = currentGoalRef.current === "rest";
      const isShouting = currentMode === "shouting";

      if (
        !isDraggingRef.current &&
        !isUserResting &&
        !isShouting &&
        lastMovementOrActionTimeRef.current > 0 &&
        timeSinceLastMove > 5000
      ) {
        lastMovementOrActionTimeRef.current = time;

        if (transitionTimerRef.current) {
          clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = null;
        }
        if (emoteTimerRef.current) {
          clearTimeout(emoteTimerRef.current);
          emoteTimerRef.current = null;
        }
        if (sleepTimerRef.current) {
          clearTimeout(sleepTimerRef.current);
          sleepTimerRef.current = null;
        }
        if (actionTimeoutRef.current) {
          clearTimeout(actionTimeoutRef.current);
          actionTimeoutRef.current = null;
        }

        isEmoteActiveRef.current = false;
        temporaryActionRef.current = null;
        setActiveEmote(null);
        setShowHearts(false);

        waypointsRef.current = [];
        pausedWaypointsRef.current = [];
        stalledFramesCountRef.current = 0;
        lastMovedPosRef.current = { x: cur.x, y: cur.y };
        currentGoalRef.current = "wander";
        changeMode("wander");
        setPose("walk");
        planNextWander();
      }

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
      lastFrameTimeRef.current = 0;
    };
  }, [enabled, walkSpeed, onPosChange, planNextWander, changeMode, triggerEmote, wakeUp]);

  // Initial wander kick-off
  useEffect(() => {
    if (!enabled) return;

    const startTimeout = setTimeout(() => {
      if (modeRef.current === "wander" || modeRef.current === "idle") {
        planNextWander();
      }
    }, 400);

    return () => {
      clearTimeout(startTimeout);
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      if (emoteTimerRef.current) {
        clearTimeout(emoteTimerRef.current);
        emoteTimerRef.current = null;
      }
      if (treeGrowthTimerRef.current) {
        clearInterval(treeGrowthTimerRef.current);
        treeGrowthTimerRef.current = null;
      }
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
        actionTimeoutRef.current = null;
      }
    };
  }, [enabled, planNextWander]);

  // Drag hooks
  const startDrag = useCallback((startClientPos: Point) => {
    isDraggingRef.current = true;
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    waypointsRef.current = [];
    pausedWaypointsRef.current = [];
    isEmoteActiveRef.current = false;
    temporaryActionRef.current = null;
    if (!activeLeafRef.current || activeLeafRef.current.isBeingEaten) {
      currentGoalRef.current = "wander";
    }
    changeMode("dragged");
    setPose("drag");
    setShowHearts(false);
    setActiveEmote(null);
  }, [changeMode]);

  const updateDrag = useCallback(
    (newPos: Point) => {
      if (!isDraggingRef.current) return;
      const vp = viewportRef.current;
      const clientW =
        typeof document !== "undefined"
          ? document.documentElement.clientWidth || vp.width
          : vp.width;
      const clientH =
        typeof document !== "undefined"
          ? document.documentElement.clientHeight || vp.height
          : vp.height;
      const screenW = Math.min(vp.width, clientW);
      const screenH = Math.min(vp.height, clientH);

      const minX = 24;
      const maxX = Math.max(minX + 40, screenW - 88 - 24);
      const minY = 48;
      const maxY = Math.max(minY + 40, screenH - 88 - 20);
      const clamped: Point = {
        x: Math.max(minX, Math.min(maxX, newPos.x)),
        y: Math.max(minY, Math.min(maxY, newPos.y)),
      };
      if (newPos.x !== posRef.current.x) {
        setFacing(newPos.x > posRef.current.x ? "right" : "left");
      }
      posRef.current = clamped;
      setPos(clamped);
      if (onPosChange) onPosChange(clamped);
    },
    [onPosChange]
  );

  const endDrag = useCallback(
    (wasDragging: boolean) => {
      isDraggingRef.current = false;
      if (wasDragging) {
        playCompanionSound("drop");
        setPose("idle");
        setLandingBounce(true);
        setTimeout(() => setLandingBounce(false), 450);

        transitionTimerRef.current = setTimeout(() => {
          transitionTimerRef.current = null;
          resumeGoalRef.current();
        }, 350);
      } else {
        if (modeRef.current === "resting") {
          wakeUp();
        } else {
          triggerPet();
        }
      }
    },
    [triggerPet, wakeUp, changeMode]
  );

  return {
    pos,
    setPos,
    facing,
    setFacing,
    pose,
    setPose,
    mode,
    setMode: changeMode,
    currentGoal: currentGoalRef.current,
    activeLeaf,
    activeEmote,
    triggerEmote,
    showHearts,
    showZzz: mode === "resting" || pose === "sleep",
    landingBounce,
    spawnLeaf,
    startApproachingReadyLeaf,
    startPressFocus,
    startShouting,
    triggerPet,
    toggleSleep,
    wakeUp,
    startDrag,
    updateDrag,
    endDrag,
    refreshObstacles,
    planNextWander,
    walkToPoint,
    onFrame,
    onAnimationComplete,
  };
}
