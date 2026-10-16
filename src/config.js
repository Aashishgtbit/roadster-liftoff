// Shared constants used by the visuals, the physics and the tests. Units are metres; x runs along the car
// (nose at +x), y is up, z is across.

// The Roadster, measured from Tesla's launch photos: 4.56 m long, 2.0 m wide, 1.17 m tall, 2.91 m wheelbase.
export const WR = 0.36;               // wheel radius
export const AR = 0.43;               // wheel-arch radius
export const XW = [-1.49, 1.42];      // rear and front axle positions
export const TRACK_Z = 0.84;          // wheel centre distance from the centreline
export const CAR_L = 4.56;            // overall length
export const COM = 0.55;              // centre of mass height above the ground at rest

// The ramp from Tesla's video: a curved wall of radius R that rolls over into an overhang, ending at angle thMax.
// cx is where the curve starts, hw its half-width, land where the ramp stunt aims to land.
export const RAMP = { cx: 4, R: 7.2, thMax: 0.9 * Math.PI, hw: 2.4, land: 1.4 };

// Drive it: the course runs from x = 0 to the finish, inside concrete barriers topped with catch fences.
// The boundary boxes are tall (above the jets' hover ceiling) and thick, so the car can neither fly over nor
// push through them.
export const FINISH_X = 330;          // finish line
export const RUNOFF = 70;             // run-off past the finish before the end wall
export const TRACK_HW = 9.6;          // half-width between the barriers
export const FENCE_TOP = 8;           // top of the catch fences
const DEEP = 30;                      // how far the boundary volumes extend outward
export const BARRIERS = [
  { id: "barrier-left", kind: "barrier", x0: -40 - DEEP, x1: FINISH_X + RUNOFF + DEEP, y0: 0, y1: FENCE_TOP, z0: -TRACK_HW - DEEP, z1: -TRACK_HW },
  { id: "barrier-right", kind: "barrier", x0: -40 - DEEP, x1: FINISH_X + RUNOFF + DEEP, y0: 0, y1: FENCE_TOP, z0: TRACK_HW, z1: TRACK_HW + DEEP },
  { id: "barrier-start", kind: "barrier", x0: -40 - DEEP, x1: -40, y0: 0, y1: FENCE_TOP, z0: -TRACK_HW - DEEP, z1: TRACK_HW + DEEP },
  { id: "barrier-end", kind: "barrier", x0: FINISH_X + RUNOFF, x1: FINISH_X + RUNOFF + DEEP, y0: 0, y1: FENCE_TOP, z0: -TRACK_HW - DEEP, z1: TRACK_HW + DEEP },
];
