// Physical properties of the car and the tuning of its flight computer. Masses, inertias, thrusts and grip are
// estimates; the demo car's real figures were not published.
import { Vector3 } from "three";

export const DT = 1 / 240;                 // fixed physics step (s)
export const GRAVITY = 9.81;
export const MASS = 1900;                  // kg
export const INERTIA = new Vector3(820, 3900, 3500);   // about the car's x (roll), y (yaw) and z (pitch) axes, kg m²

// suspension: one spring and damper per wheel, with a stiff bump stop at the end of its travel
export const SPRING_RATE = 66000;          // N/m
export const DAMPING = 5600;               // N s/m
export const BUMP_STOP_RATE = 900000;      // N/m
export const STATIC_LENGTH = 0.10;         // suspension length with the car at rest
export const FREE_LENGTH = STATIC_LENGTH + (MASS * GRAVITY / 4) / SPRING_RATE;   // unloaded
export const MAX_LENGTH = FREE_LENGTH + 0.04;   // the wheel leaves the ground beyond this
export const BUMP_STOP_LENGTH = 0.025;

// tyres
export const TYRE_GRIP = 1.15;             // friction coefficient
export const CORNERING_STIFFNESS = 9000;   // N of side force per m/s of sideways slip

// suction fans under the floor (the ramp stunt)
export const FAN_MAX_FORCE = 1.6 * MASS * GRAVITY;

// aerodynamics
export const AIR_DENSITY = 1.2;
export const DRAG_AREA = 0.62;                       // drag coefficient × frontal area (m²)
export const WING_LIFT_AREA = [0.15, 1.3, 0.45];     // downforce coefficient × area, per wing mode

// the lineup jump
export const JUMP_APPROACH_SPEED = 9.5;    // m/s
export const SPOOL_DISTANCE = 2.0;         // the floor jets spool up this far before the take-off point
export const LIFT_BURN_TIME = 0.26;        // full-power lift before the roll begins (s)
export const ROLL_START_TIME = 0.3;        // the roll profile starts this long after lift-off
export const ROLL_DURATION = 1.5;

// the ramp hang
export const RAMP_APPROACH_SPEED = 6;
export const RAMP_CLIMB_SPEED = 6.5;
export const HANG_ANGLE = 0.74 * Math.PI;  // where on the curve the car pauses upside down
export const HANG_TIME = 1.3;
export const FLIP_DURATION = 0.8;          // the 180° roll after tipping off the end

// drive mode
export const BUST_SPEED = 12.5;            // m/s (45 km/h): crates give way above this
export const START_FUEL = 60;
export const HOVER_HEIGHT = 4.5;           // the jets climb to about this height and hold it
export const JET_FUEL_RATE = 15;           // fuel per second, jets on
export const ASSIST_FUEL_RATE = 3;         // stability assist pulses while airborne
export const BOOST_FUEL_RATE = 12;
export const RECHARGE_RATE = 4;            // the on-board compressor, on the ground with nothing firing
