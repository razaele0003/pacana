"use client";
import React, { useRef, useState } from "react";
import CapySprite from "./capy-sprite";
import CapyLeaf from "./capy-leaf";
import CapyEmoteBubble from "./capy-emote-bubble";
import CapyMenu from "./capy-menu";
import { useAutonomousCapy } from "../lib/capy-npc/autonomous-controller";

export default function WanderingCapybara() {
  const [isHovered, setIsHovered] = useState(false);
  const [menuSuppressed, setMenuSuppressed] = useState(false);

  // Instantly dismiss menu on any interaction so Cappy's head & emote are clear
  const handleMenuAction = (action: () => void) => {
    setIsHovered(false);
    setMenuSuppressed(true);
    action();
  };

  const dragRef = useRef({
    isDown: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  });

  const npc = useAutonomousCapy({
    enabled: true,
    initialPos: {
      x: typeof window !== "undefined" ? window.innerWidth * 0.5 : 500,
      y: typeof window !== "undefined" ? window.innerHeight - 150 : 500,
    },
    walkSpeed: 48,
    isFullScreen: true,
  });

  // Pointer drag events
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    dragRef.current = {
      isDown: true,
      isDragging: false,
      startX: e.clientX,
      startY: e.clientY,
      initPosX: npc.pos.x,
      initPosY: npc.pos.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDown) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (!dragRef.current.isDragging && Math.hypot(dx, dy) > 6) {
      dragRef.current.isDragging = true;
      npc.startDrag({
        x: dragRef.current.initPosX,
        y: dragRef.current.initPosY,
      });
    }

    if (dragRef.current.isDragging) {
      npc.updateDrag({
        x: dragRef.current.initPosX + dx,
        y: dragRef.current.initPosY + dy,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.isDown) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const wasDragging = dragRef.current.isDragging;
    dragRef.current.isDown = false;
    dragRef.current.isDragging = false;

    if (wasDragging) {
      npc.endDrag(true);
    } else {
      if (npc.mode === "resting") {
        npc.wakeUp();
      } else {
        npc.triggerPet();
      }
    }
  };

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

      {/* Autonomous Wandering Cappy in Fullscreen View */}
      <div
        className={`fullscreen-autonomous-capy ${
          npc.landingBounce ? "landing-bounce" : ""
        } mode-${npc.mode}`}
        style={{
          transform: `translate3d(${npc.pos.x}px, ${npc.pos.y}px, 0)`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
        title="Click to interact / wake · Drag Cappy anywhere"
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
          </div>
        )}

        {/* Temporary Emote Speech Bubble in Higher Position */}
        {npc.activeEmote && !dragRef.current.isDragging && (
          <div className="capy-floating-emote-wrapper">
            <CapyEmoteBubble type={npc.activeEmote.type} />
          </div>
        )}

        <CapySprite
          pose={npc.pose}
          facing={npc.facing}
          showHearts={npc.showHearts}
          size={76}
          isFloating={true}
          onFrame={npc.onFrame}
          onAnimationComplete={npc.onAnimationComplete}
        />
      </div>
    </>
  );
}
