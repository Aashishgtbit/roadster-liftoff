// The flight computer: each physics step it decides how hard every nozzle fires, what the fans do and how much drive
// force the wheels get. The car was remote-operated on the night; here each stunt is a script of phases, and in drive
// mode the player's controls go through the same thrusters with a height hold and a stability assist.
import { Quaternion, Vector3 } from "three";
import { COM_HEIGHT, RAMP, TAKEOFF_X } from "../config";
import {
  ASSIST_FUEL_RATE, BOOST_FUEL_RATE, DT, FLIP_DURATION, GRAVITY as g, HANG_ANGLE, HANG_TIME, HOVER_HEIGHT,
  INERTIA as I, JET_FUEL_RATE, JUMP_APPROACH_SPEED, LIFT_BURN_TIME, MASS as M, RAMP_APPROACH_SPEED, RAMP_CLIMB_SPEED,
  RECHARGE_RATE, ROLL_DURATION, ROLL_RATE, ROLL_START_TIME, SOFT_DESCENT_SPEED, SPOOL_DISTANCE, WALL_CLIMB_SPEED,
} from "./constants";
import type { Nozzle, Phase, SimEvents, SimState, Wheel } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const X_AXIS = new Vector3(1, 0, 0), Y_AXIS = new Vector3(0, 1, 0);

/** The car's heading and attitude, and its spin rates about its own axes. */
interface Attitude {
  pitch: number;       // nose up (rad)
  yaw: number;         // heading, 0 along +x
  rollRate: number;
  yawRate: number;
  pitchRate: number;
  forward: Vector3;    // the car's nose direction, world frame
}

/** A torque in the car's frame. */
interface BodyTorque { roll: number; yaw: number; pitch: number }

/** Spin up quickly, coast at a steady rate, stop: [angle so far, rate] for a turn of `total` over `duration`. */
export function rotationProfile(t: number, total: number, duration: number): [number, number] {
  const rampShare = 0.16, rate = total / (duration * (1 - rampShare)), accel = rate / (rampShare * duration);
  const t1 = rampShare * duration, t2 = duration - t1;
  if (t <= 0) return [0, 0];
  if (t < t1) return [0.5 * accel * t * t, accel * t];
  if (t < t2) return [0.5 * accel * t1 * t1 + rate * (t - t1), rate];
  if (t < duration) { const left = duration - t; return [total - 0.5 * accel * left * left, accel * left]; }
  return [total, 0];
}

export function createFlightComputer(state: SimState, wheels: readonly Wheel[], nozzles: readonly Nozzle[], events: SimEvents) {
  const floorJets = nozzles.filter(n => n.group === "down");
  const noseJets = nozzles.filter(n => n.group === "front");
  const tailJets = nozzles.filter(n => n.group === "rear");
  const fullLift = 4 * floorJets[0].maxThrust;

  // scratch objects, reused every step
  const forward = new Vector3(), up = new Vector3(), bodySpin = new Vector3(), worldTorque = new Vector3();
  const inverse = new Quaternion(), error = new Quaternion(), target = new Quaternion(), turn = new Quaternion();

  const setPhase = (phase: Phase) => { state.phase = phase; state.phaseTime = 0; };
  const anyWheelDown = () => wheels.some(w => w.onGround);
  /** The car's up direction in the world. */
  const upVector = () => up.set(0, 1, 0).applyQuaternion(state.orientation);

  function readAttitude(): Attitude {
    forward.set(1, 0, 0).applyQuaternion(state.orientation);
    inverse.copy(state.orientation).invert();
    bodySpin.copy(state.angularVelocity).applyQuaternion(inverse);
    return {
      pitch: Math.asin(clamp(forward.y, -1, 1)), yaw: Math.atan2(-forward.z, forward.x),
      rollRate: bodySpin.x, yawRate: bodySpin.y, pitchRate: bodySpin.z, forward,
    };
  }

  /** Torque (car frame) that turns the car toward `goal` along the shortest rotation, at up to `maxRate` rad/s. */
  function torqueToward(goal: Quaternion, maxRate: number, gain: number): BodyTorque {
    error.copy(state.orientation).invert().multiply(goal);
    if (error.w < 0) error.set(-error.x, -error.y, -error.z, -error.w);
    const angle = 2 * Math.acos(Math.min(1, error.w)), sinHalf = Math.sqrt(Math.max(1e-9, 1 - error.w * error.w));
    const rate = Math.min(maxRate, 3.2 * angle);
    const spin = bodySpin.copy(state.angularVelocity).applyQuaternion(inverse.copy(state.orientation).invert());
    return {
      roll: I.x * gain * (error.x / sinHalf * rate - spin.x),
      yaw: I.y * gain * (error.y / sinHalf * rate - spin.y),
      pitch: I.z * gain * (error.z / sinHalf * rate - spin.z),
    };
  }

  /** Split a wanted lift and roll / pitch torque across the four floor nozzles (they can only push). */
  function commandFloorJets(lift: number, rollTorque: number, pitchTorque: number) {
    for (const n of floorJets) {
      const thrust = lift / 4 + pitchTorque / (4 * n.position.x) - rollTorque / (4 * n.position.z);
      n.command = clamp(thrust / n.maxThrust, 0, 1);
    }
  }

  /** The two nose nozzles sit either side of the centreline, so firing one more than the other turns the car. */
  function yawWithNoseJets(yawTorque: number) {
    // a nose nozzle pushes backwards, so one at +z twists the car by -z * thrust about its own y axis
    for (const n of noseJets) n.command = Math.max(n.command, clamp(yawTorque / (-n.position.z) / n.maxThrust, 0, 1));
  }

  /** Keep the heading straight down the course (it may be upside down). */
  function holdHeading(att: Attitude) {
    // wanted torque about the world vertical, expressed in the car's frame
    worldTorque.set(0, I.y * (-6 * att.yaw - 4 * state.angularVelocity.y), 0).applyQuaternion(inverse.copy(state.orientation).invert());
    yawWithNoseJets(worldTorque.y);
  }

  /** Sideways force from the floor jets while the car is on its side (they then point sideways), cancelling drift. */
  function sidewaysCorrection(upZ: number) {
    return Math.abs(upZ) > 0.6 ? Math.max(0, -M * 4 * (state.velocity.z + 0.6 * state.position.z) * Math.sign(upZ)) : 0;
  }

  /** Descend on the floor jets and touch down at about 1.5 m/s, holding `targetRoll`. */
  function glideDown(att: Attitude, pitchTorque: number, targetRoll: number) {
    if (state.scenario === "ramp") {   // lean to drift back over the landing spot at the foot of the ramp
      const height = Math.max(0, state.position.y - COM_HEIGHT - 0.12);
      const wantAccelX = (RAMP.landingX - state.position.x) - 1.8 * state.velocity.x;
      const lean = clamp(-wantAccelX / g, -0.3, 0.3) * clamp((height - 0.4) / 1.2, 0, 1);
      pitchTorque = I.z * (30 * (lean - att.pitch) - 10 * att.pitchRate);
    }
    // follow a constant-deceleration glide path, with feedforward
    const height = Math.max(0, state.position.y - COM_HEIGHT - 0.12), DECEL = 7;
    const wantVy = -(0.8 + Math.sqrt(2 * DECEL * height));
    const feedforward = state.velocity.y < wantVy + 0.5 ? DECEL : 0;
    const upY = Math.max(0.3, upVector().y);
    // lean the thrust a few degrees to steer back onto the centreline, then level again before the wheels touch
    const lean = clamp(-(0.12 * state.position.z + 0.55 * state.velocity.z), -0.3, 0.3) * clamp((height - 0.4) / 1.2, 0, 1);
    commandFloorJets(Math.max(0, M * (g + feedforward + 15 * (wantVy - state.velocity.y))) / upY,
      I.x * (40 * (targetRoll + lean - state.rollAngle) - 10 * att.rollRate), pitchTorque);
    holdHeading(att);
    if (anyWheelDown()) setPhase("Touchdown");
  }

  /** The player's throttle, steering, jets, roll and boost, in any scenario. Returns the total drive force. */
  function playerControl(att: Attitude, forwardSpeed: number): number {
    const input = state.input, speed = Math.abs(forwardSpeed), flying = state.wheelsOnGround === 0, hasFuel = state.fuel > 0;
    // steering eases toward the input; less lock at speed
    state.steerAngle += (-input.steer * 0.42 / (1 + speed / 14) - state.steerAngle) * Math.min(1, DT * 8);
    // Roadster-like punch: ~0.9 g off the line (tyre grip caps it), 150 km/h top speed
    let drive: number;
    if (input.throttle > 0) drive = forwardSpeed < 42 ? M * 9 * input.throttle * (1 - Math.max(0, forwardSpeed - 30) / 12) : 0;
    else if (input.throttle < 0) drive = forwardSpeed > 0.5 ? -M * 9 : (forwardSpeed > -8 ? -M * 4 : 0);
    else drive = -M * 0.3 * Math.sign(forwardSpeed) * Math.min(1, speed);   // coasting
    const onWall = state.scenario === "ramp" && rampWallAssist(att, forwardSpeed, flying);
    if (onWall !== false) drive = onWall;

    // in the air: Space climbs to a hover and holds it, the brake key lets the car down gently, Q / E roll it.
    // Let go mid-flip and the roll carries on the same way until the wheels face down again.
    const finishingFlip = flying && input.roll === 0 && upVector().y < 0.8 && Math.abs(att.rollRate) > 1.5;
    const rollDirection = input.roll !== 0 ? input.roll : finishingFlip ? Math.sign(att.rollRate) : 0;
    const rolling = flying && rollDirection !== 0, descending = flying && input.throttle < 0 && !input.jets;
    if (hasFuel && (input.jets || descending || rolling)) {
      const height = state.position.y - COM_HEIGHT, upY = upVector().y;
      // descending: quick while high, easing to a soft touchdown (a glide path, like the stunts' landings)
      const wantVy = input.jets ? clamp(1.6 * HOVER_HEIGHT[state.scenario] - 1.6 * height, -3, 7)
        : descending ? -clamp(0.8 * height + SOFT_DESCENT_SPEED, SOFT_DESCENT_SPEED, 6) : null;
      // the floor jets only lift while they point roughly down
      const lift = wantVy !== null && upY > 0.3 ? clamp(M * (g + 5 * (wantVy - state.velocity.y)), 0, 2.3 * M * g) / upY : 0;
      if (rolling) {
        // spin about the car's length by firing one side's floor jets harder than the other's
        commandFloorJets(lift, I.x * 16 * (rollDirection * ROLL_RATE - att.rollRate), I.z * 10 * -att.pitchRate);
      } else {
        // hold the car level; steering turns it in the air with the nose jets
        target.setFromAxisAngle(Y_AXIS, att.yaw - (flying ? input.steer * 0.7 : 0));
        const torque = torqueToward(target, 3, 8);
        commandFloorJets(lift, torque.roll, torque.pitch);
        yawWithNoseJets(torque.yaw);
      }
      state.fuel -= JET_FUEL_RATE * DT;
    } else if (flying && hasFuel) {
      // stability assist: in the air the flight computer pulses the floor jets to bring the car level (it finishes
      // a roll the player has taken past halfway)
      target.setFromAxisAngle(Y_AXIS, att.yaw);
      const torque = torqueToward(target, 2.5, 5);
      commandFloorJets(0, torque.roll, torque.pitch);
      state.fuel -= ASSIST_FUEL_RATE * DT;
    }
    if (input.boost && hasFuel) { for (const n of tailJets) n.command = 1; state.fuel -= BOOST_FUEL_RATE * DT; }
    if (!flying && !input.jets && !input.boost) state.fuel += RECHARGE_RATE * DT;   // an on-board compressor slowly refills the tanks
    state.fuel = clamp(state.fuel, 0, 100);
    // stuck on its roof or side for over a second: set it back on its wheels, keeping the heading
    // (not when the wheels are on something: upside down on the ramp wall is the point of the ramp)
    const stuck = upVector().y < 0.4 && state.velocity.length() < 1.5 && state.wheelsOnGround < 3 && onWall === false;
    state.upsideDownTime = stuck ? state.upsideDownTime + DT : 0;
    if (state.upsideDownTime > 1.1) {
      state.orientation.setFromAxisAngle(Y_AXIS, att.yaw); state.angularVelocity.set(0, 0, 0); state.velocity.set(0, 0, 0);
      state.position.y = Math.max(state.position.y, COM_HEIGHT + 0.35); state.rollAngle = state.pitchAngle = 0; state.upsideDownTime = 0;
      events.onRecover?.();
    }
    if (onWall !== false) state.phase = angleOnRamp() > 0.6 * Math.PI && speed < 0.6 ? "Hang" : "Climb";
    else state.phase = flying ? (input.jets && hasFuel ? "Flying" : "Airborne")
      : input.boost && hasFuel ? "Boost"
      : speed > 0.3 || input.throttle !== 0 ? "Driving"
      : state.phase === "Ready" ? "Ready" : "Stopped";
    return drive;
  }

  /**
   * Ramp, player at the wheel: the suction fans seal near and on the wall, and the motors hold the car against gravity
   * along it, so it can stop anywhere, even upside down. Returns the drive force while on the wall, otherwise false.
   */
  function rampWallAssist(att: Attitude, forwardSpeed: number, flying: boolean): number | false {
    const angle = angleOnRamp(), x = state.position.x, inLane = Math.abs(state.position.z) < RAMP.halfWidth;
    const nearWall = !flying && inLane && x > RAMP.startX - 6 && x < RAMP.startX + RAMP.radius + 1;
    // the fans cut just before the end, so the car can tip off it
    state.fanCommand = nearWall && angle < RAMP.endAngle - 0.08 ? 1 : 0;
    if (!nearWall || angle < 0.03 || x < RAMP.startX) return false;
    const throttle = state.input.throttle;
    const wantSpeed = throttle > 0 ? WALL_CLIMB_SPEED * throttle : throttle < 0 ? -3 : 0;
    // on the overhang the tyres alone cannot push on, so the diffuser jets help (they fire at the lip in the video)
    if (throttle > 0 && angle > 0.8 * Math.PI) for (const n of tailJets) n.command = clamp(0.55 + 0.4 * (2.2 - forwardSpeed), 0, 1);
    return M * g * att.forward.y + M * 5 * (wantSpeed - forwardSpeed);
  }

  /** The lineup jump: approach, spool the floor jets, lift, roll 360° over the parked cars, glide down. */
  function lineupJump(att: Attitude, forwardSpeed: number, pitchHold: number): number {
    const cruise = M * 2.2 * (JUMP_APPROACH_SPEED - forwardSpeed);
    switch (state.phase) {
      case "Approach":
        if (state.position.x > TAKEOFF_X - SPOOL_DISTANCE) setPhase("Spool");
        return cruise;
      case "Spool":
        commandFloorJets(M * g * 0.3, 0, pitchHold);
        if (state.position.x >= TAKEOFF_X) setPhase("Lift");
        return cruise;
      case "Lift":
        commandFloorJets(fullLift, 0, pitchHold); holdHeading(att);
        for (const n of tailJets) n.command = clamp((JUMP_APPROACH_SPEED - forwardSpeed) * 0.6, 0.12, 1);
        if (state.phaseTime >= LIFT_BURN_TIME) setPhase("Roll");
        return 0;
      case "Roll": {
        const t = state.phaseTime + LIFT_BURN_TIME - ROLL_START_TIME;
        const [wantRoll, wantRate] = rotationProfile(t, 2 * Math.PI, ROLL_DURATION);
        commandFloorJets(Math.min(sidewaysCorrection(upVector().z), fullLift * 0.7),
          I.x * (70 * (wantRoll - state.rollAngle) + 16 * (wantRate - att.rollRate)), pitchHold);
        holdHeading(att);
        if (t >= ROLL_DURATION && Math.abs(wantRoll - state.rollAngle) < 0.12) setPhase("Descend");
        return 0;
      }
      case "Descend":
        glideDown(att, pitchHold, 2 * Math.PI);
        return 0;
    }
    return 0;
  }

  /** How far round the ramp's curve the car is (rad): 0 at the bottom, π/2 vertical, π upside down at the top. */
  const angleOnRamp = () => Math.atan2(state.position.x - RAMP.startX, -(state.position.y - RAMP.radius));

  /** The ramp hang: climb on suction, pause upside down, tip off the end, roll 180°, hover down, drive away. */
  function rampHang(att: Attitude, forwardSpeed: number, pitchHold: number): number {
    // holding a speed on the wall needs the share of gravity along the surface fed forward
    const alongGravity = M * g * att.forward.y;
    switch (state.phase) {
      case "Approach":
        if (state.position.x > RAMP.startX - 8) setPhase("Fans");
        return M * 2.2 * (RAMP_APPROACH_SPEED - forwardSpeed);
      case "Fans":
        state.fanCommand = 1;
        if (state.position.x > RAMP.startX) setPhase("Climb");
        return M * 2.2 * (RAMP_APPROACH_SPEED - forwardSpeed);
      case "Climb": {
        // speed along the wall eases off toward the pause near the top
        const angle = angleOnRamp();
        const wantSpeed = angle < HANG_ANGLE - 0.6 ? RAMP_CLIMB_SPEED : Math.max(0, RAMP_CLIMB_SPEED * (HANG_ANGLE - angle) / 0.6);
        state.fanCommand = 1;
        if (angle >= HANG_ANGLE - 0.04 && Math.abs(forwardSpeed) < 0.35) setPhase("Hang");
        return alongGravity + M * 2.5 * (wantSpeed - forwardSpeed);
      }
      case "Hang":
        state.fanCommand = 1;
        if (state.phaseTime > HANG_TIME) setPhase("Exit");
        return alongGravity - M * 3 * forwardSpeed;
      case "Exit": {
        // creep on to the lip and tip off it slowly, as in the close-up shot; the fans cut just before the edge
        state.fanCommand = angleOnRamp() < RAMP.endAngle - 0.08 ? 1 : 0;
        // tyres alone cannot push further up the overhang, so the diffuser jets help (they fire at the lip in the video)
        for (const n of tailJets) n.command = clamp(0.55 + 0.4 * (2.2 - forwardSpeed), 0, 1);
        if (state.wheelsOnGround === 0) setPhase("Flip");
        return alongGravity + M * 2.5 * (2.2 - forwardSpeed);
      }
      case "Flip": {
        // past the end of the runway the car is upside down: roll it 180° about its own length (an x-axis flip), so it
        // comes up on its wheels facing the way it is moving. Side-on, an even burst cancels sideways drift; once the
        // floor faces the ground the jets start carrying the weight.
        state.fanCommand = 0;
        if (state.phaseTime < 1e-6) state.flipStartRoll = state.rollAngle;
        const [turned, rate] = rotationProfile(state.phaseTime, Math.PI, FLIP_DURATION), wantRoll = state.flipStartRoll + turned;
        const carUp = upVector();
        let lift = 0;
        if (carUp.y > 0.3) lift = Math.max(0, M * (g + 6 * (-2.5 - state.velocity.y))) / carUp.y;
        else lift = sidewaysCorrection(carUp.z);
        commandFloorJets(Math.min(lift, fullLift * 0.7), I.x * (70 * (wantRoll - state.rollAngle) + 16 * (rate - att.rollRate)), I.z * 10 * -att.pitchRate);
        if (state.phaseTime >= FLIP_DURATION && Math.abs(wantRoll - state.rollAngle) < 0.12) setPhase("Hover");
        if (anyWheelDown()) setPhase("Touchdown");
        return 0;
      }
      case "Hover": {
        // level out facing away from the ramp and hover slowly down; the diffuser or nose jets hold position over the
        // landing spot at the foot of the ramp
        const height = Math.max(0, state.position.y - COM_HEIGHT - 0.1), wantVy = -clamp(0.32 * height + 0.4, 0.6, 2.2);
        const leanZ = clamp(-(0.12 * state.position.z + 0.6 * state.velocity.z), -0.25, 0.25);
        target.setFromAxisAngle(X_AXIS, leanZ).multiply(turn.setFromAxisAngle(Y_AXIS, Math.PI));
        const torque = torqueToward(target, 3, 8), upY = Math.max(0.3, upVector().y);
        commandFloorJets(Math.max(0, M * (g + 8 * (wantVy - state.velocity.y))) / upY, torque.roll, torque.pitch);
        const wantAccelX = 1.1 * (RAMP.landingX - state.position.x) - 1.9 * state.velocity.x;
        const alongCar = wantAccelX * Math.sign(att.forward.x || 1);   // + means push the way the nose points
        if (alongCar > 0) for (const n of tailJets) n.command = Math.min(1, M * alongCar / (4 * n.maxThrust));
        else for (const n of noseJets) n.command = Math.min(1, M * -alongCar / (2 * n.maxThrust));
        yawWithNoseJets(torque.yaw);
        if (anyWheelDown()) setPhase("Touchdown");
        return 0;
      }
      case "Drive off":
        if (state.phaseTime > 2.2) setPhase("Brake");
        return M * 2.2 * (RAMP_APPROACH_SPEED - forwardSpeed);
      case "Descend":
        glideDown(att, pitchHold, 0);
        return 0;
    }
    return 0;
  }

  /** Both stunts, once the car is back on the ground: settle, brake (with the jets' help), park. */
  function afterLanding(forwardSpeed: number, pitchHold: number, drive: number): number {
    switch (state.phase) {
      case "Touchdown":
        commandFloorJets(state.phaseTime < 0.1 ? M * g * 0.6 : 0, 0, pitchHold);
        if (state.phaseTime > 0.25) setPhase(state.scenario === "ramp" ? "Drive off" : "Brake");
        return -M * 2.5 * forwardSpeed;
      case "Brake":
        if (state.phaseTime < 0.7) for (const n of forwardSpeed > 0 ? noseJets : tailJets) n.command = 0.7;
        if (Math.abs(forwardSpeed) < 0.12 && state.phaseTime > 0.8) setPhase("Parked");
        return -M * 2.5 * forwardSpeed;
      case "Parked":
        return -M * 3 * forwardSpeed;
    }
    return drive;
  }

  /** Runs once per physics step. Sets every nozzle's command and the fans, and returns the drive force per wheel. */
  return function control(): number {
    const att = readAttitude(), forwardSpeed = att.forward.dot(state.velocity);
    for (const n of nozzles) n.command = 0;
    const pitchHold = I.z * (30 * -att.pitch + 10 * -att.pitchRate);
    let drive: number;
    if (state.scenario === "drive" || state.pilot === "player") drive = playerControl(att, forwardSpeed);
    else {
      drive = state.scenario === "jump" ? lineupJump(att, forwardSpeed, pitchHold) : rampHang(att, forwardSpeed, pitchHold);
      drive = afterLanding(forwardSpeed, pitchHold, drive);
    }
    const limit = state.scenario === "jump" && state.pilot === "auto" ? 14000 : 34000;
    return clamp(drive, -limit, limit) / 4;
  };
}
