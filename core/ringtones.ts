// SPDX-License-Identifier: MIT
// Original synthesized ringtone definitions; no recordings or external downloads.
export const ringtones = [
  {
    id: "classic",
    name: "Gentle chime",
    notes: [660, 880],
    step: 0.18,
    length: 0.6,
    wave: "sine",
  },
  {
    id: "woodland",
    name: "Woodland bells",
    notes: [523.25, 659.25, 783.99],
    step: 0.22,
    length: 0.8,
    wave: "sine",
  },
  {
    id: "raindrop",
    name: "Little raindrops",
    notes: [1174.66, 987.77, 783.99],
    step: 0.16,
    length: 0.35,
    wave: "sine",
  },
  {
    id: "sunrise",
    name: "Soft sunrise",
    notes: [392, 493.88, 587.33, 783.99],
    step: 0.25,
    length: 0.7,
    wave: "triangle",
  },
] as const;
export type Ringtone = (typeof ringtones)[number]["id"] | "custom";
