// Drive it: random course layouts. Pure (no DOM, no three.js), so the tests can check every layout is fair.
import { FINISH_X } from "../config";
import type { Obstacle } from "../physics/types";

export const CRATE_SIZE = 1.2;
export const WALL_HEIGHT = 2.4, WALL_HALF_WIDTH = 8;

/** One thing on the course. */
export type CourseItem =
  | { kind: "crates"; x: number; minZ: number; columns: number; wobble: number[] }   // two rows of crates; wobble: each crate's slight turn
  | { kind: "wall"; x: number }
  | { kind: "ramp"; x: number; length: number; height: number; halfWidth: number }
  | { kind: "can"; x: number; y: number; z: number };                                 // a fuel canister

/** A repeatable pseudo-random sequence in 0..1 (Park-Miller), so a course can be replayed from its seed. */
function seededRandom(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * The layout for a seed: crate stacks to bust or dodge, walls to fly over, kicker ramps, and fuel canisters, spaced so
 * there is always room to land and line up between them.
 */
export function generateLayout(seed: number): CourseItem[] {
  const random = seededRandom(seed), items: CourseItem[] = [];
  const can = (x: number, y: number, z: number) => items.push({ kind: "can", x, y, z });
  let x = 34, first = true;
  while (x < FINISH_X - 30) {
    let pick = random();
    if (first && pick >= 0.66 && pick < 0.86) pick = 0.5;   // never open with a ramp into a wall: no run-up yet
    first = false;
    if (pick < 0.38) {
      // crate stack, sometimes off-centre so you can choose to dodge it
      const columns = 5 + Math.floor(random() * 3), minZ = -columns * 0.6 + (random() - 0.5) * 3;
      const wobble: number[] = [];
      for (let i = 0; i < 2 * columns; i++) wobble.push((random() - 0.5) * 0.08);
      items.push({ kind: "crates", x, minZ, columns, wobble });
      can(x + 5, 0.95, minZ + columns * 0.6);
      x += 26 + random() * 10;
    } else if (pick < 0.66) {
      // wall: fly over it; a fuel can floats above it
      items.push({ kind: "wall", x });
      can(x + 0.5, 4.3, (random() - 0.5) * 2);
      x += 34 + random() * 8;
    } else if (pick < 0.86) {
      // kicker ramp straight into a wall: launch over it with no fuel
      items.push({ kind: "ramp", x, length: 7, height: 1.8, halfWidth: 3.2 }, { kind: "wall", x: x + 16 });
      can(x + 16.5, 4.6, 0);
      x += 46 + random() * 8;
    } else {
      // kicker ramp with a can high in the air ahead
      items.push({ kind: "ramp", x, length: 6, height: 1.1, halfWidth: 3 });
      can(x + 16, 3.6, 0);
      x += 34 + random() * 8;
    }
    if (x < FINISH_X - 20) can(x - 10, 0.95, (random() - 0.5) * 4);
  }
  return items;
}

/** The physics shape of a course item (canisters have none: they are picked up, not hit). */
export function obstacleFor(item: CourseItem): Obstacle | null {
  const id = `${item.kind}@${item.x.toFixed(0)}`;
  switch (item.kind) {
    case "crates":
      return { id, kind: "crates", minX: item.x, maxX: item.x + CRATE_SIZE, minY: 0, maxY: 2 * CRATE_SIZE, minZ: item.minZ, maxZ: item.minZ + item.columns * CRATE_SIZE, breakable: true };
    case "wall":
      return { id, kind: "wall", minX: item.x, maxX: item.x + 1, minY: 0, maxY: WALL_HEIGHT, minZ: -WALL_HALF_WIDTH, maxZ: WALL_HALF_WIDTH };
    case "ramp":
      return { id, kind: "ramp", minX: item.x, maxX: item.x + item.length, height: item.height, minZ: -item.halfWidth, maxZ: item.halfWidth };
    case "can":
      return null;
  }
}
