"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import CapySprite, { CapyPose } from "./capy-sprite";
import CapyLeaf from "./capy-leaf";
import CapyEmoteBubble from "./capy-emote-bubble";
import CapyMenu from "./capy-menu";
import { playCompanionSound } from "../lib/companion-sound";
import { useAutonomousCapy, EmoteType } from "../lib/capy-npc/autonomous-controller";
import { Home, Move } from "lucide-react";

interface InteractiveCompanionProps {
  isFloating: boolean;
  onToggleFloating: (floating: boolean, dropPos?: { x: number; y: number }) => void;
  externalPose?: string;
  isDockedContainer?: boolean;
  isFullScreen?: boolean;
  initialPos?: { x: number; y: number };
}

export type CushionSeedStage =
  | "none"
  | "falling"
  | "planted"
  | "sprouting"
  | "ready"
  | "being_eaten";

export function CushionSeed({
  stage,
  treeStage = 1,
}: {
  stage: CushionSeedStage;
  treeStage?: number;
}) {
  if (stage === "none") return null;

  const stageNum = Math.max(1, Math.min(10, treeStage));
  const treeSrc = `/art/tree/tree-${stageNum}.png`;

  return (
    <div className={`cushion-seed-wrapper stage-${stage} tree-stage-${stageNum}`}>
      {/* Shimmering beacon ring summoning Cappy home when plant is full bloom */}
      {(stage === "ready" || stageNum >= 9) && stage !== "being_eaten" && (
        <div className="cushion-beacon-ring" aria-hidden="true" />
      )}

      {/* Main tree artwork anchored to cushion base */}
      <img
        src={treeSrc}
        alt={`Cushion tree stage ${stageNum}`}
        className={`cushion-seed-art stage-img-${stageNum}`}
        draggable={false}
      />

      {/* Munching crumbs and sakura blossom petals */}
      {stage === "being_eaten" && (
        <div className="cushion-eating-burst" aria-hidden="true">
          <span className="cushion-nibble n1">✦</span>
          <span className="cushion-nibble n2">🌸</span>
          <span className="cushion-nibble n3">✦</span>
        </div>
      )}
    </div>
  );
}

// Shared cushion seed stage & tree stage persisted across unmounts/tab navigation
let sharedCushionSeedStage: CushionSeedStage = "none";
let sharedCushionTreeStage: number = 2;

export default function InteractiveCompanion({
  isFloating,
  onToggleFloating,
  externalPose,
  isDockedContainer = false,
  isFullScreen = false,
  initialPos: propInitialPos,
}: InteractiveCompanionProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [menuSuppressed, setMenuSuppressed] = useState(false);

  // Instantly dismiss menu on any interaction so Cappy's head & emote are clear
  const handleMenuAction = (action: () => void) => {
    setIsHovered(false);
    setMenuSuppressed(true);
    action();
  };

  // Cushion Seed state (for docked cushion)
  const [cushionSeedState, setCushionSeedState] = useState<{
    stage: CushionSeedStage;
    treeStage: number;
  }>(() => ({
    stage: isFloating
      ? sharedCushionSeedStage !== "none"
        ? sharedCushionSeedStage
        : "planted"
      : "none",
    treeStage: isFloating ? (sharedCushionTreeStage > 1 ? sharedCushionTreeStage : 2) : 1,
  }));
  const fallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const growthIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateCushionSeed = (stage: CushionSeedStage, treeStage?: number) => {
    const tStage =
      treeStage ??
      (stage === "ready"
        ? 10
        : stage === "planted"
        ? 2
        : stage === "falling"
        ? 1
        : cushionSeedState.treeStage);
    sharedCushionSeedStage = stage;
    sharedCushionTreeStage = tStage;
    setCushionSeedState({ stage, treeStage: tStage });
  };

  // Fallback state for stationary docked mode: cozy sleep nap on cushion
  const [dockedPose, setDockedPose] = useState<CapyPose>("sleep");
  const [dockedSprout, setDockedSprout] = useState(false);
  const [dockedHearts, setDockedHearts] = useState(false);
  const [dockedZzz, setDockedZzz] = useState(false);
  const [isGettingUp, setIsGettingUp] = useState(false);

  // Docked drag state for portal-based unconstrained drag across the entire screen
  const [dockedDrag, setDockedDrag] = useState<{
    x: number;
    y: number;
    facing: "left" | "right";
  } | null>(null);

  // Track real-time status of floating companion
  const [floatingStatus, setFloatingStatus] = useState<{
    mode: string;
    goal: string;
  }>({ mode: "wander", goal: "wander" });

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const ce = e as CustomEvent<{ mode: string; goal: string }>;
      if (ce.detail) {
        setFloatingStatus(ce.detail);
      }
    };
    window.addEventListener("pacana:cappy-status", handleStatus);
    return () => window.removeEventListener("pacana:cappy-status", handleStatus);
  }, []);

  // Initialize saved position from localStorage or props
  const [initialPos] = useState(() => {
    const defaultX = Math.round((typeof window !== "undefined" ? window.innerWidth : 1200) * 0.45);
    const defaultY = Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * 0.55);

    if (propInitialPos) {
      return {
        x: Math.max(24, Math.min(typeof window !== "undefined" ? window.innerWidth - 116 : 1000, propInitialPos.x)),
        y: Math.max(48, Math.min(typeof window !== "undefined" ? window.innerHeight - 110 : 700, propInitialPos.y)),
      };
    }
    if (typeof window === "undefined") return { x: 500, y: 400 };
    const saved = localStorage.getItem("pacana:companion:pos");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxSavedX = Math.max(24, (window.innerWidth || 1200) - 116);
          const maxSavedY = Math.max(48, (window.innerHeight || 800) - 110);
          return {
            x: Math.max(24, Math.min(maxSavedX, parsed.x)),
            y: Math.max(48, Math.min(maxSavedY, parsed.y)),
          };
        }
      } catch {}
    }
    return {
      x: defaultX,
      y: defaultY,
    };
  });

  const handlePosChange = useCallback((newPos: { x: number; y: number }) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pacana:companion:pos", JSON.stringify(newPos));
    }
  }, []);

  // Autonomous 2D NPC controller
  const npc = useAutonomousCapy({
    enabled: isFloating && !isDockedContainer,
    initialPos,
    onPosChange: handlePosChange,
    walkSpeed: 50,
    isFullScreen,
  });

  // Drag tracking refs
  const dragRef = useRef({
    isDown: false,
    isDragging: false,
  });
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync external pose when docked
  useEffect(() => {
    if (isDockedContainer && externalPose) {
      if (externalPose === "celebrate") setDockedPose("pet");
      else if (externalPose === "rest") setDockedPose("sleep");
      else if (externalPose === "study" || externalPose === "idle")
        setDockedPose("idle");
    }
  }, [isDockedContainer, externalPose]);

  // Docked Cushion Seed Event Listeners
  useEffect(() => {
    if (!isDockedContainer) return;

    // Start background growth for the cushion plant if it's currently planted or sprouting
    if (
      cushionSeedState.stage !== "none" &&
      cushionSeedState.stage !== "ready" &&
      cushionSeedState.stage !== "being_eaten"
    ) {
      if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
      let currentStage = cushionSeedState.treeStage || 2;
      growthIntervalRef.current = setInterval(() => {
        currentStage += 1;
        if (currentStage >= 10) {
          if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
          updateCushionSeed("ready", 10);
        } else {
          updateCushionSeed("sprouting", currentStage);
        }
      }, 400);
    }

    const handleDraggedOut = () => {
      updateCushionSeed("none", 1);
      if (fallTimerRef.current) clearTimeout(fallTimerRef.current);
      if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
      // A seed will fall onto the cushion a couple seconds after drop (~1.4s)
      fallTimerRef.current = setTimeout(() => {
        updateCushionSeed("falling", 1);
        playCompanionSound("pop");
        setTimeout(() => {
          updateCushionSeed("planted", 2);
          let currentStage = 2;
          if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
          growthIntervalRef.current = setInterval(() => {
            currentStage += 1;
            if (currentStage >= 10) {
              if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
              updateCushionSeed("ready", 10);
            } else {
              updateCushionSeed("sprouting", currentStage);
            }
          }, 400);
        }, 450);
      }, 1400);
    };

    const handleCallHome = () => {
      // Handled by floating companion navigation
    };

    const handleArrivedHome = () => {
      if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
      if (sharedCushionSeedStage !== "none") {
        updateCushionSeed("being_eaten", sharedCushionTreeStage);
        playCompanionSound("snack");
        setTimeout(() => {
          updateCushionSeed("none", 1);
        }, 1200);
      }
    };

    window.addEventListener("pacana:cappy-dragged-out", handleDraggedOut);
    window.addEventListener("pacana:call-cappy-home", handleCallHome);
    window.addEventListener("pacana:cappy-arrived-home", handleArrivedHome);

    return () => {
      if (fallTimerRef.current) clearTimeout(fallTimerRef.current);
      if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
      window.removeEventListener("pacana:cappy-dragged-out", handleDraggedOut);
      window.removeEventListener("pacana:call-cappy-home", handleCallHome);
      window.removeEventListener("pacana:cappy-arrived-home", handleArrivedHome);
    };
  }, [isDockedContainer, cushionSeedState.stage, cushionSeedState.treeStage]);

  // Handle timer completion shouting animation (for docked cushion only; floating Cappy is handled by autonomous-controller)
  const lastHandledTimerRef = useRef<string | null>(null);

  useEffect(() => {
    const handleTimerComplete = (e: Event) => {
      const ce = e as CustomEvent<{ timerId?: string }>;
      const timerId = ce.detail?.timerId || `timer-${Date.now()}`;
      if (lastHandledTimerRef.current === timerId) return;
      lastHandledTimerRef.current = timerId;

      if (isDockedContainer) {
        setDockedPose("shout");
      }
    };
    window.addEventListener("pacana:timer-complete", handleTimerComplete);
    return () => {
      window.removeEventListener("pacana:timer-complete", handleTimerComplete);
    };
  }, [isDockedContainer]);

  // Floating Cappy: Listen for Call Capy Home & Navigation Commands
  useEffect(() => {
    if (!isFloating || isDockedContainer) return;

    const handleCallHome = () => {
      if (
        npc.mode === "walk_home" ||
        npc.mode === "eating" ||
        npc.mode === "walk_to_snack"
      ) {
        return;
      }

      if (npc.mode === "resting") {
        npc.wakeUp();
      }

      // Speed up tree growth so the tree visibly and rapidly grows to stage 10 before Cappy arrives!
      if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
      if (sharedCushionSeedStage === "none") {
        updateCushionSeed("planted", 2);
      }
      let currentStage = sharedCushionTreeStage || 2;
      if (currentStage < 10) {
        growthIntervalRef.current = setInterval(() => {
          currentStage += 1;
          if (currentStage >= 10) {
            if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
            updateCushionSeed("ready", 10);
          } else {
            updateCushionSeed("sprouting", currentStage);
          }
        }, 150);
      } else {
        updateCushionSeed("ready", 10);
      }

      const focusTabBtn =
        (document.querySelector('[data-capybara-target="nav-focus"]') as HTMLElement | null) ||
        (document.querySelector('button[data-tab="Focus"]') as HTMLElement | null);
      const isAlreadyOnFocus =
        focusTabBtn?.classList.contains("active") ||
        !!document.querySelector(".empty-cushion");

      const navigateToCushionAndEat = () => {
        const cushionEl =
          document.querySelector(".docked-companion-empty") ||
          document.querySelector(".empty-cushion");
        const cr = cushionEl?.getBoundingClientRect();
        const targetPos = cr
          ? {
              x: Math.max(8, cr.left + (cr.width - 76) / 2),
              y: Math.max(8, cr.top + (cr.height - 76) / 2),
            }
          : {
              x: Math.max(
                50,
                (typeof window !== "undefined" ? window.innerWidth : 1200) - 200
              ),
              y: 350,
            };

        // Cappy physically moves across the screen towards the home cushion
        npc.walkToPoint(targetPos, () => {
          // Tree is guaranteed to be fully grown when Cappy gets to the tree!
          if (growthIntervalRef.current) clearInterval(growthIntervalRef.current);
          updateCushionSeed("ready", 10);

          // Check whether there are leaves/plant on the cushion
          if (sharedCushionSeedStage !== "none") {
            window.dispatchEvent(new CustomEvent("pacana:cappy-arrived-home"));
            updateCushionSeed("being_eaten", 10);
            npc.setMode("eating");
            npc.setPose("eating");
            playCompanionSound("snack");

            setTimeout(() => {
              updateCushionSeed("none", 1);
              npc.setPose("idle");
              setDockedPose("idle");
              onToggleFloating(false);
            }, 1200);
          } else {
            // No plant on cushion: return directly to idle position on the cushion
            window.dispatchEvent(new CustomEvent("pacana:cappy-arrived-home"));
            npc.setPose("idle");
            setDockedPose("idle");
            onToggleFloating(false);
          }
        });
      };

      if (!isAlreadyOnFocus) {
        // Go to focus tab first to change to first tab!
        npc.startPressFocus(
          '[data-capybara-target="nav-focus"], button[data-tab="Focus"]',
          () => {
            // Now on first tab: give DOM 150ms to render cushion, then navigate and eat!
            setTimeout(navigateToCushionAndEat, 150);
          }
        );
      } else {
        // Already on Focus tab: go directly to cushion, eat leaves and become idle
        navigateToCushionAndEat();
      }
    };

    const handleCancelToWander = () => {
      npc.setPose("walk");
      npc.setMode("wander");
      npc.planNextWander();
    };

    const handlePressFocus = () => {
      const isAlreadyOnFocus =
        !!document.querySelector(".empty-cushion") ||
        document.querySelector('[data-tab="Focus"]')?.classList.contains("active");
      if (!isAlreadyOnFocus) {
        // If not on Focus tab, pressing Focus button will go click the Focus tab in sidebar!
        npc.startPressFocus('[data-capybara-target="nav-focus"]');
      } else {
        npc.startPressFocus();
      }
    };

    const handlePlantSnack = () => {
      npc.spawnLeaf();
    };

    const handleWake = () => {
      npc.wakeUp();
    };

    const handleSleep = () => {
      npc.toggleSleep();
    };

    const handleTriggerEmote = (e: Event) => {
      const ce = e as CustomEvent<{ type: EmoteType }>;
      if (ce.detail?.type) {
        npc.triggerEmote(ce.detail.type);
      }
    };

    window.addEventListener("pacana:call-cappy-home", handleCallHome);
    window.addEventListener("pacana:cancel-to-wander", handleCancelToWander);
    window.addEventListener("pacana:press-focus", handlePressFocus);
    window.addEventListener("pacana:plant-snack", handlePlantSnack);
    window.addEventListener("pacana:cappy-wake", handleWake);
    window.addEventListener("pacana:cappy-sleep", handleSleep);
    window.addEventListener("pacana:trigger-emote", handleTriggerEmote);

    return () => {
      window.removeEventListener("pacana:call-cappy-home", handleCallHome);
      window.removeEventListener("pacana:cancel-to-wander", handleCancelToWander);
      window.removeEventListener("pacana:press-focus", handlePressFocus);
      window.removeEventListener("pacana:plant-snack", handlePlantSnack);
      window.removeEventListener("pacana:cappy-wake", handleWake);
      window.removeEventListener("pacana:cappy-sleep", handleSleep);
      window.removeEventListener("pacana:trigger-emote", handleTriggerEmote);
    };
  }, [isFloating, isDockedContainer, npc, onToggleFloating, cushionSeedState]);

  // Idle cycle while docked on cushion: naturally alternates between sleeping and reading a book
  useEffect(() => {
    if (!isDockedContainer || isFloating) return;

    let timer: NodeJS.Timeout;

    const scheduleNext = () => {
      // Rotate between sleeping (with Zzz) and reading a book every 10 to 18 seconds
      const delay = 10000 + Math.random() * 8000;
      timer = setTimeout(() => {
        setDockedPose((curr) => {
          if (curr === "sleep") {
            // Wake up, stretch for 1s, then sit and read a book!
            setTimeout(() => {
              setDockedPose("read");
            }, 1000);
            return "stretch";
          } else if (curr === "read" || curr === "idle") {
            // Settle down for a cozy nap!
            return "sleep";
          }
          return curr;
        });
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => {
      clearTimeout(timer);
    };
  }, [isDockedContainer, isFloating]);

  // Docked petting handler
  const handleDockedPet = () => {
    setDockedPose("pet");
    setDockedHearts(true);
    setDockedSprout(false);
    setDockedZzz(false);
    playCompanionSound("pet");
    setTimeout(() => {
      setDockedHearts(false);
      setDockedPose(Math.random() < 0.5 ? "sleep" : "read");
    }, 1800);
  };

  // 1. Docked Cappy Drag Handler (Smooth Portal Drag across entire screen)
  const handleDockedPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Primary button only
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = rootRef.current?.getBoundingClientRect();
    const offsetX = rect ? e.clientX - rect.left : 38;
    const offsetY = rect ? e.clientY - rect.top : 38;

    let isDragging = false;
    let lastX = e.clientX;
    let currentDropPos = {
      x: rect ? rect.left : e.clientX - 38,
      y: rect ? rect.top : e.clientY - 38,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!isDragging && Math.hypot(dx, dy) > 4) {
        isDragging = true;
      }

      if (isDragging) {
        const facing = moveEvent.clientX >= lastX ? "right" : "left";
        lastX = moveEvent.clientX;

        const rawX = moveEvent.clientX - offsetX;
        const rawY = moveEvent.clientY - offsetY;
        const clampedX = Math.max(8, Math.min(window.innerWidth - 84, rawX));
        const clampedY = Math.max(8, Math.min(window.innerHeight - 84, rawY));

        currentDropPos = { x: clampedX, y: clampedY };
        setDockedDrag({
          x: clampedX,
          y: clampedY,
          facing,
        });
      }
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);

      if (!isDragging) {
        // Direct click without dragging -> pet interaction
        handleDockedPet();
      } else {
        // Drag release -> drop on screen and start wandering
        setDockedDrag(null);
        playCompanionSound("drop");

        const finalPos = currentDropPos;
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "pacana:companion:pos",
            JSON.stringify(finalPos)
          );
        }
        updateCushionSeed("none");
        onToggleFloating(true, finalPos);
        window.dispatchEvent(new CustomEvent("pacana:cappy-dragged-out"));
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  // 2. Floating Cappy Drag Handler (Unconstrained Screen Drag)
  const handleFloatingPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Primary button only
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = rootRef.current?.getBoundingClientRect();
    const offsetX = rect ? e.clientX - rect.left : 38;
    const offsetY = rect ? e.clientY - rect.top : 38;

    let isDragging = false;

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!isDragging && Math.hypot(dx, dy) > 4) {
        isDragging = true;
        dragRef.current.isDragging = true;
        npc.startDrag(npc.pos);
      }

      if (isDragging) {
        const rawX = moveEvent.clientX - offsetX;
        const rawY = moveEvent.clientY - offsetY;
        npc.updateDrag({ x: rawX, y: rawY });
      }
    };

    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);

      const wasDragging = isDragging;
      dragRef.current.isDown = false;
      dragRef.current.isDragging = false;

      if (wasDragging) {
        // Check if dropped onto the sidebar cushion
        const cushionEl = document.querySelector(".docked-companion-empty");
        if (cushionEl) {
          const cr = cushionEl.getBoundingClientRect();
          const dropCenterX = upEvent.clientX;
          const dropCenterY = upEvent.clientY;
          if (
            dropCenterX >= cr.left &&
            dropCenterX <= cr.right &&
            dropCenterY >= cr.top &&
            dropCenterY <= cr.bottom
          ) {
            onToggleFloating(false);
            playCompanionSound("pet");
            return;
          }
        }
        npc.endDrag(true);
      } else {
        // Direct click
        if (npc.mode === "resting") {
          npc.wakeUp();
        } else {
          npc.triggerPet();
        }
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  // A. If this is the docked container, and Capy is exploring the screen:
  if (isDockedContainer && isFloating) {
    return (
      <div className="docked-companion-empty" data-capybara-target="home">
        <div className="docked-companion-stage">
          <div
            className={`empty-cushion ${
              cushionSeedState.stage === "ready" ? "has-ready-plant" : ""
            }`}
            aria-hidden="true"
          >
            <CushionSeed
              stage={cushionSeedState.stage}
              treeStage={cushionSeedState.treeStage}
            />
          </div>
        </div>
        <div className="docked-actions">
          {floatingStatus.mode === "walk_home" ? (
            <button
              type="button"
              className="dock-call-btn is-active"
              title="Click to cancel and let Cappy wander"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("pacana:cancel-to-wander"));
              }}
            >
              <Move size={13} />
              <span>Capy is on the way...</span>
            </button>
          ) : floatingStatus.mode === "resting" ? (
            <button
              type="button"
              className="dock-call-btn"
              title="Click to wake Cappy"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("pacana:cappy-wake"));
              }}
            >
              <Home size={13} />
              <span>Capy is resting...</span>
            </button>
          ) : floatingStatus.mode === "walk_to_snack" || floatingStatus.mode === "eating" ? (
            <button
              type="button"
              className="dock-call-btn"
              disabled
            >
              <Home size={13} />
              <span>Capy is getting his snack...</span>
            </button>
          ) : (
            <button
              type="button"
              className="dock-call-btn"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("pacana:call-cappy-home"));
              }}
            >
              <Home size={13} />
              <span>Call Capy home</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // B. If this is the floating overlay instance, but Capy is docked:
  if (!isDockedContainer && !isFloating) {
    return null;
  }

  // C. Stationary Docked Cappy in the sidebar (or actively dragging out of dock)
  if (isDockedContainer) {
    return (
      <>
        {dockedDrag ? (
          <div className="docked-companion-empty is-lifted" data-capybara-target="home">
            <div className="docked-companion-stage">
              <div className="empty-cushion" aria-hidden="true">
                <CushionSeed stage="none" treeStage={1} />
              </div>
            </div>
            <div className="docked-actions" style={{ visibility: "hidden" }}>
              <button type="button" className="companion-wander-btn" disabled>
                Let Capy wander
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={rootRef}
            className={`interactive-companion is-docked ${isGettingUp ? "is-getting-up" : ""}`}
            data-capybara-target="home"
            onPointerDown={handleDockedPointerDown}
            title="Click to pet Capy · Drag out to explore · Or click button below"
          >
            <div className="docked-companion-stage">
              <CapySprite
                pose={dockedPose}
                facing="right"
                showSprout={dockedSprout}
                showHearts={dockedHearts}
                showZzz={dockedPose === "sleep"}
                size={76}
                isFloating={false}
                onAnimationComplete={() => {
                  if (dockedPose === "shout") {
                    setDockedPose("idle");
                  }
                }}
              />
            </div>

            <div className="docked-actions">
              <button
                type="button"
                className={`companion-wander-btn ${isGettingUp ? "is-getting-up" : ""}`}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGettingUp}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isGettingUp) return;

                  // 1. Getting up & planting seed sequence on the cushion
                  setIsGettingUp(true);
                  setDockedPose("plant"); // 8-frame planting animation
                  playCompanionSound("pop");

                  // 2. Show hearts & update cushion seed as planting concludes
                  setTimeout(() => {
                    updateCushionSeed("planted", 2);
                    setDockedHearts(true);
                    playCompanionSound("pet");
                  }, 900);

                  // 3. Step out into wandering mode reliably
                  setTimeout(() => {
                    setIsGettingUp(false);
                    setDockedHearts(false);
                    setDockedPose("idle");

                    const rect = rootRef.current?.getBoundingClientRect();
                    const isCushionOnRight = rect ? rect.left > 300 : true;
                    const startPos = rect
                      ? {
                          x: isCushionOnRight
                            ? Math.max(24, rect.left - 96)
                            : Math.max(24, rect.right + 12),
                          y: Math.max(48, rect.top),
                        }
                      : undefined;
                    onToggleFloating(true, startPos);
                  }, 1500);
                }}
              >
                <Move size={13} />
                <span>{isGettingUp ? "Planting seed..." : "Let Capy wander"}</span>
              </button>
            </div>
          </div>
        )}

        {dockedDrag &&
          typeof document !== "undefined" &&
          document.body &&
          createPortal(
            <div
              className="interactive-companion is-screen-floating mode-dragged"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                transform: `translate3d(${dockedDrag.x}px, ${dockedDrag.y}px, 0)`,
                zIndex: 99999,
                pointerEvents: "none",
                cursor: "grabbing",
                filter: "drop-shadow(0 12px 28px rgba(25, 45, 30, 0.28))",
              }}
            >
              <CapySprite
                pose="drag"
                facing={dockedDrag.facing}
                size={76}
                isFloating={true}
              />
            </div>,
            document.body
          )}
      </>
    );
  }

  // D. Floating Autonomous Companion across the entire screen
  return (
    <>
      {/* Active Leaf on screen (if spawned) */}
      {npc.activeLeaf && (
        <CapyLeaf
          leaf={npc.activeLeaf}
          onLeafClick={() => {
            if (npc.activeLeaf) {
              npc.startApproachingReadyLeaf(npc.activeLeaf);
            }
          }}
        />
      )}

      {/* Autonomous Wandering Cappy */}
      <div
        ref={rootRef}
        className={`interactive-companion is-screen-floating ${
          npc.landingBounce ? "landing-bounce" : ""
        } mode-${npc.mode}`}
        style={{
          transform: `translate3d(${npc.pos.x}px, ${npc.pos.y}px, 0)`,
        }}
        onPointerDown={handleFloatingPointerDown}
        onMouseEnter={() => {
          if (!npc.activeEmote) {
            setMenuSuppressed(false);
            setIsHovered(true);
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setMenuSuppressed(false);
        }}
        onDoubleClick={() => {
          window.dispatchEvent(new CustomEvent("pacana:call-cappy-home"));
        }}
        title="Click to interact / wake · Drag anywhere · Double-click to call home"
      >
        {/* Floating Multi-Option Menu in Higher Position */}
        {isHovered && !menuSuppressed && !dragRef.current.isDragging && !npc.activeEmote && (
          <div
            className="capy-floating-controls-wrapper"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <CapyMenu
              isResting={npc.mode === "resting"}
              onSelectEmote={(type) =>
                handleMenuAction(() => npc.triggerEmote(type))
              }
              onToggleRest={() => handleMenuAction(() => npc.toggleSleep())}
              onSpawnSnack={() => handleMenuAction(() => npc.spawnLeaf())}
              onPressFocus={() => handleMenuAction(() => npc.startPressFocus())}
            />
            <button
              type="button"
              className="capy-dock-shortcut-btn"
              title="Return Capy home to cushion"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleMenuAction(() => {
                  window.dispatchEvent(new CustomEvent("pacana:call-cappy-home"));
                });
              }}
            >
              <Home size={18} strokeWidth={2.2} />
            </button>
          </div>
        )}

        {/* Temporary Emote Speech Bubble in Higher Position */}
        {npc.activeEmote && !dragRef.current.isDragging && (
          <div className="capy-floating-emote-wrapper">
            <CapyEmoteBubble type={npc.activeEmote.type} />
          </div>
        )}

        {/* Character Sprite with compact proportions (~76px) */}
        <CapySprite
          pose={npc.pose}
          facing={npc.facing}
          showHearts={npc.showHearts}
          showZzz={npc.showZzz}
          size={76}
          isFloating={true}
          onFrame={npc.onFrame}
          onAnimationComplete={npc.onAnimationComplete}
        />
      </div>
    </>
  );
}
