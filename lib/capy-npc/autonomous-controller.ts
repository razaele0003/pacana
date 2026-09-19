import { useState, useEffect, useRef, useCallback } from "react";
import { CapyPose } from "../../components/capy-sprite";
import { playCompanionSound } from "../companion-sound";
import {
  Point,
  Rect,
  ViewportBounds,
  queryUIObstacles,
  getRandomSafePoint,
  getRandomReachableSafePoint,
  findPathAroundObstacles,
  isPointInBounds,
  CLEARANCE_X,
  CLEARANCE_Y,
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
  | "idle";

export type CapyGoalType =
  | "wander"
  | "press_focus"
  | "eat_snack"
  | "go_home"
  | "rest";

export type EmoteType =
  | "snack"
  | "happy"
  | "curious"
  | "excited"
  | "eating"
  | "thinking"
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

  const changeMode = useCallback((newMode: CompanionMode) => {
    modeRef.current = newMode;
    setMode(newMode);
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

  // Temporary Emote Trigger (~0.8 - 1.2s)
  const triggerEmote = useCallback(
    (type: EmoteType, duration = 1100) => {
      if (emoteTimerRef.current) clearTimeout(emoteTimerRef.current);
      const emote: ActiveEmote = {
        type,
        id: `emote-${Date.now()}-${Math.random()}`,
        duration,
      };
      setActiveEmote(emote);

      if (type === "happy") {
        setShowHearts(true);
        playCompanionSound("pet");
      } else if (type === "curious" || type === "excited" || type === "snack") {
        playCompanionSound("pop");
      }

      if (duration > 0) {
        emoteTimerRef.current = setTimeout(() => {
          setActiveEmote((cur) => (cur?.id === emote.id ? null : cur));
          if (type === "happy") setShowHearts(false);
        }, duration);
      }
    },
    []
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
        modeRef.current === "resting"
      ) {
        return;
      }

      refreshObstacles();
      const vp = viewportRef.current;
      const obstacles = obstaclesRef.current;
      const current = posRef.current;

      // Bias destination: if on right half, walk left towards the room; if on left half, walk right
      const preferredSide: "left" | "right" | undefined =
        forcedSide ??
        (current.x > vp.width * 0.55
          ? "left"
          : current.x < vp.width * 0.42
          ? "right"
          : undefined);

      // Pick a safe reachable random destination in available screen space
      const target = getRandomReachableSafePoint(
        current,
        obstacles,
        vp,
        CLEARANCE_X,
        CLEARANCE_Y,
        preferredSide
      );

      // Compute route around any intervening obstacles
      const path = findPathAroundObstacles(
        current,
        target,
        obstacles,
        vp,
        CLEARANCE_X,
        CLEARANCE_Y
      );

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

      wanderStepCountRef.current++;
      // Periodic thinking state every 4 wander steps
      if (wanderStepCountRef.current % 4 === 0) {
        triggerEmote("thinking", 1000);
      }
    },
    [enabled, refreshObstacles, triggerEmote, changeMode]
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

      const readyLeaf: SpawnedLeaf = {
        ...leaf,
        stage: "ready",
        treeStage: 10,
      };
      setActiveLeaf(readyLeaf);

      refreshObstacles();
      const currentPos = posRef.current;
      const obstacles = obstaclesRef.current;
      const vp = viewportRef.current;

      const path = findPathAroundObstacles(
        currentPos,
        { x: readyLeaf.x, y: readyLeaf.y },
        obstacles,
        vp,
        CLEARANCE_X,
        CLEARANCE_Y
      );

      waypointsRef.current = path;
      currentGoalRef.current = "eat_snack";
      changeMode("walk_to_snack");
      setPose("walk");

      // Excited notice emote!
      triggerEmote("excited", 900);
      playCompanionSound("pop");

      if (path.length > 0) {
        const first = path[0];
        if (first.x !== currentPos.x) {
          setFacing(first.x > currentPos.x ? "right" : "left");
        }
      }
    },
    [refreshObstacles, triggerEmote, changeMode]
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
      const vp = viewportRef.current;
      const obstacles = obstaclesRef.current;
      const current = posRef.current;

      // Filter out any obstacle enclosing destination (such as sidebar)
      const filteredObstacles = obstacles.filter(
        (obs) =>
          !(
            target.x >= obs.left - 24 &&
            target.x <= obs.right + 24 &&
            target.y >= obs.top - 24 &&
            target.y <= obs.bottom + 24
          )
      );

      const path = findPathAroundObstacles(
        current,
        target,
        filteredObstacles,
        vp,
        CLEARANCE_X,
        CLEARANCE_Y
      );

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
      const obstacles = obstaclesRef.current;
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

      // Position Cappy right below the button so his raised paw reaches the bottom edge of the button
      const targetX = Math.max(
        CLEARANCE_X,
        Math.min(vp.width - CLEARANCE_X, rect.left + Math.min(rect.width * 0.35, 40))
      );
      const targetY = Math.max(
        CLEARANCE_Y,
        Math.min(vp.height - CLEARANCE_Y, rect.bottom + 16)
      );
      const targetPoint: Point = { x: targetX, y: targetY };
      targetPosRef.current = targetPoint;

      // Filter out obstacles enclosing the button so Cappy can pathfind all the way to it
      const filteredObstacles = obstacles.filter(
        (obs) =>
          !(
            rect.left < obs.right &&
            rect.right > obs.left &&
            rect.top < obs.bottom &&
            rect.bottom > obs.top
          )
      );

      const path = findPathAroundObstacles(
        current,
        targetPoint,
        filteredObstacles,
        vp,
        CLEARANCE_X,
        CLEARANCE_Y
      );

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

  // Spawn growing plant sequence
  const spawnLeaf = useCallback(
    (customPoint?: Point) => {
      refreshObstacles();
      const vp = viewportRef.current;
      const obstacles = obstaclesRef.current;

      const leafPos =
        customPoint && isPointInBounds(customPoint, vp, 40, 40)
          ? customPoint
          : getRandomReachableSafePoint(posRef.current, obstacles, vp, 60, 50);

      const leaf: SpawnedLeaf = {
        id: `leaf-${Date.now()}`,
        x: leafPos.x,
        y: leafPos.y,
        createdAt: Date.now(),
        stage: "sprouting",
        treeStage: 1,
        isBeingEaten: false,
      };

      setActiveLeaf(leaf);
      playCompanionSound("pop");
      triggerEmote("snack", 900);

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
          if (step === 4 || step === 8) {
            playCompanionSound("pop");
          }
        }
      }, 120);
    },
    [refreshObstacles, startApproachingReadyLeaf, triggerEmote]
  );

  // Petting interaction (temporary reaction that DOES NOT cancel current goal!)
  const triggerPet = useCallback(() => {
    if (modeRef.current === "resting") {
      // Waking up
      changeMode("waking");
      setPose("stretch");
      playCompanionSound("pet");
      return;
    }

    // Save active goal to resume after reaction!
    if (
      currentGoalRef.current !== "wander" &&
      currentGoalRef.current !== "rest"
    ) {
      interruptedGoalRef.current = currentGoalRef.current;
    }

    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    waypointsRef.current = [];
    setPose("happy");
    triggerEmote("happy", 1100);

    transitionTimerRef.current = setTimeout(() => {
      // Resume goal if interrupted!
      if (interruptedGoalRef.current === "press_focus") {
        interruptedGoalRef.current = null;
        startPressFocus();
      } else if (
        interruptedGoalRef.current === "eat_snack" &&
        activeLeafRef.current?.stage === "ready"
      ) {
        interruptedGoalRef.current = null;
        startApproachingReadyLeaf(activeLeafRef.current);
      } else if (interruptedGoalRef.current === "go_home") {
        interruptedGoalRef.current = null;
        window.dispatchEvent(new CustomEvent("pacana:call-cappy-home"));
      } else {
        interruptedGoalRef.current = null;
        currentGoalRef.current = "wander";
        changeMode("wander");
        setPose("walk");
        planNextWander();
      }
    }, 1100);
  }, [triggerEmote, startPressFocus, startApproachingReadyLeaf, planNextWander, changeMode]);

  // Rest & Waking System
  const wakeUp = useCallback(() => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    changeMode("waking");
    setPose("stretch"); // 10-frame stretch wakeup from Stretch wakeup.png
    playCompanionSound("pet");
  }, [changeMode]);

  const toggleSleep = useCallback(() => {
    if (modeRef.current === "resting") {
      wakeUp();
    } else {
      // Enter resting state indefinitely
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
      // Focus sequence completed (10 frames finished)
      // If a completion callback was provided (e.g. from Call Home sequence), run it!
      if (onFocusCompleteRef.current) {
        const cb = onFocusCompleteRef.current;
        onFocusCompleteRef.current = null;
        cb();
        return;
      }

      // Satisfied reaction, then return to normal wandering
      setPose("happy");
      triggerEmote("happy", 900);
      playCompanionSound("pet");

      transitionTimerRef.current = setTimeout(() => {
        currentGoalRef.current = "wander";
        changeMode("wander");
        setPose("walk");
        planNextWander();
      }, 700);
    } else if (modeRef.current === "eating") {
      // Eating sequence completed (10 frames finished)
      setActiveLeaf(null);
      setPose("happy");
      triggerEmote("happy", 800);
      playCompanionSound("pet");

      transitionTimerRef.current = setTimeout(() => {
        currentGoalRef.current = "wander";
        changeMode("wander");
        setPose("walk");
        planNextWander();
      }, 600);
    } else if (modeRef.current === "waking") {
      // Stretch sequence completed (10 frames finished)
      // Resume interrupted goal or wander
      if (interruptedGoalRef.current === "press_focus") {
        interruptedGoalRef.current = null;
        startPressFocus();
      } else if (
        interruptedGoalRef.current === "eat_snack" &&
        activeLeafRef.current?.stage === "ready"
      ) {
        interruptedGoalRef.current = null;
        startApproachingReadyLeaf(activeLeafRef.current);
      } else {
        interruptedGoalRef.current = null;
        currentGoalRef.current = "wander";
        changeMode("wander");
        setPose("walk");
        planNextWander();
      }
    }
  }, [triggerEmote, startPressFocus, startApproachingReadyLeaf, planNextWander, changeMode]);

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

      if (
        (currentMode === "wander" ||
          currentMode === "walk_to_focus" ||
          currentMode === "walk_to_snack" ||
          currentMode === "walk_home") &&
        waypointsRef.current.length > 0 &&
        !isDraggingRef.current
      ) {
        const nextTarget = waypointsRef.current[0];
        const dx = nextTarget.x - cur.x;
        const dy = nextTarget.y - cur.y;
        const dist = Math.hypot(dx, dy);

        // Turn facing direction smoothly based on movement vector
        if (Math.abs(dx) > 0.5) {
          setFacing(dx > 0 ? "right" : "left");
        } else if (waypointsRef.current.length > 1) {
          const futureDx = waypointsRef.current[1].x - cur.x;
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

        if (dist <= Math.max(stepDist, 10)) {
          // Reached this waypoint
          const reached: Point = {
            x: Math.max(minX, Math.min(maxX, nextTarget.x)),
            y: Math.max(minY, Math.min(maxY, nextTarget.y)),
          };
          waypointsRef.current.shift();
          posRef.current = reached;
          setPos(reached);
          if (onPosChange) onPosChange(reached);

          // If there is another waypoint queued, face towards it
          if (waypointsRef.current.length > 0) {
            const nextWp = waypointsRef.current[0];
            const nextDx = nextWp.x - reached.x;
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
              setPose("walk");
              transitionTimerRef.current = setTimeout(() => {
                planNextWander();
              }, 220 + Math.random() * 220);
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
          setPose("walk");
          changeMode("wander");
          const vp = viewportRef.current;
          if (posRef.current.x > vp.width * 0.55) {
            setFacing("left");
            planNextWander("left");
          } else if (posRef.current.x < vp.width * 0.42) {
            setFacing("right");
            planNextWander("right");
          } else {
            planNextWander();
          }
        }, 350);
      } else {
        if (modeRef.current === "resting") {
          wakeUp();
        } else {
          triggerPet();
        }
      }
    },
    [triggerPet, wakeUp, planNextWander, changeMode]
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
    showZzz: false, // Explicitly no floating Zzz per specification
    landingBounce,
    spawnLeaf,
    startApproachingReadyLeaf,
    startPressFocus,
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
