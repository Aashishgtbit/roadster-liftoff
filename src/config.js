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
