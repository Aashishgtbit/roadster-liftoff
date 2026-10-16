// Every random course must be fair: inside the track, in order, with room between obstacles.
import { describe, expect, it } from "vitest";
import { FINISH_X, TRACK_HALF_WIDTH } from "../src/config";
import { generateLayout, obstacleFor } from "../src/game/layout";

const SEEDS = Array.from({ length: 300 }, (_, i) => 1 + i * 7919);

describe("course layouts", () => {
  it("are the same for the same seed", () => {
    expect(generateLayout(12345)).toEqual(generateLayout(12345));
  });

  it("never open with a ramp into a wall", () => {
    for (const seed of SEEDS) {
      const [first, second] = generateLayout(seed);
      expect(first.kind === "ramp" && second.kind === "wall", `seed ${seed}`).toBe(false);
    }
  });

  it("keep everything between the start and the finish, inside the barriers", () => {
    for (const seed of SEEDS) for (const item of generateLayout(seed)) {
      expect(item.x, `seed ${seed}`).toBeGreaterThan(20);
      expect(item.x, `seed ${seed}`).toBeLessThan(FINISH_X);
      const obstacle = obstacleFor(item);
      if (obstacle) { expect(obstacle.minZ).toBeGreaterThan(-TRACK_HALF_WIDTH); expect(obstacle.maxZ).toBeLessThan(TRACK_HALF_WIDTH); }
      else if (item.kind === "can") expect(Math.abs(item.z)).toBeLessThan(TRACK_HALF_WIDTH - 2);
    }
  });

  it("leave room to land and line up between obstacles", () => {
    for (const seed of SEEDS) {
      const obstacles = generateLayout(seed).map(obstacleFor).filter(o => o !== null);
      for (let i = 1; i < obstacles.length; i++) {
        const before = obstacles[i - 1], after = obstacles[i], gap = after.minX - before.maxX;
        // a kicker ramp launches straight over the wall 9 m after it; everything else is at least 24 m apart
        const pair = before.kind === "ramp" && after.kind === "wall";
        expect(gap, `seed ${seed}: ${before.id} to ${after.id}`).toBeGreaterThanOrEqual(pair ? 8.9 : 24);
      }
    }
  });
});
