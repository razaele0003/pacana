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
  spriteSheet?: {
    src: string;
    frameCount: number;
  };
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
    // 7 frames from microphone-sheet.png: walks to mic, sings with microphone, stops on frame 7
    frames: Array.from({ length: 7 }, (_, i) => `/art/cappy/shout-${i + 1}.png`),
    intervalMs: 125,
    loop: false,
    spriteSheet: {
      src: "/art/cappy/microphone-sheet.png",
      frameCount: 7,
    },
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
  ...Array.from({ length: 7 }, (_, i) => `/art/cappy/shout-${i + 1}.png`),
  "/art/cappy/microphone-sheet.png",
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
  const soundEndedCallbacksRef = useRef<(() => void)[]>([]);

  // When pose is "shout", track whether sound is playing and synchronize dynamic animation
  useEffect(() => {
    if (pose !== "shout") return;

    isSoundPlayingRef.current = true;
    soundStartTimeRef.current = Date.now();
    soundDurationRef.current = 3000;

    let fallbackTimer = setTimeout(() => {
      isSoundPlayingRef.current = false;
      const cbs = [...soundEndedCallbacksRef.current];
      soundEndedCallbacksRef.current = [];
      cbs.forEach((cb) => cb());
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
          const cbs = [...soundEndedCallbacksRef.current];
          soundEndedCallbacksRef.current = [];
          cbs.forEach((cb) => cb());
        }, dur + 100);
      } else {
        soundDurationRef.current = 3000;
        fallbackTimer = setTimeout(() => {
          isSoundPlayingRef.current = false;
          const cbs = [...soundEndedCallbacksRef.current];
          soundEndedCallbacksRef.current = [];
          cbs.forEach((cb) => cb());
        }, 3500);
      }
    };

    const handleSoundEnded = () => {
      clearTimeout(fallbackTimer);
      isSoundPlayingRef.current = false;
      const cbs = [...soundEndedCallbacksRef.current];
      soundEndedCallbacksRef.current = [];
      cbs.forEach((cb) => cb());
    };

    window.addEventListener("pacana:sound-started", handleSoundStarted);
    window.addEventListener("pacana:sound-ended", handleSoundEnded);

    return () => {
      clearTimeout(fallbackTimer);
      soundEndedCallbacksRef.current = [];
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

    // Dedicated microphone animation for timer completion:
    // Plays Frame 1 -> Frame 2 -> ... -> Frame 7 ONCE.
    // Holds Frame 7 if audio is still playing.
    // When audio finishes, completes animation and returns to normal behavior.
    if (pose === "shout") {
      let currentFrame = 0;
      setFrameIdx(0);
      if (onFrameRef.current) onFrameRef.current(0);

      const frameInterval = setInterval(() => {
        currentFrame += 1;
        if (currentFrame >= 6) {
          // Reached Frame 7 (index 6). Stop advancing!
          clearInterval(frameInterval);
          setFrameIdx(6);
          if (onFrameRef.current) onFrameRef.current(6);

          const finishAnimation = () => {
            if (onAnimationCompleteRef.current) {
              onAnimationCompleteRef.current();
            }
          };

          // If sound is already done or not playing, finish now.
          // Otherwise, hold Frame 7 until audio finishes!
          if (!isSoundPlayingRef.current) {
            setTimeout(finishAnimation, 250);
          } else {
            soundEndedCallbacksRef.current.push(finishAnimation);
          }
        } else {
          setFrameIdx(currentFrame);
          if (onFrameRef.current) onFrameRef.current(currentFrame);
        }
      }, config.intervalMs);

      return () => {
        clearInterval(frameInterval);
      };
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
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {activeConfig?.spriteSheet ? (
            <div
              className="capy-sprite-viewport"
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
              }}
            >
              <img
                src={activeConfig.spriteSheet.src}
                alt={`Cute Capybara Companion (${pose})`}
                className="capy-spritesheet-image"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${activeConfig.spriteSheet.frameCount * 100}%`,
                  maxWidth: "none",
                  transform: `translateX(-${(Math.min(frameIdx, activeConfig.spriteSheet.frameCount - 1) * 100) / activeConfig.spriteSheet.frameCount}%)`,
                  pointerEvents: "none",
                  filter: "drop-shadow(0 4px 10px rgba(35, 45, 30, 0.12))",
                }}
                draggable={false}
              />
            </div>
          ) : (
            <img
              src={imageSrc}
              alt={`Cute Capybara Companion (${pose})`}
              className="capy-image"
              draggable={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
