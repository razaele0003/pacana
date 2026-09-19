"use client";
import React from "react";
import { EmoteType } from "../lib/capy-npc/autonomous-controller";

interface CapyEmoteBubbleProps {
  type: EmoteType;
}

export default function CapyEmoteBubble({ type }: CapyEmoteBubbleProps) {
  // Only thinking (💭) and reading (📖) emojis are displayed per user requirements
  if (type !== "thinking" && type !== "reading" && type !== "read") {
    return null;
  }

  return (
    <div className={`capy-emote-bubble emote-${type}`} aria-hidden="true">
      <div className="emote-bubble-content">
        {type === "thinking" ? (
          <span className="emote-icon icon-thinking">💭</span>
        ) : (
          <span className="emote-icon icon-reading">📖</span>
        )}
      </div>
      <div className="emote-bubble-tail" />
    </div>
  );
}
