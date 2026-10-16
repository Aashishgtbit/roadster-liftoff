// Runs both stunts headlessly with the exact physics code shipped in index.html and checks the outcomes.
//   npm install && npm test
import * as THREE from "three";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("/* ---------- physics: a rigid body"), end = html.indexOf("/* ---------- the lineup from the demo");
assert.ok(start > 0 && end > start, "physics block not found in index.html");
const makeRoadsterSim = new Function("THREE", html.slice(start, end) + "\nreturn makeRoadsterSim;")(THREE);

const V = THREE.Vector3, COM = 0.55, nozzles = [];
for (const x of [-1.6, 1.6]) for (const z of [-0.55, 0.55]) nozzles.push({ p: new V(x, 0.14 - COM, z), e: new V(0, -1, 0), group: "down", Tmax: 18000 });
for (const z of [-0.375, -0.135, 0.135, 0.375]) nozzles.push({ p: new V(-2.30, 0.52 - COM, z), e: new V(-1, 0, 0), group: "rear", Tmax: 7000 });
for (const z of [-0.3, 0.3]) nozzles.push({ p: new V(2.2, 0.30 - COM, z), e: new V(1, 0, 0), group: "front", Tmax: 5000 });
const RAMP = { cx: 4, R: 7.2, thMax: 0.9 * Math.PI, hw: 2.4, land: 1.4 };
const events = [];
const sim = makeRoadsterSim(THREE, { WR: 0.36, COM, XW: [-1.49, 1.42], TRACK_Z: 0.84, X_TAKE: -10, nozzles, ramp: RAMP,
  onBust: (b) => events.push("bust " + b.id), onHit: (b, v) => events.push(`hit ${b.id} ${v.toFixed(1)}`) });
const st = sim.st;

function run(scn, seconds, each) {
  sim.reset(scn);
  let last = "", touchdownVy = null, prevVy = 0;
  const phases = [];
  for (let i = 0; i < seconds / sim.DT; i++) {
    sim.substep();
    if (st.phase !== last) { phases.push(st.phase); if (st.phase === "Touchdown") touchdownVy = prevVy; last = st.phase; }
    prevVy = st.vel.y;
    assert.ok(Number.isFinite(st.pos.x + st.pos.y + st.pos.z), `${scn}: state went non-finite`);
    each?.();
  }
  return { phases, touchdownVy };
}

let failures = 0;
function check(name, fn) { try { fn(); console.log(`ok   ${name}`); } catch (e) { failures++; console.log(`FAIL ${name}\n     ${e.message}`); } }

// lineup jump: roll over five parked vehicles and land
{
  const lineup = [[-1.5, 0.95, 1.6], [1.6, 0.95, 1.6], [4.9, 1.25, 3.5], [8.3, 1.0, 1.95], [11.2, 0.96, 1.5]];
  const corners = []; for (const x of [-2.28, 2.28]) for (const y of [-0.45, 0.62]) for (const z of [-1, 1]) corners.push(new V(x, y, z));
  let apex = 0, clearance = Infinity, maxZ = 0;
  const r = run("jump", 16, () => {
    apex = Math.max(apex, st.pos.y); maxZ = Math.max(maxZ, Math.abs(st.pos.z));
    for (const c of corners) { const w = c.clone().applyQuaternion(st.q).add(st.pos); for (const [vx, hw, h] of lineup) if (Math.abs(w.x - vx) < hw) clearance = Math.min(clearance, w.y - h); }
  });
  check("jump: reaches every phase", () => { for (const p of ["Approach", "Spool", "Lift", "Roll", "Descend", "Touchdown", "Brake", "Parked"]) assert.ok(r.phases.includes(p), `missing ${p}`); });
  check(`jump: clears the lineup (min ${clearance.toFixed(2)} m)`, () => assert.ok(clearance > 0.5));
  check(`jump: apex 5–9 m (${(apex - COM).toFixed(2)} m)`, () => assert.ok(apex - COM > 5 && apex - COM < 9));
  check(`jump: soft touchdown (${r.touchdownVy.toFixed(2)} m/s)`, () => assert.ok(r.touchdownVy > -2.5));
  check(`jump: full 360° roll (${(st.roll * 180 / Math.PI).toFixed(0)}°)`, () => assert.ok(Math.abs(st.roll - 2 * Math.PI) < 0.15));
  check(`jump: stays near the centreline (max ${maxZ.toFixed(2)} m)`, () => assert.ok(maxZ < 4));
}

// ramp hang: climb on suction, pause upside down, tip off the end of the runway, roll 180° about the car's length
// (an x-axis flip), land on the wheels facing opposite to the runway, drive away
{
  let hangY = null, tdX = null, tdUp = null, tdFwd = null;
  const r = run("ramp", 20, () => {
    if (st.phase === "Hang" && hangY === null) hangY = st.pos.y;
    if (st.phase === "Touchdown" && tdX === null) { tdX = st.pos.x; tdUp = new V(0, 1, 0).applyQuaternion(st.q).y; tdFwd = new V(1, 0, 0).applyQuaternion(st.q).x; }
  });
  check("ramp: reaches every phase", () => { for (const p of ["Approach", "Fans", "Climb", "Hang", "Exit", "Flip", "Hover", "Touchdown", "Drive off", "Brake", "Parked"]) assert.ok(r.phases.includes(p), `missing ${p}`); });
  check(`ramp: hangs upside down high on the wall (${hangY?.toFixed(2)} m)`, () => assert.ok(hangY > 10));
  check(`ramp: soft touchdown (${r.touchdownVy.toFixed(2)} m/s)`, () => assert.ok(r.touchdownVy > -1.5));
  check(`ramp: the flip is a 180° roll about the car's length (${(st.roll * 180 / Math.PI).toFixed(0)}°)`, () => assert.ok(Math.abs(Math.abs(st.roll) - Math.PI) < 0.2));
  check(`ramp: lands on its wheels (up ${tdUp.toFixed(2)})`, () => assert.ok(tdUp > 0.95));
  check(`ramp: lands facing opposite to the runway (forward x ${tdFwd.toFixed(2)})`, () => assert.ok(tdFwd < -0.95));
  check(`ramp: lands at the foot of the ramp (x ${tdX.toFixed(2)})`, () => assert.ok(tdX > -3 && tdX < RAMP.cx - 1));
  check(`ramp: then drives away from the ramp (x ${st.pos.x.toFixed(2)})`, () => assert.ok(st.pos.x < tdX - 5));
}

// drive mode: an autopilot holds the gas and uses the jets for walls; crates must burst, walls must be cleared
{
  const boxes = [
    { id: "crates", x0: 40, x1: 41.2, y0: 0, y1: 2.4, z0: -4.2, z1: 4.2, bust: true },
    { id: "wall", kind: "wall", x0: 90, x1: 91, y0: 0, y1: 2.4, z0: -8, z1: 8 },
    { id: "slow-crates", x0: 200, x1: 201.2, y0: 0, y1: 2.4, z0: -4.2, z1: 4.2, bust: true },
  ];
  sim.reset("drive"); st.boxes = boxes; events.length = 0;
  let maxH = 0, stoppedAt = null;
  for (let i = 0; i < 40 / sim.DT; i++) {
    st.input.throttle = st.pos.x < 120 ? 1 : st.vel.x > 4 ? -1 : 0.3;   // brake to a crawl into the last stack: it must not burst
    st.input.jet = (90 - st.pos.x) / Math.max(1, st.vel.x) < 0.95 && st.pos.x < 92; st.input.steer = 0;   // like a player: about a second before the wall
    sim.substep(); maxH = Math.max(maxH, st.pos.y - COM);
    if (st.pos.x > 190 && Math.abs(st.vel.x) < 0.05 && stoppedAt === null) stoppedAt = st.pos.x;
  }
  check("drive: crates burst when hit fast", () => assert.ok(events.includes("bust crates"), events.join(", ")));
  check("drive: the jets clear the wall without touching it", () => { assert.ok(!events.some(e => e.startsWith("hit wall")), events.join(", ")); assert.ok(st.pos.x > 100); });
  check(`drive: the jets hover rather than rocket (max ${maxH.toFixed(2)} m)`, () => assert.ok(maxH > 2.4 && maxH < 6));
  check(`drive: crates hold when hit slowly (stopped at x ${stoppedAt?.toFixed(1)})`, () => { assert.ok(!events.includes("bust slow-crates")); assert.ok(stoppedAt !== null && stoppedAt < 200); });
}

// drive mode: a kicker ramp launches the car over a wall without fuel; a fast wall hit stops the car, never tunnels
{
  const wall = { id: "wall", kind: "wall", x0: 90, x1: 91, y0: 0, y1: 2.4, z0: -8, z1: 8 };
  sim.reset("drive"); st.boxes = [{ id: "ramp", ramp: true, x0: 67, x1: 74, h: 1.8, z0: -3.2, z1: 3.2 }, wall]; events.length = 0;
  for (let i = 0; i < 12 / sim.DT; i++) { st.input.throttle = 1; st.input.jet = false; st.input.steer = 0; sim.substep(); }
  check("drive: a kicker ramp carries the car over a wall with no jets", () => { assert.ok(!events.some(e => e.startsWith("hit wall")), events.join(", ")); assert.ok(st.pos.x > 100); });
  sim.reset("drive"); st.boxes = [wall]; events.length = 0;
  let fastest = 0;
  for (let i = 0; i < 10 / sim.DT; i++) { st.input.throttle = 1; st.input.jet = false; sim.substep(); fastest = Math.max(fastest, st.vel.x); }
  check(`drive: a ${Math.round(fastest * 3.6)} km/h wall hit stops the car in front of the wall`, () => { assert.ok(events.some(e => e.startsWith("hit wall"))); assert.ok(st.pos.x < wall.x0, `car at x ${st.pos.x.toFixed(2)}`); });
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log("\nall checks passed");
