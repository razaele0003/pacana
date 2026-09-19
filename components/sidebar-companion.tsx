"use client";
import React from "react";
import InteractiveCompanion from "./interactive-companion";

interface SidebarCompanionProps {
  pose?: string;
  isFloating?: boolean;
  onToggleFloating?: (floating: boolean, dropPos?: { x: number; y: number }) => void;
}

export default function SidebarCompanion({
  pose = "idle",
  isFloating = false,
  onToggleFloating = () => {},
}: SidebarCompanionProps) {
  return (
    <InteractiveCompanion
      isFloating={isFloating}
      onToggleFloating={onToggleFloating}
      externalPose={pose}
      isDockedContainer={true}
    />
  );
}
