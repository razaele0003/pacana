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
  const resumeGoalRef = useRef<() => void>(() => {});

  const changeMode = useCallback((newMode: CompanionMode) => {
    modeRef.current = newMode;
    setMode(newMode);

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
          resumeGoalRef.current();
        }
      }, 3500);
    } else if (newMode === "waking") {
      actionTimeoutRef.current = setTimeout(() => {
        actionTimeoutRef.current = null;
        if (modeRef.current === "waking") {
          resumeGoalRef.current();
        }
      }, 2500);
    }
  }, []);

  const currentGoalRef = useRef<CapyGoalType>("wander");
  const interruptedGoalRef = useRef<CapyGoalType | null>(null);

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
  const triggerEmote = useCallback(
    (type: EmoteType, duration = 1100) => {
      if (isDraggingRef.current) return;

      if (emoteTimerRef.current) {
        clearTimeout(emoteTimerRef.current);
        emoteTimerRef.current = null;
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      // Clear waypoints so Capy is completely stationary in world space
      waypointsRef.current = [];

      if (type === "curious") {
        setPose("curious");
        changeMode("curious");
        setActiveEmote(null);
        playCompanionSound("pop");
      } else if (type === "reading" || type === "read") {
        setPose("read");
        changeMode("reading");
        setActiveEmote({
          type: "reading",
          id: `emote-${Date.now()}-${Math.random()}`,
          duration,
        });
      } else if (type === "happy") {
        setPose("happy");
        changeMode("happy");
        setShowHearts(true);
        setActiveEmote(null);
        playCompanionSound("pet");
        if (duration > 0) {
          setTimeout(() => setShowHearts(false), duration);
        }
      } else if (type === "thinking") {
        setPose("thinking");
        changeMode("thinking");
        setActiveEmote({
          type: "thinking",
          id: `emote-${Date.now()}-${Math.random()}`,
          duration,
        });
      } else if (type === "excited" || type === "snack") {
        setPose("happy");
        changeMode("happy");
        setActiveEmote(null);
        playCompanionSound("pet");
      }

      if (duration > 0) {
        emoteTimerRef.current = setTimeout(() => {
          emoteTimerRef.current = null;
          setActiveEmote(null);
          resumeGoalRef.current();
        }, duration);
      }
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

      if (modeRef.current === "reading" || modeRef.current === "thinking") {
        setActiveEmote(null);
        if (emoteTimerRef.current) {
          clearTimeout(emoteTimerRef.current);
          emoteTimerRef.current = null;
        }
        if (transitionTimerRef.current) {
          clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = null;
        }
      }

      const readyLeaf: SpawnedLeaf = {
        ...leaf,
        stage: "ready",
        treeStage: 10,
      };
      setActiveLeaf(readyLeaf);

      refreshObstacles();
      const currentPos = posRef.current;

      // If Capy is already within eating distance (36px) of the tree, start eating immediately!
      const distToTree = Math.hypot(readyLeaf.x - currentPos.x, readyLeaf.y - currentPos.y);
      if (distToTree <= 36) {
        if (readyLeaf.x !== currentPos.x) {
          setFacing(readyLeaf.x > currentPos.x ? "right" : "left");
        }
        waypointsRef.current = [];
        currentGoalRef.current = "eat_snack";
        changeMode("eating");
        setPose("eating");
        return;
      }

      const path: Point[] = [{ x: readyLeaf.x, y: readyLeaf.y }];

      if (path.length > 0) {
        const first = path[0];
        if (first.x !== currentPos.x) {
          setFacing(first.x > currentPos.x ? "right" : "left");
        }
      }

      // Happy / surprise reaction when spotting the tree, then walk towards it
      waypointsRef.current = [];
      currentGoalRef.current = "eat_snack";
      setPose("happy");
      playCompanionSound("pop");

      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }

      transitionTimerRef.current = setTimeout(() => {
        transitionTimerRef.current = null;
        waypointsRef.current = path;
        changeMode("walk_to_snack");
        setPose("walk");
      }, 550);
    },
    [refreshObstacles, changeMode]
  );

  // Steer autonomously to a specific point (e.g. walking home to the cushion)
  const walkToPoint = useCallback(
    (target: Point, onArrived?: () => void) => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      setShowHearts(false);
      onArrivedRef.current = onArrived || null;

      refreshObstacles();
      const current = posRef.current;

      const path: Point[] = [target];

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
    [refreshObstacles, changeMode]
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

      triggerEmote("excited", 800);
      playCompanionSound("pop");

      if (path.length > 0) {
        const nextDx = path[0].x - current.x;
        if (Math.abs(nextDx) > 0.5) {
          setFacing(nextDx > 0 ? "right" : "left");
        }
      }
    },
    [refreshObstacles, triggerEmote, planNextWander, changeMode]
  );

  // Resume persistent goal: calculates path to current persistent goal target
  const resumeGoal = useCallback(() => {
    if (isDraggingRef.current) return;
    const goal = currentGoalRef.current;

    // 1. Persistent Goal: Eat snack tree
    if (
      goal === "eat_snack" &&
      activeLeafRef.current &&
      activeLeafRef.current.stage === "ready" &&
      !activeLeafRef.current.isBeingEaten
    ) {
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

    // 5. If a ready tree exists anywhere on screen, eating it takes priority over random wander!
    if (
      activeLeafRef.current &&
      activeLeafRef.current.stage === "ready" &&
      !activeLeafRef.current.isBeingEaten
    ) {
      currentGoalRef.current = "eat_snack";
      startApproachingReadyLeaf(activeLeafRef.current);
      return;
    }

    // 6. Normal continuous wander
    currentGoalRef.current = "wander";
    changeMode("wander");
    setPose("walk");
    planNextWander();
  }, [startApproachingReadyLeaf, startPressFocus, planNextWander, changeMode]);

  resumeGoalRef.current = resumeGoal;

  // Autonomous wild tree growth: a seed spontaneously sprouts on screen for Cappy to find and eat
  const spawnWildTree = useCallback(() => {
    if (activeLeafRef.current || isDraggingRef.current) return;

    refreshObstacles();
    const vp = viewportRef.current;

    const minX = 48;
    const maxX = Math.max(minX + 50, vp.width - 120);
    const minY = 72;
    const maxY = Math.max(minY + 50, vp.height - 130);

    const target: Point = {
      x: Math.round(minX + Math.random() * (maxX - minX)),
      y: Math.round(minY + Math.random() * (maxY - minY)),
    };

    const leaf: SpawnedLeaf = {
      id: `wild-leaf-${Date.now()}`,
      x: target.x,
      y: target.y,
      createdAt: Date.now(),
      stage: "sprouting",
      treeStage: 1,
      isBeingEaten: false,
    };

    setActiveLeaf(leaf);
    playCompanionSound("pop");

    let step = 1;
    const growthInterval = setInterval(() => {
      step += 1;
      if (step >= 10) {
        clearInterval(growthInterval);
        setActiveLeaf((curr) => {
          if (curr && curr.id === leaf.id) {
            const readyLeaf: SpawnedLeaf = {
              ...curr,
              stage: "ready",
              treeStage: 10,
            };
            currentGoalRef.current = "eat_snack";
            startApproachingReadyLeaf(readyLeaf);
            return readyLeaf;
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
    }, 140);
  }, [refreshObstacles, startApproachingReadyLeaf]);

  // Spawns a tree snack by spontaneously sprouting a wild tree (no planting animation on screen)
  const spawnLeaf = useCallback(
    (_customPoint?: Point) => {
      spawnWildTree();
    },
    [spawnWildTree]
  );

  // Start shouting animation when timer completes (focus, short break, long break)
  const startShouting = useCallback(() => {
    if (isDraggingRef.current) return;

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
    changeMode("shouting");
    setPose("shout");
  }, [changeMode]);

  // Rest & Waking System
  const wakeUp = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    changeMode("waking");
    setPose("stretch"); // 10-frame stretch wakeup from Stretch wakeup.png
    playCompanionSound("pet");
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
    if (modeRef.current === "resting") {
      wakeUp();
    } else {
      // Enter resting state indefinitely
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      waypointsRef.current = [];
      currentGoalRef.current = "rest";
      changeMode("resting");
      setPose("sleep"); // peaceful sleeping artwork from Sleeping.png (no Zzz)
      playCompanionSound("drop");
    }
  }, [wakeUp, changeMode]);

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
      // If a completion callback was provided (e.g. from Call Home sequence), run it!
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
      currentGoalRef.current = "wander";
      setPose("happy");
      changeMode("happy");
      triggerEmote("happy", 800);
      playCompanionSound("pet");
    } else if (modeRef.current === "planting") {
      // 8-frame planting animation completed
      // The sprout has appeared! Now spawn the tree snack and start its growth
      const vp = viewportRef.current;
      const cur = posRef.current;
      // In the sprite, dirt mound and sprout are on the right side of Cappy
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
      playCompanionSound("pop");
      setPose("happy");
      changeMode("happy");
      triggerEmote("happy", 800);
      playCompanionSound("pet");

      // Smoothly advance through tree growth stages 1..10
      let step = 1;
      const growthInterval = setInterval(() => {
        step += 1;
        if (step >= 10) {
          clearInterval(growthInterval);
          setActiveLeaf((curr) => {
            if (curr && curr.id === leaf.id) {
              const readyLeaf: SpawnedLeaf = {
                ...curr,
                stage: "ready",
                treeStage: 10,
              };
              currentGoalRef.current = "eat_snack";
              startApproachingReadyLeaf(readyLeaf);
              return readyLeaf;
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
      }, 140);

      transitionTimerRef.current = setTimeout(() => {
        transitionTimerRef.current = null;
        resumeGoalRef.current();
      }, 700);
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
      setActiveEmote(null);
      resumeGoalRef.current();
    } else if (modeRef.current === "shouting") {
      // Shouting sequence finished (sound ended and frames 7-8 played)
      setPose("happy");
      changeMode("happy");
      triggerEmote("happy", 900);
      playCompanionSound("pet");
    }
  }, [triggerEmote, startApproachingReadyLeaf, changeMode, facing, pose]);

  // Goal: When a tree suddenly pops up on screen and is ready, Capy will ALWAYS go and eat it!
  useEffect(() => {
    if (activeLeaf && activeLeaf.stage === "ready" && !activeLeaf.isBeingEaten) {
      if (
        modeRef.current !== "walk_to_snack" &&
        modeRef.current !== "eating" &&
        modeRef.current !== "waking" &&
        modeRef.current !== "shouting" &&
        !isDraggingRef.current
      ) {
        startApproachingReadyLeaf(activeLeaf);
      }
    }
  }, [activeLeaf, startApproachingReadyLeaf]);

  // Trigger shouting animation when timer completes (focus, short break, long break)
  useEffect(() => {
    const handleTimerComplete = () => {
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
      const dt = Math.min((time - lastFrameTimeRef.current) / 1000, 0.1);
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
        if (movedDist < 2) {
          stalledFramesCountRef.current++;
          if (stalledFramesCountRef.current >= 75) {
            stalledFramesCountRef.current = 0;
            if (currentMode === "walk_to_snack") {
              if (activeLeafRef.current) {
                const distToLeaf = Math.hypot(
                  activeLeafRef.current.x - cur.x,
                  activeLeafRef.current.y - cur.y
                );
                if (distToLeaf <= 65) {
                  changeMode("eating");
                  setPose("eating");
                } else {
                  setActiveLeaf(null);
                  waypointsRef.current = [];
                  currentGoalRef.current = "wander";
                  changeMode("wander");
                  setPose("walk");
                  planNextWander();
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
              planNextWander();
            }
          }
        } else {
          lastMovedPosRef.current = { x: cur.x, y: cur.y };
          stalledFramesCountRef.current = 0;
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

        if (dist <= Math.max(stepDist, arrivalThreshold)) {
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
                    if (modeRef.current === "resting") {
                      wakeUp();
                    }
                  }, 3200);
                } else if (roll < 0.85 && !activeLeafRef.current) {
                  // 3. Spontaneous wild tree sprouts for Capy to eat!
                  spawnWildTree();
                  setPose("idle");
                  transitionTimerRef.current = setTimeout(() => {
                    transitionTimerRef.current = null;
                    if (modeRef.current === "wander" || modeRef.current === "idle") {
                      planNextWander();
                    }
                  }, 500);
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

      // Safety watchdog: If in any walking/idle mode with no waypoints and no active timers, resume roaming
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

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
      lastFrameTimeRef.current = 0;
    };
  }, [enabled, walkSpeed, onPosChange, planNextWander, changeMode]);

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
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (emoteTimerRef.current) clearTimeout(emoteTimerRef.current);
    };
  }, [enabled, planNextWander]);

  // Drag hooks
  const startDrag = useCallback((startClientPos: Point) => {
    isDraggingRef.current = true;
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    waypointsRef.current = [];
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
    [triggerPet, wakeUp]
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
