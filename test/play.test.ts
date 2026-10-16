// The two stunts, played: an autopilot presses the same keys a player would, to show each stunt can be done with
// the player's controls (and that the scripted demo still clears the now-solid lineup).
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { COM_HEIGHT, RAMP } from "../src/config";
import { NOZZLE_SPECS } from "../src/car/nozzle-layout";
import { DT } from "../src/physics/constants";
import { createRoadsterSim } from "../src/physics/simulation";
import type { DriverInput } from "../src/physics/types";
import { LINEUP_END_X, lineupObstacles } from "../src/stunts/lineup-layout";

const log: string[] = [];
const landings: { x: number; vy: number; up: number; forwardX: number }[] = [];
const sim = createRoadsterSim(NOZZLE_SPECS, {
  onHit: (b, v) => log.push(`hit ${b.id} ${v.toFixed(1)}`),
  onLanding: vy => landings.push({ x: car.position.x, vy, up: up().y, forwardX: new Vector3(1, 0, 0).applyQuaternion(car.orientation).x }),
});
const car = sim.state;
const up = () => new Vector3(0, 1, 0).applyQuaternion(car.orientation);
const keys = (k: Partial<DriverInput>) => Object.assign(car.input, { throttle: 0, steer: 0, roll: 0, jets: false, boost: false }, k);
const rampAngle = () => Math.atan2(car.position.x - RAMP.startX, -(car.position.y - RAMP.radius));

describe("lineup jump, played", () => {
  it("the scripted demo still clears the solid lineup", () => {
    log.length = 0;
    sim.reset("jump", "auto"); car.obstacles = lineupObstacles();
    for (let i = 0; i < 16 / DT; i++) sim.substep();
    expect(log).toEqual([]);
    expect(car.phase).toBe("Parked");
  });

  it("gas, jets over the lineup, one roll with E, soft landing with S", () => {
    log.length = 0; landings.length = 0;
    sim.reset("jump", "player"); car.obstacles = lineupObstacles();
    let peak = 0, rollDone = false;
    for (let i = 0; i < 12 / DT; i++) {
      const x = car.position.x, h = car.position.y - COM_HEIGHT;
      if (x < -20) keys({ throttle: 1 });
      else if (x < LINEUP_END_X) {
        if (!rollDone && h > 4 && Math.abs(car.rollAngle) < 2 * Math.PI - 1.4) keys({ jets: true, roll: 1 });
        else { rollDone ||= h > 4; keys({ jets: true }); }
      } else keys({ throttle: -1 });   // past the lineup: let it down softly
      sim.substep();
      peak = Math.max(peak, h);
    }
    const landing = landings.at(-1)!;
    expect(log, "no vehicle hit").toEqual([]);
    expect(landing.x).toBeGreaterThan(LINEUP_END_X);
    expect(landing.up).toBeGreaterThan(0.9);
    expect(landing.vy).toBeGreaterThan(-2.5);
    expect(Math.round(car.rollAngle / (2 * Math.PI))).toBe(1);
    expect(peak).toBeLessThan(11);
  });

  it("driving into the lineup is a hit", () => {
    log.length = 0;
    sim.reset("jump", "player"); car.obstacles = lineupObstacles();
    for (let i = 0; i < 6 / DT; i++) { keys({ throttle: 1 }); sim.substep(); }
    expect(log.some(e => e.startsWith("hit white sedan"))).toBe(true);
  });
});

describe("ramp hang, played", () => {
  it("climb, stop upside down, drive off the end, roll 180° with E, land facing back", () => {
    landings.length = 0;
    sim.reset("ramp", "player"); car.obstacles = [];
    let hang = 0, maxAngle = 0, leftRamp = false;
    for (let i = 0; i < 20 / DT; i++) {
      const angle = rampAngle(), flying = car.wheelsOnGround === 0;
      maxAngle = Math.max(maxAngle, car.position.x > RAMP.startX ? angle : 0);
      if (!leftRamp && flying && maxAngle > 2.4) leftRamp = true;
      if (!leftRamp) {
        if (angle < 0.66 * Math.PI || hang > 1.5) keys({ throttle: 1 });
        else { keys({}); if (car.phase === "Hang") hang += DT; }
      } else if (Math.abs(car.rollAngle) < Math.PI * 0.6) keys({ roll: 1 });
      else keys({ throttle: -1 });   // let it down softly
      sim.substep();
      if (leftRamp && landings.length && car.wheelsOnGround >= 3) break;
    }
    const landing = landings.at(-1)!;
    expect(hang, "held upside down at the top").toBeGreaterThan(1);
    expect(maxAngle, "reached the end of the ramp").toBeGreaterThan(0.85 * Math.PI);
    expect(landing.up, "landed on its wheels").toBeGreaterThan(0.9);
    expect(landing.forwardX, "facing back past the runway").toBeLessThan(-0.7);
    expect(landing.vy).toBeGreaterThan(-3);
  });
});

describe("drive it: a flip in the air", () => {
  it("Space to lift, hold E, let go: a full roll and back on the wheels", () => {
    landings.length = 0;
    sim.reset("drive"); car.obstacles = []; car.fuel = 100;
    let rolledAt = NaN;
    for (let i = 0; i < 10 / DT; i++) {
      const h = car.position.y - COM_HEIGHT;
      if (i < 1.5 / DT) keys({ throttle: 1 });
      else if (Number.isNaN(rolledAt) && h < 3.5) keys({ throttle: 1, jets: true });
      else if (Math.abs(car.rollAngle) < 1.2 * Math.PI) { rolledAt = car.time; keys({ jets: true, roll: 1 }); }   // past halfway: the assist finishes it
      else keys({ throttle: -1 });
      sim.substep();
    }
    const landing = landings.at(-1)!;
    expect(Math.round(car.rollAngle / (2 * Math.PI))).toBe(1);
    expect(landing.up).toBeGreaterThan(0.9);
    expect(landing.vy).toBeGreaterThan(-3);
  });
});
