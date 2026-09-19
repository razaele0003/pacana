export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ViewportBounds {
  width: number;
  height: number;
}

export const CAPPY_WIDTH = 88;
export const CAPPY_HEIGHT = 88;
export const CAPPY_HALF_WIDTH = 44;
export const CAPPY_HALF_HEIGHT = 44;
export const OBSTACLE_SAFETY_BUFFER = 18;

// Total clearance half-extents
export const CLEARANCE_X = CAPPY_HALF_WIDTH + OBSTACLE_SAFETY_BUFFER; // ~62px
export const CLEARANCE_Y = CAPPY_HALF_HEIGHT + OBSTACLE_SAFETY_BUFFER; // ~62px
export const WALL_MARGIN_X = 24; // Breathing room from walls and scrollbars
export const WALL_MARGIN_Y = 20;

/**
 * Line segment vs Axis-Aligned Bounding Box (AABB) intersection check using slab method
 */
export function segmentIntersectsBox(
  p1: Point,
  p2: Point,
  boxMinX: number,
  boxMaxX: number,
  boxMinY: number,
  boxMaxY: number
): boolean {
  // If either endpoint is inside the box, it intersects
  if (
    p1.x >= boxMinX &&
    p1.x <= boxMaxX &&
    p1.y >= boxMinY &&
    p1.y <= boxMaxY
  ) {
    return true;
  }
  if (
    p2.x >= boxMinX &&
    p2.x <= boxMaxX &&
    p2.y >= boxMinY &&
    p2.y <= boxMaxY
  ) {
    return true;
  }

  let tmin = 0.0;
  let tmax = 1.0;

  const dx = p2.x - p1.x;
  if (Math.abs(dx) < 1e-7) {
    if (p1.x < boxMinX || p1.x > boxMaxX) return false;
  } else {
    const ood = 1.0 / dx;
    let t1 = (boxMinX - p1.x) * ood;
    let t2 = (boxMaxX - p1.x) * ood;
    if (t1 > t2) {
      const temp = t1;
      t1 = t2;
      t2 = temp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  const dy = p2.y - p1.y;
  if (Math.abs(dy) < 1e-7) {
    if (p1.y < boxMinY || p1.y > boxMaxY) return false;
  } else {
    const ood = 1.0 / dy;
    let t1 = (boxMinY - p1.y) * ood;
    let t2 = (boxMaxY - p1.y) * ood;
    if (t1 > t2) {
      const temp = t1;
      t1 = t2;
      t2 = temp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}

/**
 * Scan DOM for UI obstacles and return their screen coordinates
 */
export function queryUIObstacles(): {
  obstacles: Rect[];
  viewport: ViewportBounds;
} {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      obstacles: [],
      viewport: { width: 1200, height: 800 },
    };
  }

  // Use client dimensions to exclude window scrollbars so Cappy never overlaps scrollbars
  const clientW = document.documentElement.clientWidth || window.innerWidth;
  const clientH = document.documentElement.clientHeight || window.innerHeight;
  const viewport: ViewportBounds = {
    width: Math.min(window.innerWidth, clientW),
    height: Math.min(window.innerHeight, clientH),
  };

  const selectors = [
    "[data-capybara-obstacle]",
    "aside.sidebar",
    "header.topbar",
    ".desktop-titlebar",
    ".timer-card",
    ".scoreboard-card",
    ".dialog",
    ".modal",
    ".modal-card",
    ".focus-side",
    ".grow-card",
    ".fullscreen-actions",
  ];

  const elements = document.querySelectorAll(selectors.join(", "));
  const rawRects: Rect[] = [];

  elements.forEach((el) => {
    // Skip if hidden or detached
    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return;
    }

    const rect = el.getBoundingClientRect();
    // Only consider non-empty elements visible within or near viewport
    if (
      rect.width > 20 &&
      rect.height > 20 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < viewport.width &&
      rect.top < viewport.height
    ) {
      rawRects.push({
        left: Math.max(0, rect.left),
        top: Math.max(0, rect.top),
        right: Math.min(viewport.width, rect.right),
        bottom: Math.min(viewport.height, rect.bottom),
        width: rect.width,
        height: rect.height,
      });
    }
  });

  // Merge heavily overlapping boxes to reduce pathfinding complexity
  const merged: Rect[] = [];
  for (const r of rawRects) {
    let absorbed = false;
    for (let i = 0; i < merged.length; i++) {
      const m = merged[i];
      // If r is completely inside m
      if (
        r.left >= m.left &&
        r.right <= m.right &&
        r.top >= m.top &&
        r.bottom <= m.bottom
      ) {
        absorbed = true;
        break;
      }
    }
    if (!absorbed) {
      merged.push(r);
    }
  }

  return { obstacles: merged, viewport };
}

/**
 * Check if a point is inside an expanded obstacle box
 */
export function isPointInObstacles(
  pt: Point,
  obstacles: Rect[],
  hx = CLEARANCE_X,
  hy = CLEARANCE_Y
): boolean {
  for (const obs of obstacles) {
    if (
      pt.x >= obs.left - hx &&
      pt.x <= obs.right + hx &&
      pt.y >= obs.top - hy &&
      pt.y <= obs.bottom + hy
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a point is safely inside the screen bounds
 */
export function isPointInBounds(
  pt: Point,
  viewport: ViewportBounds,
  hx = CLEARANCE_X,
  hy = CLEARANCE_Y
): boolean {
  const minX = Math.max(WALL_MARGIN_X, hx);
  const maxX = Math.max(minX, viewport.width - CAPPY_WIDTH - WALL_MARGIN_X);
  const minY = Math.max(48, hy);
  const maxY = Math.max(minY, viewport.height - CAPPY_HEIGHT - WALL_MARGIN_Y);
  return (
    pt.x >= minX &&
    pt.x <= maxX &&
    pt.y >= minY &&
    pt.y <= maxY
  );
}

/**
 * Find a random valid safe location on the screen that does NOT intersect UI obstacles
 */
export function getRandomSafePoint(
  obstacles: Rect[],
  viewport: ViewportBounds,
  hx = CLEARANCE_X,
  hy = CLEARANCE_Y,
  maxTries = 40,
  preferredSide?: "left" | "right" | "center"
): Point {
  let minX = Math.max(WALL_MARGIN_X, hx);
  let maxX = Math.max(minX + 40, viewport.width - CAPPY_WIDTH - WALL_MARGIN_X);
  const minY = Math.max(48, hy + 24);
  const maxY = Math.max(minY + 40, viewport.height - CAPPY_HEIGHT - WALL_MARGIN_Y);

  if (preferredSide === "left") {
    // Bias target generation towards the left/center of the screen
    maxX = Math.max(minX + 60, Math.min(maxX, viewport.width * 0.52));
  } else if (preferredSide === "right") {
    // Bias target generation towards the right/center of the screen
    minX = Math.min(maxX - 60, Math.max(minX, viewport.width * 0.48));
  }

  for (let i = 0; i < maxTries; i++) {
    const candidate: Point = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };

    if (!isPointInObstacles(candidate, obstacles, hx, hy)) {
      return candidate;
    }
  }

  // Fallback points biased by preferred side, keeping away from walls
  const midX = (minX + maxX) * 0.5;
  const midY = (minY + maxY) * 0.5;

  const fallbacks: Point[] =
    preferredSide === "left"
      ? [
          { x: minX + 50, y: midY },
          { x: minX + 80, y: maxY - 50 },
          { x: minX + 50, y: minY + 50 },
          { x: midX, y: midY },
        ]
      : preferredSide === "right"
      ? [
          { x: maxX - 50, y: midY },
          { x: maxX - 80, y: maxY - 50 },
          { x: maxX - 50, y: minY + 50 },
          { x: midX, y: midY },
        ]
      : [
          { x: midX, y: midY },
          { x: minX + 60, y: midY },
          { x: maxX - 60, y: midY },
          { x: midX, y: maxY - 50 },
        ];

  for (const fb of fallbacks) {
    if (!isPointInObstacles(fb, obstacles, hx * 0.65, hy * 0.65)) {
      return fb;
    }
  }

  return fallbacks[0];
}

/**
 * Checks if the line of sight between two points is completely clear of obstacles
 */
export function isPathClear(
  p1: Point,
  p2: Point,
  obstacles: Rect[],
  hx = CLEARANCE_X,
  hy = CLEARANCE_Y
): boolean {
  for (const obs of obstacles) {
    if (
      segmentIntersectsBox(
        p1,
        p2,
        obs.left - hx,
        obs.right + hx,
        obs.top - hy,
        obs.bottom + hy
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Generate waypoints that steer around obstacles using corner visibility graph + A*
 */
export function findPathAroundObstacles(
  start: Point,
  goal: Point,
  obstacles: Rect[],
  viewport: ViewportBounds,
  hx = CLEARANCE_X,
  hy = CLEARANCE_Y
): Point[] {
  // Ignore obstacles that enclose either the start point or the goal point
  // (such as stepping out of the cushion or targeting a button inside the timer card)
  const effectiveObstacles = obstacles.filter(
    (obs) =>
      !(
        (start.x >= obs.left - 4 &&
          start.x <= obs.right + 4 &&
          start.y >= obs.top - 4 &&
          start.y <= obs.bottom + 4) ||
        (goal.x >= obs.left - 4 &&
          goal.x <= obs.right + 4 &&
          goal.y >= obs.top - 4 &&
          goal.y <= obs.bottom + 4)
      )
  );

  // If direct path is unobstructed, return goal directly
  if (isPathClear(start, goal, effectiveObstacles, hx, hy)) {
    return [goal];
  }

  // Collect corner waypoints around each obstacle with clearance offset
  const waypoints: Point[] = [];
  const offset = 8; // Extra breathing room around corners

  for (const obs of effectiveObstacles) {
    const corners: Point[] = [
      { x: obs.left - hx - offset, y: obs.top - hy - offset },
      { x: obs.right + hx + offset, y: obs.top - hy - offset },
      { x: obs.right + hx + offset, y: obs.bottom + hy + offset },
      { x: obs.left - hx - offset, y: obs.bottom + hy + offset },
    ];

    for (const corner of corners) {
      // Clamp within viewport
      const clamped: Point = {
        x: Math.max(hx, Math.min(viewport.width - hx, corner.x)),
        y: Math.max(hy, Math.min(viewport.height - hy, corner.y)),
      };

      // Check if corner is inside another obstacle
      if (!isPointInObstacles(clamped, effectiveObstacles, hx * 0.9, hy * 0.9)) {
        waypoints.push(clamped);
      }
    }
  }

  // Build node list: index 0 = start, index N-1 = goal
  const nodes: Point[] = [start, ...waypoints, goal];
  const goalIndex = nodes.length - 1;

  // A* implementation
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  interface SearchNode {
    index: number;
    g: number;
    f: number;
  }

  const openSet: SearchNode[] = [{ index: 0, g: 0, f: dist(start, goal) }];
  const cameFrom: Map<number, number> = new Map();
  const gScores: Map<number, number> = new Map();
  gScores.set(0, 0);

  const closedSet = new Set<number>();

  while (openSet.length > 0) {
    // Pick lowest f
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (current.index === goalIndex) {
      // Reconstruct path
      const path: Point[] = [];
      let curr = goalIndex;
      while (cameFrom.has(curr)) {
        path.unshift(nodes[curr]);
        curr = cameFrom.get(curr)!;
      }
      return path.length > 0 ? path : [goal];
    }

    closedSet.add(current.index);

    // Evaluate neighbors that have clear line-of-sight
    for (let neighborIdx = 0; neighborIdx < nodes.length; neighborIdx++) {
      if (neighborIdx === current.index || closedSet.has(neighborIdx)) continue;

      const pCurrent = nodes[current.index];
      const pNeighbor = nodes[neighborIdx];

      // If current node is the start point and is already close to an obstacle,
      // allow stepping out towards corners without being blocked by its own starting proximity
      const isStartNode = current.index === 0;
      const relevantObstacles = isStartNode
        ? effectiveObstacles.filter(
            (obs) =>
              !(
                pCurrent.x >= obs.left - hx - 4 &&
                pCurrent.x <= obs.right + hx + 4 &&
                pCurrent.y >= obs.top - hy - 4 &&
                pCurrent.y <= obs.bottom + hy + 4
              )
          )
        : effectiveObstacles;

      if (!isPathClear(pCurrent, pNeighbor, relevantObstacles, hx, hy)) {
        continue;
      }

      const tentativeG = current.g + dist(pCurrent, pNeighbor);
      const prevG = gScores.get(neighborIdx) ?? Infinity;

      if (tentativeG < prevG) {
        cameFrom.set(neighborIdx, current.index);
        gScores.set(neighborIdx, tentativeG);
        const f = tentativeG + dist(pNeighbor, goal);

        const existingOpen = openSet.find((item) => item.index === neighborIdx);
        if (existingOpen) {
          existingOpen.g = tentativeG;
          existingOpen.f = f;
        } else {
          openSet.push({ index: neighborIdx, g: tentativeG, f });
        }
      }
    }
  }

  // If no obstacle-free corner path was completely connected, fallback to direct path
  return [goal];
}

/**
 * Samples a random safe point that is guaranteed to have a reachable path from current location
 */
export function getRandomReachableSafePoint(
  from: Point,
  obstacles: Rect[],
  viewport: ViewportBounds,
  hx = CLEARANCE_X,
  hy = CLEARANCE_Y,
  preferredSide?: "left" | "right" | "center"
): Point {
  for (let i = 0; i < 35; i++) {
    const candidate = getRandomSafePoint(
      obstacles,
      viewport,
      hx,
      hy,
      40,
      preferredSide
    );
    if (Math.hypot(candidate.x - from.x, candidate.y - from.y) < 60) {
      continue;
    }
    const path = findPathAroundObstacles(from, candidate, obstacles, viewport, hx, hy);
    if (path.length > 0) {
      return candidate;
    }
  }
  return getRandomSafePoint(obstacles, viewport, hx, hy, 40, preferredSide);
}
