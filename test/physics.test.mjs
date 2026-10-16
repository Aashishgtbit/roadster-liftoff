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
const sim = makeRoadsterSim(THREE, { WR: 0.36, COM, XW: [-1.49, 1.42], TRACK_Z: 0.84, X_TAKE: -10, nozzles, ramp: RAMP });
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

// ramp hang: climb on suction, pause upside down, tip off the lip, flip, hover down, land at the foot
{
  let hangY = null;
  const r = run("ramp", 18, () => { if (st.phase === "Hang" && hangY === null) hangY = st.pos.y; });
  check("ramp: reaches every phase", () => { for (const p of ["Approach", "Fans", "Climb", "Hang", "Exit", "Flip", "Hover", "Touchdown", "Brake", "Parked"]) assert.ok(r.phases.includes(p), `missing ${p}`); });
  check(`ramp: hangs upside down high on the wall (${hangY?.toFixed(2)} m)`, () => assert.ok(hangY > 10));
  check(`ramp: soft touchdown (${r.touchdownVy.toFixed(2)} m/s)`, () => assert.ok(r.touchdownVy > -1.5));
  check(`ramp: upright at the end (pitch ${(st.pitch * 180 / Math.PI).toFixed(0)}°)`, () => assert.ok(Math.abs(st.pitch - 2 * Math.PI) < 0.15));
  check(`ramp: lands at the foot of the ramp (x ${st.pos.x.toFixed(2)})`, () => assert.ok(st.pos.x > -3 && st.pos.x < RAMP.cx - 1));
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log("\nall checks passed");
