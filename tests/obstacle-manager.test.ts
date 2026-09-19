import test from "node:test";
import assert from "node:assert/strict";
import {
  segmentIntersectsBox,
  isPathClear,
  findPathAroundObstacles,
  getRandomSafePoint,
  isPointInObstacles,
  Point,
  Rect,
} from "../lib/capy-npc/obstacle-manager";

test("detects line segment intersecting axis-aligned bounding box", () => {
  // Box from (100, 100) to (200, 200)
  const intersects = segmentIntersectsBox(
    { x: 50, y: 150 },
    { x: 250, y: 150 },
    100,
    200,
    100,
    200
  );
  assert.equal(intersects, true);

  const clear = segmentIntersectsBox(
    { x: 50, y: 50 },
    { x: 250, y: 50 },
    100,
    200,
    100,
    200
  );
  assert.equal(clear, false);
});

test("checks line of sight with obstacle clearances", () => {
  const obstacle: Rect = {
    left: 300,
    top: 200,
    right: 500,
    bottom: 400,
    width: 200,
    height: 200,
  };

  const obstructed = isPathClear(
    { x: 100, y: 300 },
    { x: 700, y: 300 },
    [obstacle],
    20,
    20
  );
  assert.equal(obstructed, false);

  const clear = isPathClear(
    { x: 100, y: 50 },
    { x: 700, y: 50 },
    [obstacle],
    20,
    20
  );
  assert.equal(clear, true);
});

test("calculates corner waypoints to steer around obstacles", () => {
  // Obstacle right in the middle
  const obstacle: Rect = {
    left: 400,
    top: 200,
    right: 600,
    bottom: 400,
    width: 200,
    height: 200,
  };

  const start: Point = { x: 200, y: 300 };
  const goal: Point = { x: 800, y: 300 };
  const viewport = { width: 1000, height: 600 };

  const path = findPathAroundObstacles(
    start,
    goal,
    [obstacle],
    viewport,
    20,
    20
  );

  assert.ok(path.length >= 1);
  // Path should end at goal
  assert.deepEqual(path[path.length - 1], goal);
  // If it steered around, all segments should have clear line of sight
  for (let i = 0; i < path.length - 1; i++) {
    assert.equal(
      isPathClear(path[i], path[i + 1], [obstacle], 20, 20),
      true,
      `Segment ${i} should be clear`
    );
  }
});

test("generates random safe points away from obstacles", () => {
  const obstacle: Rect = {
    left: 200,
    top: 100,
    right: 800,
    bottom: 500,
    width: 600,
    height: 400,
  };
  const viewport = { width: 1000, height: 700 };

  for (let i = 0; i < 20; i++) {
    const pt = getRandomSafePoint([obstacle], viewport, 30, 30);
    assert.equal(
      isPointInObstacles(pt, [obstacle], 30, 30),
      false,
      "Safe point must not be inside obstacle"
    );
  }
});
