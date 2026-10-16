// Shared constants used by the visuals, the physics and the tests. Units are metres; x runs along the car
// (nose at +x), y is up, z is across.

import type { BoxObstacle } from "./physics/types";

// The Roadster, measured from Tesla's launch photos: 4.56 m long, 2.0 m wide, 1.17 m tall, 2.91 m wheelbase.
export const WHEEL_RADIUS = 0.36;
export const WHEEL_ARCH_RADIUS = 0.43;
export const AXLE_X = [-1.49, 1.42] as const;   // rear and front axle positions
export const HALF_TRACK = 0.84;                 // wheel centre distance from the centreline
export const CAR_LENGTH = 4.56;
export const COM_HEIGHT = 0.55;                 // centre of mass height above the ground at rest

// The ramp from Tesla's video: a curved wall that rolls over into an overhang.
export interface RampShape {
  startX: number;     // where the curve starts
  radius: number;
  endAngle: number;   // how far round the curve goes (rad); past π/2 the wall overhangs
  halfWidth: number;
  landingX: number;   // where the ramp stunt aims to land
}
export const RAMP: RampShape = { startX: 4, radius: 7.2, endAngle: 0.9 * Math.PI, halfWidth: 2.4, landingX: 1.4 };

// The lineup jump lifts off here, just before the first parked car.
export const TAKEOFF_X = -10;

// Drive it: the course runs from x = 0 to the finish, inside concrete barriers topped with catch fences.
// The boundary boxes are tall (above the jets' hover ceiling) and thick, so the car can neither fly over nor
// push through them.
export const FINISH_X = 330;            // finish line
export const RUNOFF = 70;               // run-off past the finish before the end wall
export const START_WALL_X = -40;        // the wall behind the start
export const END_WALL_X = FINISH_X + RUNOFF;
export const TRACK_HALF_WIDTH = 9.6;    // half-width between the barriers
export const FENCE_TOP = 8;             // top of the catch fences
const DEPTH = 30;                       // how far the boundary volumes extend outward
const OUTER_Z = TRACK_HALF_WIDTH + DEPTH;
export const BARRIERS: readonly BoxObstacle[] = [
  { id: "barrier-left", kind: "barrier", minX: START_WALL_X - DEPTH, maxX: END_WALL_X + DEPTH, minY: 0, maxY: FENCE_TOP, minZ: -OUTER_Z, maxZ: -TRACK_HALF_WIDTH },
  { id: "barrier-right", kind: "barrier", minX: START_WALL_X - DEPTH, maxX: END_WALL_X + DEPTH, minY: 0, maxY: FENCE_TOP, minZ: TRACK_HALF_WIDTH, maxZ: OUTER_Z },
  { id: "barrier-start", kind: "barrier", minX: START_WALL_X - DEPTH, maxX: START_WALL_X, minY: 0, maxY: FENCE_TOP, minZ: -OUTER_Z, maxZ: OUTER_Z },
  { id: "barrier-end", kind: "barrier", minX: END_WALL_X, maxX: END_WALL_X + DEPTH, minY: 0, maxY: FENCE_TOP, minZ: -OUTER_Z, maxZ: OUTER_Z },
];
