// The physics. Pure: no DOM and no rendering, so the tests run it directly.
//
// A rigid body on four sprung wheels, pushed by ten cold-gas thrusters, stepped at a fixed 240 Hz. Gravity, tyre grip,
// suspension, fan suction, aero drag and downforce, every nozzle's force and torque, and collisions with the ground,
// the ramp and obstacles are integrated each step; the flight computer (flight-computer.ts) decides how hard each
// nozzle fires.
import { Quaternion, Vector3 } from "three";
import { AXLE_X, COM_HEIGHT, HALF_TRACK, RAMP, TAKEOFF_X, WHEEL_RADIUS } from "../config";
import {
  AIR_DENSITY, BUMP_STOP_LENGTH, BUMP_STOP_RATE, BUST_SPEED, CORNERING_STIFFNESS, DAMPING, DRAG_AREA, DT, FAN_MAX_FORCE,
  FREE_LENGTH, GRAVITY as g, INERTIA as I, MASS as M, MAX_LENGTH, SPRING_RATE, START_FUEL, STATIC_LENGTH, TYRE_GRIP,
  WING_LIFT_AREA,
} from "./constants";
import { castWheelRay } from "./contacts";
import { createFlightComputer } from "./flight-computer";
import type { Nozzle, NozzleSpec, Scenario, SimEvents, SimState, Wheel } from "./types";

export interface RoadsterSim {
  readonly state: SimState;
  readonly wheels: readonly Wheel[];
  readonly nozzles: readonly Nozzle[];
  /** Hooks for the game: busts, hits and recoveries. Set them any time. */
  readonly events: SimEvents;
  /** Start a scenario from its starting line. */
  reset(scenario?: Scenario): void;
  /** Advance by `dt` seconds of real time, in fixed physics steps. */
  step(dt: number): void;
  /** Advance by exactly one physics step (DT). */
  substep(): void;
}

// Points on the body that can hit things: floor and roof line at tail, middle and nose (relative to the centre of mass).
const HULL_POINTS: Vector3[] = [];
for (const [x, floor, roof] of [[-2.2, -0.37, 0.38], [0, -0.44, 0.58], [2.2, -0.27, -0.06]]) {
  for (const z of [-0.85, 0.85]) HULL_POINTS.push(new Vector3(x, floor, z), new Vector3(x, roof, z));
}

/** Where each scenario starts, along x. */
const START_X: Record<Scenario, number> = { jump: TAKEOFF_X - 16, ramp: RAMP.startX - 18, drive: -6 };

export function createRoadsterSim(nozzleSpecs: readonly NozzleSpec[], events: SimEvents = {}): RoadsterSim {
  const wheels: Wheel[] = AXLE_X.flatMap(x => [1, -1].map(side => ({
    mount: new Vector3(x, WHEEL_RADIUS - COM_HEIGHT + STATIC_LENGTH, side * HALF_TRACK), isFront: x > 0,
    length: STATIC_LENGTH, previousLength: STATIC_LENGTH, load: 0, spinRate: 0, onGround: false,
  })));
  const nozzles: Nozzle[] = nozzleSpecs.map(spec => ({ ...spec, thrust: 0, command: 0 }));
  const state: SimState = {
    scenario: "jump", position: new Vector3(), velocity: new Vector3(), orientation: new Quaternion(), angularVelocity: new Vector3(),
    phase: "Approach", phaseTime: 0, time: 0, rollAngle: 0, pitchAngle: 0, wingMode: 1, fanLevel: 0, fanCommand: 0,
    flipStartRoll: 0, wheelsOnGround: 0, upsideDownTime: 0,
    input: { throttle: 0, steer: 0, jets: false, boost: false }, fuel: 100, steerAngle: 0, obstacles: [],
  };
  const control = createFlightComputer(state, wheels, nozzles, events);

  // scratch objects, reused every step
  const force = new Vector3(), torque = new Vector3(), lever = new Vector3(), leverTorque = new Vector3();
  const point = new Vector3(), down = new Vector3(), up = new Vector3(), normal = new Vector3(), tmp = new Vector3();
  const tyreForward = new Vector3(), tyreSide = new Vector3(), pointVelocity = new Vector3(), slip = new Vector3();
  const inverse = new Quaternion(), bodyTorque = new Vector3(), bodySpin = new Vector3(), angularMomentum = new Vector3();
  const gyro = new Vector3();

  function reset(scenario: Scenario = state.scenario) {
    state.scenario = scenario;
    state.position.set(START_X[scenario], COM_HEIGHT, 0); state.velocity.set(0, 0, 0);
    state.orientation.identity(); state.angularVelocity.set(0, 0, 0);
    state.fuel = START_FUEL; state.steerAngle = 0; state.upsideDownTime = 0;
    state.phase = scenario === "drive" ? "Ready" : "Approach"; state.phaseTime = 0; state.time = 0;
    state.rollAngle = 0; state.pitchAngle = 0; state.fanLevel = 0; state.fanCommand = 0;
    for (const w of wheels) { w.length = w.previousLength = STATIC_LENGTH; w.spinRate = 0; w.onGround = false; }
    for (const n of nozzles) n.thrust = n.command = 0;
  }

  /** Accumulate a force applied at a world point (and its torque about the centre of mass). */
  function addForceAt(f: Vector3, at: Vector3) {
    force.add(f);
    lever.subVectors(at, state.position);
    torque.add(leverTorque.crossVectors(lever, f));
  }

  /** Suspension and tyre forces. Returns how many wheels touch something. */
  function wheelForces(drivePerWheel: number): number {
    let touching = 0;
    for (const w of wheels) {
      const mount = point.copy(w.mount).applyQuaternion(state.orientation).add(state.position);
      w.previousLength = w.length; w.onGround = false;
      const hit = castWheelRay(mount, down, state.scenario, state.obstacles);
      if (!hit || hit.distance >= MAX_LENGTH) {   // in the air: the suspension drops and the wheel spins down
        w.length = MAX_LENGTH; w.load = 0; w.spinRate *= Math.exp(-0.4 * DT);
        continue;
      }
      w.onGround = true; touching++;
      w.length = Math.max(BUMP_STOP_LENGTH * 0.5, hit.distance);
      let load = SPRING_RATE * (FREE_LENGTH - w.length) - DAMPING * (w.length - w.previousLength) / DT;
      if (w.length < BUMP_STOP_LENGTH) load += BUMP_STOP_RATE * (BUMP_STOP_LENGTH - w.length);
      load = Math.max(0, load); w.load = load;
      addForceAt(tmp.copy(up).multiplyScalar(load), mount);
      // tyre: a frame on the contact surface; side grip and drive / brake stay inside the friction circle
      normal.set(hit.normalX, hit.normalY, 0);
      const contact = slip.copy(mount).addScaledVector(down, w.length).addScaledVector(normal, -WHEEL_RADIUS).clone();
      tyreForward.set(1, 0, 0).applyQuaternion(state.orientation);
      tyreForward.addScaledVector(normal, -tyreForward.dot(normal)).normalize();
      if (state.steerAngle !== 0 && w.isFront) tyreForward.applyAxisAngle(normal, state.steerAngle);
      tyreSide.crossVectors(normal, tyreForward);
      const arm = tmp.subVectors(contact, state.position);
      const v = pointVelocity.crossVectors(state.angularVelocity, arm).add(state.velocity);
      const rolling = v.dot(tyreForward), sliding = v.dot(tyreSide), maxGrip = TYRE_GRIP * load;
      let along = drivePerWheel, across = -sliding * CORNERING_STIFFNESS;
      const total = Math.hypot(along, across);
      if (total > maxGrip) { along *= maxGrip / total; across *= maxGrip / total; }
      addForceAt(new Vector3().addScaledVector(tyreForward, along).addScaledVector(tyreSide, across), contact);
      w.spinRate = rolling / WHEEL_RADIUS;
    }
    return touching;
  }

  /** Body collisions: each hull point is pushed out of the ground, the ramp wall, kicker ramps and boxes. */
  function hullForces() {
    for (const hullPoint of HULL_POINTS) {
      const p = point.copy(hullPoint).applyQuaternion(state.orientation).add(state.position);
      // deepest penetration found so far, and the direction to push out along
      let depth = -p.y, nx = 0, ny = 1, nz = 0;
      if (state.scenario === "ramp" && Math.abs(p.z) < RAMP.halfWidth) {
        const dx = p.x - RAMP.startX, dy = p.y - RAMP.radius, angle = Math.atan2(dx, -dy), fromCentre = Math.hypot(dx, dy);
        if (angle > 0.02 && angle < RAMP.endAngle && fromCentre - RAMP.radius > depth) {
          depth = fromCentre - RAMP.radius; nx = -dx / fromCentre; ny = -dy / fromCentre;
        }
      }
      for (const obstacle of state.obstacles) {
        if (obstacle.kind === "ramp") {   // body below a kicker ramp's slope is pushed out along the slope's normal
          if (p.z < obstacle.minZ || p.z > obstacle.maxZ || p.x < obstacle.minX || p.x > obstacle.maxX) continue;
          const run = obstacle.maxX - obstacle.minX, slopeLength = Math.hypot(obstacle.height, run);
          const rx = -obstacle.height / slopeLength, ry = run / slopeLength, dist = rx * (p.x - obstacle.minX) + ry * p.y;
          if (dist < 0 && dist > -0.8 && -dist > depth) { depth = -dist; nx = rx; ny = ry; nz = 0; }
          continue;
        }
        const b = obstacle;
        if (b.destroyed || p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY || p.z < b.minZ || p.z > b.maxZ) continue;
        // push out through the shallowest side; the top only counts if the point came down onto it (no launching
        // a car that is scraping up a wall face)
        const faces = [
          { depth: p.x - b.minX, x: -1, y: 0, z: 0 }, { depth: b.maxX - p.x, x: 1, y: 0, z: 0 },
          { depth: p.z - b.minZ, x: 0, y: 0, z: -1 }, { depth: b.maxZ - p.z, x: 0, y: 0, z: 1 },
        ];
        if (p.y - state.velocity.y * 0.06 > b.maxY - 0.12) faces.push({ depth: b.maxY - p.y, x: 0, y: 1, z: 0 });
        let face = faces[0];
        for (const f of faces) if (f.depth < face.depth) face = f;
        const closing = -(state.velocity.x * face.x + state.velocity.y * face.y + state.velocity.z * face.z);
        if (b.breakable && closing > BUST_SPEED) {
          b.destroyed = true; state.velocity.multiplyScalar(0.88); events.onBust?.(b, closing);
          continue;
        }
        if (closing > 4 && !b.hitCooldown) events.onHit?.(b, closing);
        // an impact, not a spring: the speed into the obstacle goes at once (with a small bounce on a hard hit), so
        // a fast car cannot tunnel through a wall between physics steps. Every step, not just the first touch, so it
        // cannot slowly grind through a barrier either.
        if (closing > 0.5) {
          const restitution = closing > 2 && !b.hitCooldown ? 1.15 : 1;
          state.velocity.x += face.x * closing * restitution;
          state.velocity.y += face.y * closing * restitution;
          state.velocity.z += face.z * closing * restitution;
          if (!b.hitCooldown) state.angularVelocity.multiplyScalar(0.5);
        }
        b.hitCooldown = 0.4;
        if (face.depth > depth) { depth = face.depth; nx = face.x; ny = face.y; nz = face.z; }
      }
      if (depth <= 0) continue;
      // contact force: a stiff spring with damping, plus sliding friction
      normal.set(nx, ny, nz);
      const arm = tmp.subVectors(p, state.position);
      const v = pointVelocity.crossVectors(state.angularVelocity, arm).add(state.velocity), vNormal = v.dot(normal);
      const push = Math.min(3 * M * g, Math.max(0, 400000 * depth - 30000 * vNormal));   // capped, so a deep overlap cannot fire the car off
      const sliding = slip.copy(v).addScaledVector(normal, -vNormal), slideSpeed = sliding.length();
      const friction = slideSpeed > 1e-3 ? Math.min(0.3 * push, 20000 * slideSpeed) / slideSpeed : 0;
      addForceAt(tmp.copy(normal).multiplyScalar(push).addScaledVector(sliding, -friction), p.clone());
    }
    for (const b of state.obstacles) if (b.hitCooldown) b.hitCooldown = Math.max(0, b.hitCooldown - DT);
  }

  function substep() {
    const drivePerWheel = control();
    force.set(0, -M * g, 0); torque.set(0, 0, 0);
    down.set(0, -1, 0).applyQuaternion(state.orientation); up.copy(down).negate();
    const touching = wheelForces(drivePerWheel);
    state.wheelsOnGround = touching;
    hullForces();
    // suction fans: pull the floor toward whatever surface the wheels are on (they only seal with the wheels down)
    const fanLag = state.fanCommand > state.fanLevel ? 0.35 : 0.12;
    state.fanLevel += (state.fanCommand - state.fanLevel) * (1 - Math.exp(-DT / fanLag));
    if (state.fanLevel > 0.01) force.addScaledVector(down, FAN_MAX_FORCE * state.fanLevel * (touching >= 3 ? 1 : touching * 0.15));
    // thrusters: the valves lag ~40 ms; thrust pushes opposite the exhaust
    const valveLag = 1 - Math.exp(-DT / 0.04);
    for (const n of nozzles) {
      n.thrust += (n.command * n.maxThrust - n.thrust) * valveLag;
      if (n.thrust < 1) continue;
      const at = point.copy(n.position).applyQuaternion(state.orientation).add(state.position);
      addForceAt(tmp.copy(n.exhaust).applyQuaternion(state.orientation).multiplyScalar(-n.thrust), at);
    }
    // aero: drag on the body, downforce at the wing (stowed, high-downforce, low-drag)
    const speed = state.velocity.length();
    force.addScaledVector(state.velocity, -0.5 * AIR_DENSITY * DRAG_AREA * speed);
    const downforce = 0.5 * AIR_DENSITY * WING_LIFT_AREA[state.wingMode] * speed * speed;
    addForceAt(tmp.copy(down).multiplyScalar(downforce), point.set(-2.0, 0.5, 0).applyQuaternion(state.orientation).add(state.position));
    torque.addScaledVector(state.angularVelocity, -350);   // rotational damping
    integrate();
  }

  /** Semi-implicit Euler: velocity first, then position; Euler's equations for the spin, in the body frame. */
  function integrate() {
    state.velocity.addScaledVector(force, DT / M);
    state.position.addScaledVector(state.velocity, DT);
    inverse.copy(state.orientation).invert();
    const tb = bodyTorque.copy(torque).applyQuaternion(inverse), wb = bodySpin.copy(state.angularVelocity).applyQuaternion(inverse);
    angularMomentum.set(I.x * wb.x, I.y * wb.y, I.z * wb.z);
    gyro.crossVectors(wb, angularMomentum);
    wb.x += (tb.x - gyro.x) / I.x * DT; wb.y += (tb.y - gyro.y) / I.y * DT; wb.z += (tb.z - gyro.z) / I.z * DT;
    state.rollAngle += wb.x * DT; state.pitchAngle += wb.z * DT;
    state.angularVelocity.copy(wb).applyQuaternion(state.orientation);
    // dq/dt = ½ ω q
    const w = state.angularVelocity, q = state.orientation;
    const dq = new Quaternion(w.x * DT * 0.5, w.y * DT * 0.5, w.z * DT * 0.5, 0).multiply(q);
    q.set(q.x + dq.x, q.y + dq.y, q.z + dq.z, q.w + dq.w).normalize();
    state.phaseTime += DT; state.time += DT;
  }

  let pending = 0;
  function step(dt: number) {
    pending += Math.min(dt, 0.1);
    while (pending >= DT) { substep(); pending -= DT; }
    if (!Number.isFinite(state.position.x + state.position.y + state.orientation.w)) reset();
  }

  reset();
  return { state, wheels, nozzles, events, reset, step, substep };
}
