"use client";
import React, { useState, useEffect, useRef } from "react";

export type CapyPose =
  | "idle"
  | "walk"
  | "focus"
  | "eating"
  | "snack"
  | "happy"
  | "curious"
  | "excited"
  | "thinking"
  | "read"
  | "sleep"
  | "stretch"
  | "plant"
  | "drag"
  | "pet"
  | "bite"
  | "shout";

interface CapySpriteProps {
  pose: CapyPose;
  facing?: "left" | "right";
  showSprout?: boolean;
  showHearts?: boolean;
  showZzz?: boolean; // Deprecated per user requirements, retained for interface compatibility
  size?: number;
  className?: string;
  isFloating?: boolean;
  isPaused?: boolean;
  onAnimationComplete?: () => void;
  onFrame?: (frameIdx: number) => void;
}

interface AnimationConfig {
  frames: string[];
  intervalMs: number;
  loop: boolean;
}

const ANIMATION_SEQUENCES: Partial<Record<CapyPose, AnimationConfig>> = {
  walk: {
    // 8 frames from Walking.png
    frames: Array.from({ length: 8 }, (_, i) => `/art/cappy/walk-${i + 1}.png`),
    intervalMs: 110, // ~30 FPS natural pacing
    loop: true,
  },
  focus: {
    // 10 frames from Focus click.png
    frames: Array.from({ length: 10 }, (_, i) => `/art/cappy/focus-${i + 1}.png`),
    intervalMs: 110, // 1.1s total interaction
    loop: false,
  },
  eating: {
    // 10 frames from Eating.png
    frames: Array.from({ length: 10 }, (_, i) => `/art/cappy/eat-${i + 1}.png`),
    intervalMs: 95, // 0.95s total eating
    loop: false,
  },
  snack: {
    frames: Array.from({ length: 10 }, (_, i) => `/art/cappy/eat-${i + 1}.png`),
    intervalMs: 95,
    loop: false,
  },
  happy: {
    // 10 frames from Happy.png
    frames: Array.from({ length: 10 }, (_, i) => `/art/cappy/happy-${i + 1}.png`),
    intervalMs: 100, // 1.0s temporary reaction
    loop: false,
  },
  stretch: {
    // 10 frames from Stretch wakeup.png
    frames: Array.from({ length: 10 }, (_, i) => `/art/cappy/stretch-${i + 1}.png`),
    intervalMs: 100, // 1.0s stretch wakeup
    loop: false,
  },
  read: {
    // 10 frames from Reading.png
    frames: Array.from({ length: 10 }, (_, i) => `/art/cappy/read-${i + 1}.png`),
    intervalMs: 110,
    loop: false,
  },
  curious: {
    // 8 frames for star emoji: notice, slow down, look forward, head tilt, curious peek, sparkle appears, short hold, return
    frames: Array.from({ length: 8 }, (_, i) => `/art/cappy/curious-${i + 1}.png`),
    intervalMs: 115, // ~0.9s total
    loop: false,
  },
  excited: {
    frames: Array.from({ length: 10 }, (_, i) => `/art/cappy/happy-${i + 1}.png`),
    intervalMs: 100,
    loop: false,
  },
  thinking: {
    frames: Array.from({ length: 10 }, (_, i) => `/art/cappy/read-${i + 1}.png`),
    intervalMs: 110,
    loop: false,
  },
  plant: {
    // 8 frames from planting sprite sheet
    frames: Array.from({ length: 8 }, (_, i) => `/art/cappy/plant-${i + 1}.png`),
    intervalMs: 130,
    loop: false,
  },
  shout: {
    // 8 frames: walks to mic, opens mouth, shouts into mic with sound sparks, catches breath, stands proud
    frames: Array.from({ length: 8 }, (_, i) => `/art/cappy/shout-${i + 1}.png`),
    intervalMs: 120,
    loop: false,
  },
};

const STATIC_POSE_IMAGES: Partial<Record<CapyPose, string>> = {
  idle: "/art/cappy/walk-1.png",
  sleep: "/art/cappy/rest.png",
  drag: "/art/capy-drag.png",
  pet: "/art/cappy/happy-4.png",
  bite: "/art/cappy/eat-3.png",
};

// All frames preloaded into browser and Electron memory
const ALL_PRELOAD_IMAGES: string[] = [
  ...Array.from({ length: 8 }, (_, i) => `/art/cappy/walk-${i + 1}.png`),
  ...Array.from({ length: 10 }, (_, i) => `/art/cappy/focus-${i + 1}.png`),
  ...Array.from({ length: 10 }, (_, i) => `/art/cappy/eat-${i + 1}.png`),
  ...Array.from({ length: 10 }, (_, i) => `/art/cappy/happy-${i + 1}.png`),
  ...Array.from({ length: 10 }, (_, i) => `/art/cappy/stretch-${i + 1}.png`),
  ...Array.from({ length: 10 }, (_, i) => `/art/cappy/read-${i + 1}.png`),
  ...Array.from({ length: 10 }, (_, i) => `/art/cappy/sleep-${i + 1}.png`),
  ...Array.from({ length: 8 }, (_, i) => `/art/cappy/plant-${i + 1}.png`),
  ...Array.from({ length: 8 }, (_, i) => `/art/cappy/curious-${i + 1}.png`),
  ...Array.from({ length: 8 }, (_, i) => `/art/cappy/shout-${i + 1}.png`),
  "/art/cappy/rest.png",
  "/art/capy-drag.png",
  "/art/capy-sprout.png",
  "/art/capy-blink.png",
];

export default function CapySprite({
  pose,
  facing = "right",
  showSprout = false,
  showHearts = false,
  showZzz = false,
  size = 76,
  className = "",
  isFloating = false,
  isPaused = false,
  onAnimationComplete,
  onFrame,
}: CapySpriteProps) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);

  // Preload all character frames into browser/Electron cache
  useEffect(() => {
    if (typeof window === "undefined") return;
    ALL_PRELOAD_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Occasional natural blinking when in idle pose
  useEffect(() => {
    if (pose !== "idle") {
      setIsBlinking(false);
      return;
    }

    let blinkTimeout: NodeJS.Timeout;
    const interval = setInterval(() => {
      setIsBlinking(true);
      blinkTimeout = setTimeout(() => {
        setIsBlinking(false);
      }, 160);
    }, 3400 + Math.random() * 2400);

    return () => {
      clearInterval(interval);
      clearTimeout(blinkTimeout);
    };
  }, [pose]);

  const isSoundPlayingRef = useRef(false);
  const soundDurationRef = useRef(3000);
  const soundStartTimeRef = useRef(0);

  // When pose is "shout", track whether sound is playing and synchronize dynamic animation
  useEffect(() => {
    if (pose !== "shout") return;

    isSoundPlayingRef.current = true;
    soundStartTimeRef.current = Date.now();
    soundDurationRef.current = 3000;

    let fallbackTimer = setTimeout(() => {
      isSoundPlayingRef.current = false;
    }, 15000);

    const handleSoundStarted = (e: Event) => {
      isSoundPlayingRef.current = true;
      soundStartTimeRef.current = Date.now();
      clearTimeout(fallbackTimer);
      const ce = e as CustomEvent<{ durationMs?: number }>;
      const dur = ce.detail?.durationMs;
      if (dur && dur > 0) {
        soundDurationRef.current = dur;
        fallbackTimer = setTimeout(() => {
          isSoundPlayingRef.current = false;
        }, dur + 100);
      } else {
        soundDurationRef.current = 3000;
        fallbackTimer = setTimeout(() => {
          isSoundPlayingRef.current = false;
        }, 3500);
      }
    };

    const handleSoundEnded = () => {
      clearTimeout(fallbackTimer);
      isSoundPlayingRef.current = false;
    };

    window.addEventListener("pacana:sound-started", handleSoundStarted);
    window.addEventListener("pacana:sound-ended", handleSoundEnded);

    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener("pacana:sound-started", handleSoundStarted);
      window.removeEventListener("pacana:sound-ended", handleSoundEnded);
    };
  }, [pose]);

  const onAnimationCompleteRef = useRef(onAnimationComplete);
  onAnimationCompleteRef.current = onAnimationComplete;

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  // Frame sequence playback loop
  useEffect(() => {
    const config = ANIMATION_SEQUENCES[pose];
    if (!config || isPaused) {
      setFrameIdx(0);
      return;
    }

    setFrameIdx(0);
    setTimeout(() => {
      if (onFrameRef.current) onFrameRef.current(0);
    }, 0);

    // Dynamic audio synchronization for long audio animations (e.g. shout)
    if (pose === "shout") {
      const startTime = Date.now();
      const tickRate = 45; // Smooth ~22-30fps updates

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const totalDuration = soundDurationRef.current || 3000;
        // Final portion: 5 frames (indices 3..7) taking approximately 1.2s - 1.8s
        const finalDuration = Math.min(1800, Math.max(800, totalDuration * 0.4));
        const loopUntil = Math.max(0, totalDuration - finalDuration);

        if (elapsed < loopUntil && isSoundPlayingRef.current) {
          // A. 3-frame subtle idle loop: Frame 1 -> 2 -> 3 -> 2 -> 1...
          const idleFrames = [0, 1, 2, 1];
          const idleStep = Math.floor(elapsed / 140) % idleFrames.length;
          const frame = idleFrames[idleStep];
          setFrameIdx(frame);
          if (onFrameRef.current) onFrameRef.current(frame);
        } else {
          // B. Final audio-sync portion: play remaining frames sequentially to the climax
          const finalFrames = [3, 4, 5, 6, 7];
          const finalElapsed = elapsed - loopUntil;
          const finalStep = Math.min(
            finalFrames.length - 1,
            Math.floor((finalElapsed / finalDuration) * finalFrames.length),
          );
          const frame = finalFrames[finalStep];
          setFrameIdx(frame);
          if (onFrameRef.current) onFrameRef.current(frame);

          // Synchronize ending: finish exactly when audio ends or time expires
          if (!isSoundPlayingRef.current || elapsed >= totalDuration) {
            clearInterval(interval);
            setFrameIdx(7);
            if (onFrameRef.current) onFrameRef.current(7);
            if (onAnimationCompleteRef.current) onAnimationCompleteRef.current();
          }
        }
      }, tickRate);

      return () => clearInterval(interval);
    }

    // Standard sequence loop for other animations
    const interval = setInterval(() => {
      setFrameIdx((current) => {
        const next = current + 1;
        if (next >= config.frames.length) {
          if (config.loop) {
            setTimeout(() => {
              if (onFrameRef.current) onFrameRef.current(0);
            }, 0);
            return 0;
          } else {
            // Sequence finished
            clearInterval(interval);
            setTimeout(() => {
              if (onFrameRef.current) onFrameRef.current(config.frames.length - 1);
              if (onAnimationCompleteRef.current) onAnimationCompleteRef.current();
            }, 0);
            return config.frames.length - 1;
          }
        }
        setTimeout(() => {
          if (onFrameRef.current) onFrameRef.current(next);
        }, 0);
        return next;
      });
    }, config.intervalMs);

    return () => clearInterval(interval);
  }, [pose, isPaused]);

  // Determine current image frame
  let imageSrc = STATIC_POSE_IMAGES[pose] || STATIC_POSE_IMAGES.idle || "/art/cappy/walk-1.png";

  const activeConfig = ANIMATION_SEQUENCES[pose];
  if (activeConfig) {
    const safeIdx = Math.min(frameIdx, activeConfig.frames.length - 1);
    imageSrc = activeConfig.frames[safeIdx];
  } else if (pose === "idle" && isBlinking) {
    imageSrc = "/art/capy-blink.png";
  }

  const isRestingPose = pose === "sleep";

  return (
    <div
      className={`capy-character-root pose-${pose} ${className} ${
        isFloating ? "is-floating" : ""
      } ${isRestingPose ? "is-resting-capy" : ""}`}
      style={{
        width: `${size * 1.15}px`,
        height: `${size * 1.15}px`,
      }}
    >
      {/* Floating Hearts for Happy / Petting */}
      {showHearts && (
        <div className="capy-effects-layer hearts" aria-hidden="true">
          <span className="heart h1">♥</span>
          <span className="heart h2">♥</span>
          <span className="heart h3">♥</span>
        </div>
      )}

      {/* Floating Zzz when sleeping */}
      {(showZzz || isRestingPose) && (
        <div className="capy-effects-layer zzz" aria-hidden="true">
          <span className="z-item z1">z</span>
          <span className="z-item z2">z</span>
          <span className="z-item z3">Z</span>
        </div>
      )}

      {/* Pop-up Clover / Grass Sprout */}
      {showSprout && (
        <div className="capy-pop-sprout" aria-hidden="true">
          <img
            src="/art/capy-sprout.png"
            alt=""
            className="sprout-img"
            draggable={false}
          />
        </div>
      )}

      {/* Ground Shadow */}
      <div
        className={`capy-shadow ${pose === "drag" ? "is-lifted" : ""}`}
        aria-hidden="true"
      />

      {/* Facing Wrapper: controls horizontal orientation without CSS keyframe collision */}
      <div
        className="capy-facing-container"
        style={{
          transform: facing === "left" ? "scaleX(-1)" : "scaleX(1)",
        }}
      >
        <div
          className={`capy-sprite-wrapper ${pose === "walk" ? "is-walking" : ""}`}
        >
          <img
            src={imageSrc}
            alt={`Cute Capybara Companion (${pose})`}
            className="capy-image"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
