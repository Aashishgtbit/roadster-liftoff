// Types shared by the physics, the game and the scene.
import type { Quaternion, Vector3 } from "three";

/** The three things the car can do: two scripted stunts from the unveiling, and the player driving. */
export type Scenario = "jump" | "ramp" | "drive";

/** What the flight computer is doing. Each stunt steps through its own phases; drive mode reports the car's state. */
export type Phase =
  // lineup jump
  | "Approach" | "Spool" | "Lift" | "Roll" | "Descend"
  // ramp hang
  | "Fans" | "Climb" | "Hang" | "Exit" | "Flip" | "Hover" | "Drive off"
  // both stunts, back on the ground
  | "Touchdown" | "Brake" | "Parked"
  // drive mode
  | "Ready" | "Driving" | "Stopped" | "Boost" | "Flying" | "Airborne";

/** 0 = Road (stowed), 1 = High-Downforce (raised and pitched), 2 = Low-Drag (raised and flat). */
export type WingMode = 0 | 1 | 2;

export type NozzleGroup = "down" | "rear" | "front";

/** A cold-gas nozzle: where it sits (car frame, relative to the centre of mass) and which way it blows. */
export interface NozzleSpec {
  readonly position: Vector3;
  readonly exhaust: Vector3;     // unit vector the gas leaves along; the car is pushed the opposite way
  readonly group: NozzleGroup;
  readonly maxThrust: number;    // N
}

/** A nozzle in the simulation: the flight computer sets `command`, the valve lags it to produce `thrust`. */
export interface Nozzle extends NozzleSpec {
  command: number;   // 0..1
  thrust: number;    // N
}

/** One wheel on its suspension ray. */
export interface Wheel {
  readonly mount: Vector3;   // top of the suspension travel, car frame
  readonly isFront: boolean;
  length: number;            // current suspension length (m)
  previousLength: number;
  load: number;              // spring force (N)
  spinRate: number;          // rad/s
  onGround: boolean;
}

interface ObstacleBase {
  readonly id: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  destroyed?: boolean;       // a crate stack that was busted through
  hitCooldown?: number;      // seconds before the next hit counts as a new impact
}

/** A solid box: crate stack, wall or track barrier. */
export interface BoxObstacle extends ObstacleBase {
  readonly kind: "crates" | "wall" | "barrier";
  readonly minY: number;
  readonly maxY: number;
  readonly breakable?: boolean;   // gives way when hit faster than BUST_SPEED
}

/** A kicker ramp: a wedge rising from 0 at minX to `height` at maxX, open at the back. */
export interface RampObstacle extends ObstacleBase {
  readonly kind: "ramp";
  readonly height: number;
}

export type Obstacle = BoxObstacle | RampObstacle;

/** The player's controls in drive mode. */
export interface DriverInput {
  throttle: number;   // -1 (brake / reverse) .. 1 (gas)
  steer: number;      // -1 (left) .. 1 (right)
  jets: boolean;
  boost: boolean;
}

/** Everything that changes as the simulation runs. */
export interface SimState {
  scenario: Scenario;
  position: Vector3;           // centre of mass, world frame
  velocity: Vector3;
  orientation: Quaternion;
  angularVelocity: Vector3;    // world frame
  phase: Phase;
  phaseTime: number;           // seconds in the current phase
  time: number;                // seconds since the run started
  rollAngle: number;           // total roll about the car's length since the start (rad), for the HUD and stunts
  pitchAngle: number;          // total pitch about the car's width
  wingMode: WingMode;
  fanLevel: number;            // suction fans, 0..1, lagging fanCommand
  fanCommand: number;
  flipStartRoll: number;       // ramp stunt: roll angle when the flip began
  wheelsOnGround: number;
  upsideDownTime: number;      // drive mode: how long the car has been stuck on its roof or side
  input: DriverInput;
  fuel: number;                // 0..100
  steerAngle: number;          // front wheel angle (rad)
  obstacles: Obstacle[];
}

/** Called when the car busts through, hits, or is set back on its wheels. */
export interface SimEvents {
  onBust?: (obstacle: BoxObstacle, closingSpeed: number) => void;
  onHit?: (obstacle: BoxObstacle, closingSpeed: number) => void;
  onRecover?: () => void;
}
