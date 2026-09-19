"use client";
import React from "react";
import { EmoteType } from "../lib/capy-npc/autonomous-controller";

interface CapyEmoteBubbleProps {
  type: EmoteType;
}

export default function CapyEmoteBubble({ type }: CapyEmoteBubbleProps) {
  const renderIcon = () => {
    switch (type) {
      case "snack":
        return <span className="emote-icon icon-snack">🍃</span>;
      case "happy":
        return <span className="emote-icon icon-happy">❤️</span>;
      case "curious":
        return <span className="emote-icon icon-curious">✨</span>;
      case "excited":
        return <span className="emote-icon icon-excited">❗</span>;
      case "eating":
        return <span className="emote-icon icon-eating">🌿</span>;
      case "thinking":
        return <span className="emote-icon icon-thinking">💭</span>;
      case "rest":
        return <span className="emote-icon icon-rest">🌙</span>;
      default:
        return null;
    }
  };

  return (
    <div className={`capy-emote-bubble emote-${type}`} aria-hidden="true">
      <div className="emote-bubble-content">{renderIcon()}</div>
      <div className="emote-bubble-tail" />
    </div>
  );
}
