"use client";
import React from "react";
import { EmoteType } from "../lib/capy-npc/autonomous-controller";

interface CapyMenuProps {
  isResting: boolean;
  onSelectEmote: (type: EmoteType) => void;
  onToggleRest: () => void;
  onSpawnSnack: () => void;
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
      {/* 1. Snack / Planting */}
      <button
        type="button"
        className="capy-menu-btn"
        title="Plant a tree snack (grows blossoming tree)"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSpawnSnack();
        }}
      >
        <span className="menu-emoji">🌱</span>
      </button>


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

      {/* 4. Curious emote */}
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

      {/* 5. Rest / Wake toggle */}
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
