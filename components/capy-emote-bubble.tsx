"use client";
import React from "react";
import { EmoteType } from "../lib/capy-npc/autonomous-controller";

interface CapyEmoteBubbleProps {
  type: EmoteType;
}

export default function CapyEmoteBubble({ type }: CapyEmoteBubbleProps) {
  // Only the thinking emoji is displayed per user request ("remove for all that pop up emoji, just leaveit for the thinking emoji ok")
  if (type !== "thinking") {
    return null;
  }

  return (
    <div className="capy-emote-bubble emote-thinking" aria-hidden="true">
      <div className="emote-bubble-content">
        <span className="emote-icon icon-thinking">💭</span>
      </div>
      <div className="emote-bubble-tail" />
    </div>
  );
}
