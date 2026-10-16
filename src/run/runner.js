// Steps the physics and applies it to the scene: car pose, suspension, wheels, nozzle glow, gas and HUD; switches stunts.
import * as THREE from "three";
import { state } from "../core/state.js";
import { canvas, hudAlt, hudFan, hudJets, hudPhase, hudRot, hudSpd, pauseBtn, stage, stuntBtns } from "../ui/dom.js";
import { COM, RAMP, TRACK_Z, WR, XW } from "../config.js";
import { NOZ, car, wheels, wing } from "../car/roadster.js";
import { makeRoadsterSim } from "../physics/roadster-sim.js";
import { lineup } from "../stunts/lineup.js";
import { rampGroup } from "../stunts/ramp.js";
import { course, followLight, gameUI, headlight } from "../game/course.js";
import { gameBust, gameHit, gameInput, gameReset, gameUpdate, toast } from "../game/game.js";
import { MAXP, _d, _p, _q, updateParts } from "../effects/plumes.js";
import { updateCamera } from "../camera/camera.js";

/* ---------- the run: physics drives the car, the gas and the HUD ---------- */
const sim = makeRoadsterSim(THREE, { WR, COM, XW, TRACK_Z, X_TAKE: -10, nozzles: NOZ, ramp: RAMP, onBust: gameBust, onHit: gameHit, onRecover: () => { if (st.scn === "drive") toast("Back on your wheels"); } });
const st = sim.st;
const WING_MODES = ["Road", "High-Downforce", "Low-Drag"];
function updateWing(dt) {
  const u = wing.userData, k = Math.min(1, dt * 3);
  u.k += ((u.mode === 0 ? 0 : 1) - u.k) * k;
  u.pitch += ((u.mode === 1 ? -0.2 : 0) - u.pitch) * k;
  const y = 0.88 + (1.16 - 0.88) * u.k;
  u.plane.position.y = y; u.plane.rotation.z = u.pitch * u.k;
  for (const s of [-1, 1]) { const tip = u["tip" + s]; tip.scale.y = Math.max(0.01, u.k); tip.visible = u.k > 0.05; }
  for (const p of u.posts) { const h = Math.max(0.01, y - 0.93); p.scale.y = h; p.position.y = 0.93 + h / 2; p.visible = u.k > 0.05; }
  st.wing = u.mode;
}
function emitFrom(n, f, dt) {
  let c = Math.floor((30 + 190 * f) * dt + Math.random());
  if (!c) return;
  n.o.getWorldPosition(_p); n.o.getWorldQuaternion(_q); _d.set(0, -1, 0).applyQuaternion(_q);
  const speed = 3 + 15 * f, size = 0.32 + 0.5 * f;
  while (c-- > 0 && state.parts.length < MAXP) {
    const sp = speed * (0.6 + Math.random() * 0.7), j = speed * 0.18;
    state.parts.push({ x: _p.x, y: _p.y, z: _p.z, vx: _d.x * sp + (Math.random() - 0.5) * j, vy: _d.y * sp + (Math.random() - 0.5) * j, vz: _d.z * sp + (Math.random() - 0.5) * j,
      life: 1, decay: 0.45 + Math.random() * 0.5, s: size * (0.5 + Math.random() * 0.6), grow: size * (1.2 + Math.random()) });
  }
}
function restart(scn) { sim.reset(scn); state.parts = []; state.snapCam = true; }
const STUNTS = { jump: "Lineup jump", ramp: "Ramp hang", drive: "Drive it" };
function setStunt(scn) {
  restart(scn);
  lineup.visible = scn === "jump"; rampGroup.visible = scn === "ramp";
  const drv = scn === "drive";
  course.visible = followLight.visible = headlight.visible = drv; gameUI.hidden = !drv; stage.classList.toggle("driving", drv);
  st.boxes = []; if (drv) { gameReset(false); if (!state.playing) { state.playing = true; pauseBtn.lastElementChild.textContent = "Pause"; } canvas.focus({ preventScroll: true }); }
  for (const b of stuntBtns) b.setAttribute("aria-selected", String(b.dataset.stunt === scn));
  if (!state.playing) { simulate(1 / 60); updateCamera(0); }
  state.dirty = true;
}
function simulate(dt) {
  if (st.scn === "drive") gameInput();
  sim.step(dt);
  if (st.phase === "Parked" && st.pt > 2.8) restart();
  car.position.copy(st.pos); car.quaternion.copy(st.q); car.updateMatrixWorld(true);
  sim.wheels.forEach((w, i) => {      // each wheel rides its own spring and spins at road speed
    const v = wheels[i]; v.g.position.y = WR - COM + sim.LS0 - w.len;
    v.ang = (v.ang || 0) + w.spin * dt; v.spin.rotation.z = -v.ang * v.side;
  });
  let on = 0, kN = 0;
  for (const n of sim.noz) {
    const f = n.T / n.Tmax;
    if (f > 0.04) { on++; emitFrom(n, f, dt); }
    kN += n.T / 1000; n.glowMat.emissiveIntensity = 2.5 * f;
  }
  updateParts(dt); updateWing(dt);
  if (st.scn === "drive") gameUpdate(dt);
  hudPhase.textContent = st.phase;
  hudAlt.textContent = Math.max(0, st.pos.y - COM).toFixed(1) + " m";
  hudSpd.textContent = Math.round(st.vel.length() * 3.6) + " km/h";
  const rampPitch = st.scn === "ramp" && ["Approach", "Fans", "Climb", "Hang", "Exit"].includes(st.phase);   // on the wall it pitches; past the runway it rolls
  hudRot.textContent = Math.round((((rampPitch ? st.pitch : st.roll) * 180 / Math.PI) % 360 + 360) % 360) + "°";
  hudJets.textContent = on ? `${on} / 10 · ${Math.round(kN)} kN` : "0 / 10";
  hudJets.classList.toggle("on", on > 0);
  hudFan.textContent = st.fan > 0.02 ? Math.round(st.fan * sim.FAN_MAX / 1000) + " kN" : "off";
  hudFan.classList.toggle("on", st.fan > 0.02);
  state.dirty = true;
}

export { WING_MODES, restart, setStunt, sim, simulate, st, updateWing };
