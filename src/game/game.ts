// Drive it: game rules, scoring, input (keyboard and touch), fuel pickups, debris and the game HUD.
// Bust crates (45 km/h or more) or fly over them, fly over walls or launch off a kicker ramp, collect fuel. Hitting a
// wall above 35 km/h is a crash; three crashes wreck the car.
import * as THREE from "three";
import { app } from "../core/state";
import { COM_HEIGHT, FINISH_X } from "../config";
import { carState, sim } from "../run/sim";
import { playChime, playNoiseBurst, playThump } from "../audio/sound";
import type { BoxObstacle } from "../physics/types";
import { buildCourse, course, crateGeometry, crateMaterial, followLight } from "./course";
import type { BuiltCourse } from "./course";
import { loadBest, saveBest } from "./records";
import { gameUI, resultsCard } from "./ui";

const CRASH_SPEED = 9.7;   // m/s (35 km/h)
const MAX_CRASHES = 3;
const PICKUP_RADIUS = 2.4;
const CAN_FUEL = 25;
const POINTS = { bust: 100, can: 25, crash: -200 };

interface Debris { mesh: THREE.Mesh; velocity: THREE.Vector3; spin: THREE.Vector3; life: number }

const game = {
  course: null as BuiltCourse | null,
  debris: [] as Debris[],
  started: false,
  over: false,
  time: 0,
  busts: 0,
  cansCollected: 0,
  crashes: 0,
  furthest: 0,      // distance points: the furthest x reached
  toastTime: 0,
  shake: 0,         // camera shake, seconds left
};
const best = loadBest();
const kmh = (metresPerSecond: number) => Math.round(metresPerSecond * 3.6);

/** How hard the camera should shake right now (0 = still). */
export const cameraShake = () => game.shake;

export function showToast(text: string) {
  gameUI.toast.textContent = text;
  gameUI.toast.classList.add("show");
  game.toastTime = 1.6;
}

/** Start a run: on a new random layout, or the same one again. */
export function resetGame(newLayout: boolean) {
  if (newLayout || !game.course) game.course = buildCourse(1 + Math.floor(Math.random() * 2147483000));
  const built = game.course;
  for (const obstacle of built.obstacles) { obstacle.destroyed = false; obstacle.hitCooldown = 0; }
  for (const mesh of built.meshes.values()) mesh.visible = true;
  for (const can of built.cans) { can.collected = false; can.mesh.visible = true; }
  for (const d of game.debris) course.remove(d.mesh);
  Object.assign(game, { debris: [], started: false, over: false, time: 0, busts: 0, cansCollected: 0, crashes: 0, furthest: 0, shake: 0 });
  carState.obstacles = built.obstacles;
  resultsCard.root.hidden = true;
  showToast("Gas to start");
}

const score = () => Math.max(0, Math.round(Math.max(0, game.furthest) + game.busts * POINTS.bust + game.cansCollected * POINTS.can + game.crashes * POINTS.crash));

// ---------- what the physics reports ----------
sim.events.onBust = (stack: BoxObstacle, speed: number) => {
  if (carState.scenario !== "drive" || !game.course) return;
  const mesh = game.course.meshes.get(stack);
  if (!mesh) return;
  mesh.visible = false;
  game.busts++; game.shake = 0.25;
  showToast(`Busted at ${kmh(speed)} km/h · +${POINTS.bust}`);
  playThump(0.9); playNoiseBurst(0.5, "bandpass", 900, 0.6);
  for (const crate of mesh.children) {   // the stack bursts into its crates
    const piece = new THREE.Mesh(crateGeometry, crateMaterial);
    crate.getWorldPosition(piece.position); piece.castShadow = true; course.add(piece);
    game.debris.push({
      mesh: piece,
      velocity: new THREE.Vector3(speed * (0.5 + Math.random() * 0.6), 2 + Math.random() * 5, (piece.position.z - carState.position.z) * 0.9 + (Math.random() - 0.5) * 4),
      spin: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
      life: 5,
    });
  }
};

sim.events.onHit = (obstacle: BoxObstacle, speed: number) => {
  if (carState.scenario !== "drive" || game.over) return;
  if (obstacle.kind === "barrier") {   // scrape along it
    if (speed > 5) playNoiseBurst(0.25, "bandpass", 1400, Math.min(0.5, speed / 30));
    game.shake = Math.min(0.3, speed / 40);
    return;
  }
  if (obstacle.kind === "wall" && speed > CRASH_SPEED) {   // a crash: costs fuel and points; three wreck the car
    game.crashes++; game.shake = 0.6; carState.fuel = Math.max(0, carState.fuel - 15);
    playThump(1); playNoiseBurst(0.6, "lowpass", 700, 0.9); playNoiseBurst(0.3, "highpass", 3000, 0.4);
    if (game.crashes >= MAX_CRASHES) endRun(false);
    else showToast(`Crash at ${kmh(speed)} km/h · ${MAX_CRASHES - game.crashes} left`);
    return;
  }
  showToast(obstacle.kind === "wall" ? "Walls don't bust · fly over with Space" : `Too slow to bust (${kmh(speed)} km/h) · go 45+`);
  playThump(Math.min(1, speed / 10));
};

sim.events.onRecover = () => { if (carState.scenario === "drive") showToast("Back on your wheels"); };

function endRun(finished: boolean) {
  game.over = true;
  const finalScore = score() + (finished ? Math.max(0, Math.round((60 - game.time) * 10)) : 0);   // time bonus under a minute
  let newBest = false;
  if (finished && (!best.time || game.time < best.time)) { best.time = game.time; newBest = true; }
  if (finished && (!best.score || finalScore > best.score)) { best.score = finalScore; newBest = true; }
  if (newBest) saveBest(best);
  resultsCard.title.textContent = finished ? "Finish" : "Wrecked";
  resultsCard.score.textContent = String(finalScore);
  resultsCard.time.textContent = finished ? game.time.toFixed(1) + " s" : "—";
  resultsCard.busts.textContent = String(game.busts);
  resultsCard.cans.textContent = String(game.cansCollected);
  resultsCard.best.textContent = best.time ? `${best.time.toFixed(1)} s · ${best.score} pts` : "—";
  resultsCard.newBest.hidden = !newBest;
  resultsCard.root.hidden = false;
  showToast(finished ? "Finish!" : "Wrecked");
  if (finished) { playChime(520); setTimeout(() => playChime(780), 140); }
}

// ---------- controls ----------
type Action = "gas" | "brake" | "left" | "right" | "jet" | "boost";
const held: Record<Action, boolean> = { gas: false, brake: false, left: false, right: false, jet: false, boost: false };
const KEYS: Record<string, Action> = {
  KeyW: "gas", ArrowUp: "gas", KeyS: "brake", ArrowDown: "brake", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
  Space: "jet", ShiftLeft: "boost", ShiftRight: "boost",
};

window.addEventListener("keydown", e => {
  if (carState.scenario !== "drive" || !app.visible) return;
  if (e.code === "KeyR") { resetUpright(); return; }
  const action = KEYS[e.code];
  if (!action) return;
  held[action] = true;
  e.preventDefault();
});
window.addEventListener("keyup", e => { const action = KEYS[e.code]; if (action) held[action] = false; });
window.addEventListener("blur", () => { for (const action of Object.keys(held) as Action[]) held[action] = false; });

// on-screen buttons for touch
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-key]")) {
  const key = button.dataset.key as Action | "reset";
  const press = (e: PointerEvent) => { e.preventDefault(); if (key === "reset") resetUpright(); else held[key] = true; button.classList.add("down"); };
  const release = () => { if (key !== "reset") held[key] = false; button.classList.remove("down"); };
  button.addEventListener("pointerdown", press);
  for (const type of ["pointerup", "pointerleave", "pointercancel"] as const) button.addEventListener(type, release);
}

/** R: put the car back on its wheels where it is, keeping its heading. */
function resetUpright() {
  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(carState.orientation), yaw = Math.atan2(-forward.z, forward.x);
  carState.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  carState.angularVelocity.set(0, 0, 0); carState.velocity.multiplyScalar(0.2);
  carState.position.y = Math.max(carState.position.y, COM_HEIGHT + 0.3);
  carState.rollAngle = carState.pitchAngle = 0;
  showToast("Reset");
}

/** Copy the held keys into the car's controls; after the run, brake to a stop (never reverse). */
export function applyPlayerInput() {
  const input = carState.input, playing = !game.over;
  input.throttle = playing ? (held.gas ? 1 : 0) - (held.brake ? 1 : 0) : (carState.velocity.x > 0.5 ? -1 : 0);
  input.steer = playing ? (held.right ? 1 : 0) - (held.left ? 1 : 0) : 0;
  input.jets = playing && held.jet;
  input.boost = playing && held.boost;
  if (!game.started && playing && (input.throttle > 0 || input.jets || input.boost)) { game.started = true; showToast("Go! Bust crates, fly over walls"); }
}

// ---------- each frame ----------
export function updateGame(dt: number) {
  if (game.started && !game.over) game.time += dt;
  game.furthest = Math.max(game.furthest, carState.position.x);
  game.shake = Math.max(0, game.shake - dt);
  for (const can of game.course?.cans ?? []) {   // fuel canisters spin, bob and get picked up
    if (can.collected) continue;
    can.mesh.rotation.y += dt * 2;
    can.mesh.position.y = can.y + Math.sin(carState.time * 3 + can.x) * 0.12;
    if (can.mesh.position.distanceToSquared(carState.position) < PICKUP_RADIUS * PICKUP_RADIUS) {
      can.collected = true; can.mesh.visible = false; game.cansCollected++;
      carState.fuel = Math.min(100, carState.fuel + CAN_FUEL);
      showToast(`Fuel +${CAN_FUEL}`); playChime(660);
    }
  }
  for (let i = game.debris.length - 1; i >= 0; i--) {   // busted crates tumble, bounce and vanish
    const d = game.debris[i], m = d.mesh;
    d.velocity.y -= 9.81 * dt;
    m.position.addScaledVector(d.velocity, dt);
    m.rotation.x += d.spin.x * dt; m.rotation.y += d.spin.y * dt; m.rotation.z += d.spin.z * dt;
    if (m.position.y < 0.6) { m.position.y = 0.6; d.velocity.y *= -0.3; d.velocity.x *= 0.7; d.velocity.z *= 0.7; d.spin.multiplyScalar(0.7); }
    if ((d.life -= dt) < 0) { course.remove(m); game.debris.splice(i, 1); }
  }
  if (!game.over && carState.position.x >= FINISH_X) endRun(true);
  if ((game.toastTime -= dt) < 0) gameUI.toast.classList.remove("show");

  gameUI.fuelBar.style.width = carState.fuel.toFixed(1) + "%";
  gameUI.fuelBar.classList.toggle("low", carState.fuel < 20);
  gameUI.fuelNumber.textContent = String(Math.round(carState.fuel));
  gameUI.score.textContent = String(score());
  gameUI.speed.textContent = String(kmh(carState.velocity.length()));
  if (game.started) gameUI.root.classList.toggle("seasoned", game.time > 8);   // fade the help text once you are going
  gameUI.toFinish.textContent = Math.max(0, Math.round(FINISH_X - carState.position.x)) + " m";
  gameUI.time.textContent = game.time.toFixed(1) + " s";
  gameUI.best.textContent = best.time ? best.time.toFixed(1) + " s" : "—";
  gameUI.damage.textContent = "●".repeat(game.crashes) + "○".repeat(MAX_CRASHES - game.crashes);
  followLight.position.set(carState.position.x - 8, 20, carState.position.z + 10);
  followLight.target.position.copy(carState.position);
}
