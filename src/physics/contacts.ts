// Where a wheel's suspension ray meets the world: the ground, the top of a box, a kicker ramp, or the inside of the
// curved ramp wall (ramp stunt).
import type { Vector3 } from "three";
import { RAMP, WHEEL_RADIUS } from "../config";
import type { Obstacle, Scenario } from "./types";

/** How far along the ray the wheel centre touches, and the surface normal there (it is always in the x-y plane). */
export interface WheelHit {
  distance: number;
  normalX: number;
  normalY: number;
}

/** The nearest surface along a ray from `origin` (the wheel's mount) in direction `dir` (the car's down). */
export function castWheelRay(origin: Vector3, dir: Vector3, scenario: Scenario, obstacles: readonly Obstacle[]): WheelHit | null {
  let best: WheelHit | null = null;
  if (-dir.y > 0.3) best = { distance: (origin.y - WHEEL_RADIUS) / -dir.y, normalX: 0, normalY: 1 };
  for (const obstacle of obstacles) {
    if (obstacle.destroyed || origin.z < obstacle.minZ || origin.z > obstacle.maxZ) continue;
    if (obstacle.kind === "ramp") {
      // the wedge's slope, as a plane: distance from it along its normal
      const run = obstacle.maxX - obstacle.minX, slopeLength = Math.hypot(obstacle.height, run);
      const normalX = -obstacle.height / slopeLength, normalY = run / slopeLength;
      const height = normalX * (origin.x - obstacle.minX) + normalY * origin.y;
      const approach = -(dir.x * normalX + dir.y * normalY);
      if (approach < 0.3 || height < -0.3) continue;
      const distance = (height - WHEEL_RADIUS) / approach;
      const touchX = origin.x + dir.x * distance - normalX * WHEEL_RADIUS;
      if (touchX >= obstacle.minX && touchX <= obstacle.maxX && (!best || distance < best.distance)) best = { distance, normalX, normalY };
      continue;
    }
    // a box top, reached only from above
    if (-dir.y < 0.3 || origin.x < obstacle.minX || origin.x > obstacle.maxX || origin.y < obstacle.maxY - 0.05) continue;
    const distance = (origin.y - obstacle.maxY - WHEEL_RADIUS) / -dir.y;
    if (!best || distance < best.distance) best = { distance, normalX: 0, normalY: 1 };
  }
  if (scenario === "ramp" && Math.abs(origin.z) < RAMP.halfWidth) {
    // the inside of a cylinder of radius R - wheel radius, centred above the start of the curve: solve the ray-circle
    // intersection and take the far root (the wheel is inside the curve)
    const r = RAMP.radius - WHEEL_RADIUS, qx = origin.x - RAMP.startX, qy = origin.y - RAMP.radius;
    const a = dir.x * dir.x + dir.y * dir.y;
    const b = 2 * (qx * dir.x + qy * dir.y), c = qx * qx + qy * qy - r * r, discriminant = b * b - 4 * a * c;
    if (a > 0.05 && discriminant > 0) {
      const distance = (-b + Math.sqrt(discriminant)) / (2 * a);
      const hitX = qx + dir.x * distance, hitY = qy + dir.y * distance;
      const angle = Math.atan2(hitX, -hitY), fromCentre = Math.hypot(hitX, hitY);
      const normalX = -hitX / fromCentre, normalY = -hitY / fromCentre;
      const onCurve = angle > 0.02 && angle < RAMP.endAngle;
      if (onCurve && -(dir.x * normalX + dir.y * normalY) > 0.3 && (!best || distance < best.distance)) best = { distance, normalX, normalY };
    }
  }
  return best;
}
