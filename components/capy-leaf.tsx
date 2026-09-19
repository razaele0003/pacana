"use client";
import React from "react";
import { SpawnedLeaf } from "../lib/capy-npc/autonomous-controller";

interface CapyLeafProps {
  leaf: SpawnedLeaf;
  onLeafClick?: () => void;
}

export default function CapyLeaf({ leaf, onLeafClick }: CapyLeafProps) {
  const isReady = leaf.stage === "ready" || (leaf.treeStage !== undefined && leaf.treeStage >= 10);
  const stageNum = Math.max(
    1,
    Math.min(
      10,
      leaf.treeStage ?? (leaf.stage === "sprouting" ? 2 : leaf.stage === "growing" ? 6 : 10)
    )
  );
  const treeSrc = `/art/tree/tree-${stageNum}.png`;

  return (
    <div
      className={`cappy-spawned-leaf stage-${leaf.stage} stage-tree-${stageNum} ${
        leaf.isBeingEaten ? "is-being-eaten" : ""
      } ${isReady ? "is-ready" : ""}`}
      style={{
        left: `${leaf.x}px`,
        top: `${leaf.y}px`,
      }}
      onClick={onLeafClick}
      title={isReady ? "Blossoming snack is ready for Cappy!" : `Tree is growing (stage ${stageNum}/10)...`}
    >
      {/* Beacon ring only shines when plant is fully grown / ready */}
      {isReady && !leaf.isBeingEaten && (
        <div className="leaf-beacon-ring" aria-hidden="true" />
      )}

      {/* Main leaf artwork with bottom-anchored growth scaling */}
      <div className="leaf-art-wrapper">
        <img
          src={treeSrc}
          alt={`Growing tree snack stage ${stageNum}`}
          className={`leaf-sprite-img tree-img-${stageNum}`}
          draggable={false}
        />
      </div>

      {/* Crumbs / flower petals burst when being eaten */}
      {leaf.isBeingEaten && (
        <div className="leaf-eating-burst" aria-hidden="true">
          <span className="nibble n1">✦</span>
          <span className="nibble n2">🌸</span>
          <span className="nibble n3">✦</span>
        </div>
      )}
    </div>
  );
}
