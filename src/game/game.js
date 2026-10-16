// Drive it: game rules, scoring, input (keyboard and touch), pickups, debris and the HUD.
import * as THREE from "three";
import { state } from "../core/state.js";
import { COM } from "../config.js";
import { CRASH_SPEED, FINISH_X, MAT, MAX_CRASHES, bestRec, buildCourse, course, followLight, fuelBar, fuelNum, game, gameBest, gameDamage, gameLeft, gameOver, gameScore, gameSpeed, gameTime, gameToast, gameUI, goBest, goBusts, goCans, goNew, goScore, goTime, goTitle, store } from "./course.js";
import { st } from "../run/runner.js";
import { snd } from "../audio/sound.js";

function gameReset(newLayout) {
  if (newLayout || !game.seed) buildCourse(1 + Math.floor(Math.random() * 2147483000));
  for (const b of game.boxes) { b.gone = false; b.hitT = 0; if (b.g) b.g.visible = true; }
  for (const c of game.cans) { c.got = false; c.g.visible = true; }
  for (const d of game.debris) course.remove(d.m); game.debris = [];
  Object.assign(game, { started: false, over: false, t: 0, busts: 0, cansGot: 0, crashes: 0, best: 0, shake: 0 });
  st.boxes = game.boxes; gameOver.hidden = true; toast("Gas to start");
}
function toast(text) { gameToast.textContent = text; gameToast.classList.add("show"); game.toastT = 1.6; }
function chime(f0) {
  if (!snd.on || !snd.ctx) return;
  const t = snd.ctx.currentTime, o = snd.ctx.createOscillator(), g = snd.ctx.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2, t + 0.12);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g); g.connect(snd.master); o.start(t); o.stop(t + 0.4);
}
const score = () => Math.max(0, Math.round(Math.max(0, game.best) + game.busts * 100 + game.cansGot * 25 - game.crashes * 200));
function gameBust(b, v) {
  if (st.scn !== "drive") return;
  b.g.visible = false; game.busts++; toast(`Busted at ${Math.round(v * 3.6)} km/h · +100`); game.shake = 0.25;
  if (snd.on) { snd.thump(0.9); snd.burst(0.5, "bandpass", 900, 0.6); }
  for (const c of b.g.children) {   // the stack bursts into its crates
    const m = new THREE.Mesh(MAT.crateGeo, MAT.crate); c.getWorldPosition(m.position); m.castShadow = true; course.add(m);
    game.debris.push({ m, v: new THREE.Vector3(v * (0.5 + Math.random() * 0.6), 2 + Math.random() * 5, (m.position.z - st.pos.z) * 0.9 + (Math.random() - 0.5) * 4),
      w: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4), life: 5 });
  }
}
function gameHit(b, v) {
  if (st.scn !== "drive" || game.over) return;
  if (b.kind === "barrier") { if (snd.on && v > 5) snd.burst(0.25, "bandpass", 1400, Math.min(0.5, v / 30)); game.shake = Math.min(0.3, v / 40); return; }   // scrape along it
  if (b.kind === "wall" && v > CRASH_SPEED) {   // a crash: costs fuel and points; three wreck the car
    game.crashes++; game.shake = 0.6; st.fuel = Math.max(0, st.fuel - 15);
    if (snd.on) { snd.thump(1); snd.burst(0.6, "lowpass", 700, 0.9); snd.burst(0.3, "highpass", 3000, 0.4); }
    if (game.crashes >= MAX_CRASHES) endRun(false); else toast(`Crash at ${Math.round(v * 3.6)} km/h · ${MAX_CRASHES - game.crashes} left`);
    return;
  }
  toast(b.kind === "wall" ? "Walls don't bust · fly over with Space" : `Too slow to bust (${Math.round(v * 3.6)} km/h) · go 45+`);
  if (snd.on) snd.thump(Math.min(1, v / 10));
}
function endRun(finished) {
  game.over = true;
  const sc = score() + (finished ? Math.max(0, Math.round((60 - game.t) * 10)) : 0);
  let fresh = false;
  if (finished && (!bestRec.time || game.t < bestRec.time)) { bestRec.time = game.t; fresh = true; }
  if (finished && (!bestRec.score || sc > bestRec.score)) { bestRec.score = sc; fresh = true; }
  if (fresh) store.set(bestRec);
  goTitle.textContent = finished ? "Finish" : "Wrecked";
  goScore.textContent = sc; goTime.textContent = finished ? game.t.toFixed(1) + " s" : "—"; goBusts.textContent = game.busts; goCans.textContent = game.cansGot;
  goBest.textContent = bestRec.time ? `${bestRec.time.toFixed(1)} s · ${bestRec.score} pts` : "—"; goNew.hidden = !fresh;
  gameOver.hidden = false;
  toast(finished ? "Finish!" : "Wrecked"); if (finished) { chime(520); setTimeout(() => chime(780), 140); }
}
const keys = {};
const KEYMAP = { KeyW: "gas", ArrowUp: "gas", KeyS: "brake", ArrowDown: "brake", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", Space: "jet", ShiftLeft: "boost", ShiftRight: "boost" };
window.addEventListener("keydown", e => {
  if (st.scn !== "drive" || !state.visible) return;
  if (e.code === "KeyR") { resetUpright(); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  keys[k] = true; e.preventDefault();
});
window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
for (const b of document.querySelectorAll("[data-key]")) {
  const k = b.dataset.key, on = e => { e.preventDefault(); if (k === "reset") resetUpright(); else keys[k] = true; b.classList.add("down"); }, off = () => { keys[k] = false; b.classList.remove("down"); };
  b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off);
}
function resetUpright() {   // R: put the car back on its wheels where it is, keeping its heading
  const f = new THREE.Vector3(1, 0, 0).applyQuaternion(st.q), yaw = Math.atan2(-f.z, f.x);
  st.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw); st.w.set(0, 0, 0); st.vel.multiplyScalar(0.2);
  st.pos.y = Math.max(st.pos.y, COM + 0.3); st.roll = st.pitch = 0; toast("Reset");
}
function gameInput() {
  const inp = st.input, go = !game.over;
  inp.throttle = go ? (keys.gas ? 1 : 0) - (keys.brake ? 1 : 0) : (st.vel.x > 0.5 ? -1 : 0);   // after the run: brake to a stop, never reverse
  inp.steer = go ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0) : 0;
  inp.jet = go && !!keys.jet; inp.boost = go && !!keys.boost;
  if (!game.started && go && (inp.throttle > 0 || inp.jet || inp.boost)) { game.started = true; toast("Go! Bust crates, fly over walls"); }
}
function gameUpdate(dt) {
  if (game.started && !game.over) game.t += dt;
  game.best = Math.max(game.best, st.pos.x);
  game.shake = Math.max(0, game.shake - dt);
  for (const c of game.cans) {   // fuel canisters spin, bob and get picked up
    if (c.got) continue;
    c.g.rotation.y += dt * 2; c.g.position.y = c.y + Math.sin(st.t * 3 + c.x) * 0.12;
    if (c.g.position.distanceToSquared(st.pos) < 2.4 * 2.4) { c.got = true; c.g.visible = false; game.cansGot++; st.fuel = Math.min(100, st.fuel + 25); toast("Fuel +25"); chime(660); }
  }
  for (let i = game.debris.length - 1; i >= 0; i--) {
    const d = game.debris[i]; d.v.y -= 9.81 * dt; d.m.position.addScaledVector(d.v, dt);
    d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
    if (d.m.position.y < 0.6) { d.m.position.y = 0.6; d.v.y *= -0.3; d.v.x *= 0.7; d.v.z *= 0.7; d.w.multiplyScalar(0.7); }
    if ((d.life -= dt) < 0) { course.remove(d.m); game.debris.splice(i, 1); }
  }
  if (!game.over && st.pos.x >= FINISH_X) endRun(true);
  if ((game.toastT -= dt) < 0) gameToast.classList.remove("show");
  fuelBar.style.width = st.fuel.toFixed(1) + "%"; fuelBar.classList.toggle("low", st.fuel < 20);
  fuelNum.textContent = Math.round(st.fuel);
  gameScore.textContent = score();
  gameSpeed.textContent = Math.round(st.vel.length() * 3.6);
  if (game.started) gameUI.classList.toggle("seasoned", game.t > 8);
  gameLeft.textContent = Math.max(0, Math.round(FINISH_X - st.pos.x)) + " m";
  gameTime.textContent = game.t.toFixed(1) + " s";
  gameBest.textContent = bestRec.time ? bestRec.time.toFixed(1) + " s" : "—";
  gameDamage.textContent = "●".repeat(game.crashes) + "○".repeat(MAX_CRASHES - game.crashes);
  followLight.position.set(st.pos.x - 8, 20, st.pos.z + 10); followLight.target.position.copy(st.pos);
}

export { gameBust, gameHit, gameInput, gameReset, gameUpdate, toast };
