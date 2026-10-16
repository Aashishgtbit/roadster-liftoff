// Runs every stunt and the game physics headlessly with the real physics module and the car's real nozzle layout,
// and checks how each one ends.
import { Vector3 } from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { BARRIERS, COM_HEIGHT, RAMP, TRACK_HALF_WIDTH } from "../src/config";
import { NOZZLE_SPECS } from "../src/car/nozzle-layout";
import { DT } from "../src/physics/constants";
import { createRoadsterSim } from "../src/physics/simulation";
import type { BoxObstacle, DriverInput, Obstacle, Phase, Scenario } from "../src/physics/types";

const events: string[] = [];
const sim = createRoadsterSim(NOZZLE_SPECS, {
  onBust: b => events.push(`bust ${b.id}`),
  onHit: (b, v) => events.push(`hit ${b.id} ${v.toFixed(1)}`),
});
const car = sim.state;
const steps = (seconds: number) => Math.round(seconds / DT);
const up = () => new Vector3(0, 1, 0).applyQuaternion(car.orientation);
const forward = () => new Vector3(1, 0, 0).applyQuaternion(car.orientation);
const degrees = (radians: number) => (radians * 180 / Math.PI).toFixed(0);

/** Run a scripted stunt; returns the phases in order and the vertical speed just before touchdown. */
function runStunt(scenario: Scenario, seconds: number, each?: () => void) {
  sim.reset(scenario);
  const phases: Phase[] = [];
  let touchdownVy = NaN, previousVy = 0;
  for (let i = 0; i < steps(seconds); i++) {
    sim.substep();
    if (car.phase !== phases.at(-1)) { phases.push(car.phase); if (car.phase === "Touchdown") touchdownVy = previousVy; }
    previousVy = car.velocity.y;
    expect(Number.isFinite(car.position.x + car.position.y + car.position.z), `${scenario}: state went non-finite`).toBe(true);
    each?.();
  }
  return { phases, touchdownVy };
}

/** Drive mode with the given obstacles and a controller called every step. */
function drive(seconds: number, obstacles: Obstacle[], control: (step: number) => Partial<DriverInput>, each?: () => void) {
  sim.reset("drive");
  car.obstacles = obstacles;
  for (let i = 0; i < steps(seconds); i++) { Object.assign(car.input, control(i)); sim.substep(); each?.(); }
}

const wall = (): BoxObstacle => ({ id: "wall", kind: "wall", minX: 90, maxX: 91, minY: 0, maxY: 2.4, minZ: -8, maxZ: 8 });
const crates = (id: string, x: number): BoxObstacle => ({ id, kind: "crates", minX: x, maxX: x + 1.2, minY: 0, maxY: 2.4, minZ: -4.2, maxZ: 4.2, breakable: true });

beforeEach(() => { events.length = 0; });

describe("lineup jump: roll over five parked vehicles and land", () => {
  // x, half-length along x, roof height of each parked vehicle
  const lineup = [[-1.5, 0.95, 1.6], [1.6, 0.95, 1.6], [4.9, 1.25, 3.5], [8.3, 1.0, 1.95], [11.2, 0.96, 1.5]];
  const corners: Vector3[] = [];
  for (const x of [-2.28, 2.28]) for (const y of [-0.45, 0.62]) for (const z of [-1, 1]) corners.push(new Vector3(x, y, z));
  let apex = 0, clearance = Infinity, maxSideways = 0;
  const run = runStunt("jump", 16, () => {
    apex = Math.max(apex, car.position.y); maxSideways = Math.max(maxSideways, Math.abs(car.position.z));
    for (const c of corners) {
      const p = c.clone().applyQuaternion(car.orientation).add(car.position);
      for (const [x, halfLength, roof] of lineup) if (Math.abs(p.x - x) < halfLength) clearance = Math.min(clearance, p.y - roof);
    }
  });
  const finalRoll = car.rollAngle;

  it("reaches every phase", () => {
    expect(run.phases).toEqual(expect.arrayContaining(["Approach", "Spool", "Lift", "Roll", "Descend", "Touchdown", "Brake", "Parked"]));
  });
  it(`clears the lineup (min ${clearance.toFixed(2)} m)`, () => expect(clearance).toBeGreaterThan(0.5));
  it(`peaks 5–9 m up (${(apex - COM_HEIGHT).toFixed(2)} m)`, () => {
    expect(apex - COM_HEIGHT).toBeGreaterThan(5);
    expect(apex - COM_HEIGHT).toBeLessThan(9);
  });
  it(`touches down softly (${run.touchdownVy.toFixed(2)} m/s)`, () => expect(run.touchdownVy).toBeGreaterThan(-2.5));
  it(`rolls a full 360° (${degrees(finalRoll)}°)`, () => expect(Math.abs(finalRoll - 2 * Math.PI)).toBeLessThan(0.15));
  it(`stays near the centreline (max ${maxSideways.toFixed(2)} m)`, () => expect(maxSideways).toBeLessThan(4));
});

describe("ramp hang: climb, hang upside down, x-axis flip off the end, land facing back, drive away", () => {
  let hangHeight = NaN, touchdownX = NaN, touchdownUp = NaN, touchdownForwardX = NaN;
  const run = runStunt("ramp", 20, () => {
    if (car.phase === "Hang" && Number.isNaN(hangHeight)) hangHeight = car.position.y;
    if (car.phase === "Touchdown" && Number.isNaN(touchdownX)) { touchdownX = car.position.x; touchdownUp = up().y; touchdownForwardX = forward().x; }
  });
  const finalRoll = car.rollAngle, finalX = car.position.x;

  it("reaches every phase", () => {
    expect(run.phases).toEqual(expect.arrayContaining(["Approach", "Fans", "Climb", "Hang", "Exit", "Flip", "Hover", "Touchdown", "Drive off", "Brake", "Parked"]));
  });
  it(`hangs upside down high on the wall (${hangHeight.toFixed(2)} m)`, () => expect(hangHeight).toBeGreaterThan(10));
  it(`touches down softly (${run.touchdownVy.toFixed(2)} m/s)`, () => expect(run.touchdownVy).toBeGreaterThan(-1.5));
  it(`the flip is a 180° roll about the car's length (${degrees(finalRoll)}°)`, () => expect(Math.abs(Math.abs(finalRoll) - Math.PI)).toBeLessThan(0.2));
  it(`lands on its wheels (up ${touchdownUp.toFixed(2)})`, () => expect(touchdownUp).toBeGreaterThan(0.95));
  it(`lands facing opposite to the runway (forward x ${touchdownForwardX.toFixed(2)})`, () => expect(touchdownForwardX).toBeLessThan(-0.95));
  it(`lands at the foot of the ramp (x ${touchdownX.toFixed(2)})`, () => {
    expect(touchdownX).toBeGreaterThan(-3);
    expect(touchdownX).toBeLessThan(RAMP.startX - 1);
  });
  it(`then drives away from the ramp (x ${finalX.toFixed(2)})`, () => expect(finalX).toBeLessThan(touchdownX - 5));
});

describe("drive: crates, walls and the jets", () => {
  it("busts fast crates, clears a wall on the jets, hovers, and is stopped by slow crates", () => {
    let maxHeight = 0, stoppedAt = NaN;
    drive(40, [crates("crates", 40), wall(), crates("slow-crates", 200)], () => ({
      // brake to a crawl into the last stack: it must not burst
      throttle: car.position.x < 120 ? 1 : car.velocity.x > 4 ? -1 : 0.3,
      // like a player: about a second before the wall
      jets: (90 - car.position.x) / Math.max(1, car.velocity.x) < 0.95 && car.position.x < 92, steer: 0,
    }), () => {
      maxHeight = Math.max(maxHeight, car.position.y - COM_HEIGHT);
      if (car.position.x > 190 && Math.abs(car.velocity.x) < 0.05 && Number.isNaN(stoppedAt)) stoppedAt = car.position.x;
    });
    expect(events, "crates burst when hit fast").toContain("bust crates");
    expect(events.some(e => e.startsWith("hit wall")), "the jets clear the wall without touching it").toBe(false);
    expect(maxHeight, "the jets hover rather than rocket").toBeGreaterThan(2.4);
    expect(maxHeight).toBeLessThan(6);
    expect(events, "crates hold when hit slowly").not.toContain("bust slow-crates");
    expect(stoppedAt).toBeLessThan(200);
  });

  it("a kicker ramp carries the car over a wall with no jets", () => {
    drive(12, [{ id: "ramp", kind: "ramp", minX: 67, maxX: 74, height: 1.8, minZ: -3.2, maxZ: 3.2 }, wall()], () => ({ throttle: 1, jets: false, steer: 0 }));
    expect(events.some(e => e.startsWith("hit wall")), events.join(", ")).toBe(false);
    expect(car.position.x).toBeGreaterThan(100);
  });

  it("a flat-out wall hit stops the car in front of the wall, never through it", () => {
    let fastest = 0;
    drive(10, [wall()], () => ({ throttle: 1, jets: false }), () => { fastest = Math.max(fastest, car.velocity.x); });
    expect(fastest * 3.6).toBeGreaterThan(120);
    expect(events.some(e => e.startsWith("hit wall"))).toBe(true);
    expect(car.position.x).toBeLessThan(90);
  });
});

describe("drive: the boundaries keep the car on the track", () => {
  const attempts: [string, (step: number) => Partial<DriverInput>][] = [
    ["steering hard into a barrier", i => ({ throttle: 1, steer: i > 480 ? 1 : 0, jets: false })],
    ["pushing along a barrier", i => ({ throttle: 1, steer: i > 720 ? 0.35 : 0, jets: false })],
    ["flying sideways over it on the jets", i => ({ throttle: 1, steer: i > 480 ? 1 : 0, jets: i > 600 })],
  ];
  for (const [name, control] of attempts) {
    it(`when ${name}`, () => {
      let maxSideways = 0;
      drive(14, BARRIERS.map(b => ({ ...b })), control, () => { car.fuel = 100; maxSideways = Math.max(maxSideways, Math.abs(car.position.z)); });
      expect(maxSideways).toBeLessThan(TRACK_HALF_WIDTH);
    });
  }
});
