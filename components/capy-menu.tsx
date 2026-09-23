"use client";
import React from "react";
import { EmoteType } from "../lib/capy-npc/autonomous-controller";
import { preloadCelebrationAudio } from "../lib/companion-sound";

interface CapyMenuProps {
  isResting: boolean;
  onSelectEmote: (type: EmoteType) => void;
  onToggleRest: () => void;
  onSpawnSnack?: () => void;
  onPressFocus?: () => void;
}

export default function CapyMenu({
  isResting,
  onSelectEmote,
  onToggleRest,
  onSpawnSnack,
  onPressFocus,
}: CapyMenuProps) {
  return (
    <div
      className="capy-multi-menu"
      role="toolbar"
      aria-label="Cappy interaction options"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Leaf / Tree snack for Capy to eat */}
      {onSpawnSnack && (
        <button
          type="button"
          className="capy-menu-btn"
          title="Sprout a tree snack for Cappy to eat"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSpawnSnack();
          }}
        >
          <span className="menu-emoji">🌱</span>
        </button>
      )}


      {/* 3. Happy emote */}
      <button
        type="button"
        className="capy-menu-btn"
        title="Happy (give love to Cappy)"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEmote("happy");
        }}
      >
        <span className="menu-emoji">❤️</span>
      </button>

      {/* 3. Curious emote */}
      <button
        type="button"
        className="capy-menu-btn"
        title="Curious (sparkle curiosity)"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEmote("curious");
        }}
      >
        <span className="menu-emoji">✨</span>
      </button>

      {/* 4. Reading interaction */}
      <button
        type="button"
        className="capy-menu-btn"
        title="Read (cozy book reading)"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEmote("reading");
        }}
      >
        <span className="menu-emoji">📖</span>
      </button>

      {/* 5. Breakdance celebration */}
      <button
        type="button"
        className="capy-menu-btn"
        title="Breakdance (celebration dance)"
        onPointerEnter={() => preloadCelebrationAudio()}
        onMouseEnter={() => preloadCelebrationAudio()}
        onPointerDown={(e) => {
          preloadCelebrationAudio();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEmote("dance");
        }}
      >
        <span className="menu-emoji">🕺</span>
      </button>

      {/* 6. Rest / Wake toggle */}
      <button
        type="button"
        className={`capy-menu-btn ${isResting ? "is-active" : ""}`}
        title={isResting ? "Wake Cappy" : "Let Cappy rest"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleRest();
        }}
      >
        <span className="menu-emoji">{isResting ? "☀️" : "🌙"}</span>
      </button>

      <div className="capy-menu-tail" aria-hidden="true" />
    </div>
  );
}
