// Drive it: rules and scoring for the open course. Bust crates (45 km/h or more) or fly over them, fly over walls or
// launch off a kicker ramp, collect fuel. Hitting a wall above 35 km/h is a crash; three crashes wreck the car.
import * as THREE from "three";
import { FINISH_X } from "../config";
import { carState } from "../run/sim";
import { playChime, playNoiseBurst, playThump } from "../audio/sound";
import type { BoxObstacle } from "../physics/types";
import { buildCourse, course, crateGeometry, crateMaterial, followLight } from "./course";
import type { BuiltCourse } from "./course";
import { shakeCamera, showToast } from "./feedback";
import { loadBest, saveBest } from "./records";
import { showResultsSoon } from "./results";
import { confetti, flashScreen, showBanner } from "./celebrate";
import { setCheckpointState, setCheckpoints } from "../effects/checkpoints";
import { pushPoints, setScoreboard } from "./ui";

const CRASH_SPEED = 9.7;   // m/s (35 km/h)
const MAX_CRASHES = 3;
const PICKUP_RADIUS = 2.4;
const CAN_FUEL = 25;
const POINTS = { bust: 100, can: 25, crash: -200, flip: 150 };

interface Debris { mesh: THREE.Mesh; velocity: THREE.Vector3; spin: THREE.Vector3; life: number }

const run = {
  course: null as BuiltCourse | null,
  debris: [] as Debris[],
  started: false,
  over: false,
  time: 0,
  busts: 0,
  cansCollected: 0,
  crashes: 0,
  flips: 0,
  furthest: 0,      // distance points: the furthest x reached
};
const best = loadBest("drive");
const kmh = (metresPerSecond: number) => Math.round(metresPerSecond * 3.6);
/** Called with `true` for a new layout, `false` for the same one again. */
let retry: (newLayout: boolean) => void = () => {};

export const isDriveOver = () => run.over;

/** Start a run: on a new random layout, or the same one again. */
export function startDrive(newLayout: boolean, onRetry: (newLayout: boolean) => void) {
  retry = onRetry;
  if (newLayout || !run.course) run.course = buildCourse(1 + Math.floor(Math.random() * 2147483000));
  const built = run.course;
  for (const obstacle of built.obstacles) { obstacle.destroyed = false; obstacle.hitCooldown = 0; }
  for (const mesh of built.meshes.values()) mesh.visible = true;
  for (const can of built.cans) { can.collected = false; can.mesh.visible = true; }
  for (const d of run.debris) course.remove(d.mesh);
  Object.assign(run, { debris: [], started: false, over: false, time: 0, busts: 0, cansCollected: 0, crashes: 0, flips: 0, furthest: 0 });
  carState.obstacles = built.obstacles;
  // a ring over every wall and crate stack, and one standing across the finish
  setCheckpoints([
    ...built.obstacles.filter(o => o.kind === "wall" || o.kind === "crates").map(o => ({
      id: o.id, x: (o.minX + o.maxX) / 2, y: (o.kind === "wall" || o.kind === "crates" ? o.maxY : 0) + 1.4, z: (o.minZ + o.maxZ) / 2, radius: 1, kind: "gate" as const,
    })),
    { id: "finish", x: FINISH_X, y: 3.2, z: 0, radius: 2.6, kind: "gate", facing: "along" },
  ]);
  showToast("Gas to start");
}

const score = () => Math.max(0, Math.round(Math.max(0, run.furthest) + run.busts * POINTS.bust + run.cansCollected * POINTS.can + run.flips * POINTS.flip + run.crashes * POINTS.crash));

/** The car busted through a crate stack. */
export function onDriveBust(stack: BoxObstacle, speed: number) {
  const mesh = run.course?.meshes.get(stack);
  if (!mesh) return;
  mesh.visible = false;
  run.busts++;
  setCheckpointState(stack.id, "cleared");
  showBanner("Busted!", "good", `${kmh(speed)} km/h · +${POINTS.bust}`, 1.1);
  shakeCamera(0.25);
  showToast(`Busted at ${kmh(speed)} km/h`);
  pushPoints("crates busted", POINTS.bust);
  playThump(0.9); playNoiseBurst(0.5, "bandpass", 900, 0.6);
  for (const crate of mesh.children) {   // the stack bursts into its crates
    const piece = new THREE.Mesh(crateGeometry, crateMaterial);
    crate.getWorldPosition(piece.position); piece.castShadow = true; course.add(piece);
    run.debris.push({
      mesh: piece,
      velocity: new THREE.Vector3(speed * (0.5 + Math.random() * 0.6), 2 + Math.random() * 5, (piece.position.z - carState.position.z) * 0.9 + (Math.random() - 0.5) * 4),
      spin: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
      life: 5,
    });
  }
}

/** The wheels touched down after `flips` full rolls in the air; they only count landed on the wheels. */
export function onDriveLanding(flips: number) {
  if (run.over || flips < 1) return;
  if (new THREE.Vector3(0, 1, 0).applyQuaternion(carState.orientation).y < 0.7) return;
  run.flips += flips;
  showBanner(flips > 1 ? `${flips}× flip!` : "Flip!", "good", "+" + flips * POINTS.flip, 1.2);
  pushPoints(flips > 1 ? `${flips}× flip` : "flip", flips * POINTS.flip);
  playChime(700);
}

/** The car hit something solid. */
export function onDriveHit(obstacle: BoxObstacle, speed: number) {
  if (run.over) return;
  if (obstacle.kind === "barrier") {   // scrape along it
    if (speed > 5) playNoiseBurst(0.25, "bandpass", 1400, Math.min(0.5, speed / 30));
    shakeCamera(Math.min(0.3, speed / 40));
    return;
  }
  if (obstacle.kind === "wall" && speed > CRASH_SPEED) {   // a crash: costs fuel and points; three wreck the car
    run.crashes++;
    shakeCamera(0.6);
    setCheckpointState(obstacle.id, "failed");
    flashScreen("bad");
    carState.fuel = Math.max(0, carState.fuel - 15);
    pushPoints("wall crash", POINTS.crash);
    playThump(1); playNoiseBurst(0.6, "lowpass", 700, 0.9); playNoiseBurst(0.3, "highpass", 3000, 0.4);
    if (run.crashes >= MAX_CRASHES) endRun(false);
    else showBanner("Crash!", "bad", `${kmh(speed)} km/h · ${MAX_CRASHES - run.crashes} left`, 1.4);
    return;
  }
  showToast(obstacle.kind === "wall" ? "Walls don't bust · fly over with Space" : `Too slow to bust (${kmh(speed)} km/h) · go 45+`);
  playThump(Math.min(1, speed / 10));
}

function endRun(finished: boolean) {
  run.over = true;
  const finalScore = score() + (finished ? Math.max(0, Math.round((60 - run.time) * 10)) : 0);   // time bonus under a minute
  let newBest = false;
  if (finished && (!best.time || run.time < best.time)) { best.time = run.time; newBest = true; }
  if (finished && (!best.score || finalScore > best.score)) { best.score = finalScore; newBest = true; }
  if (newBest) saveBest("drive", best);
  const times = (n: number, what: string) => n === 1 ? what : `${what} × ${n}`;
  setCheckpointState("finish", finished ? "cleared" : "failed");
  flashScreen(finished ? "good" : "bad");
  showBanner(finished ? "Finish!" : "Wrecked!", finished ? "good" : "bad", finished ? `${run.time.toFixed(1)} s` : "three wall crashes", 1.8);
  if (finished) confetti(); else shakeCamera(0.6);
  showResultsSoon({
    outcome: finished ? "success" : "fail",
    mode: `Drive it · course #${(run.course?.seed ?? 0) % 10000}`,
    title: finished ? `Finished in ${run.time.toFixed(1)} s` : "Wrecked",
    score: finalScore,
    breakdown: [
      [`Distance ${Math.round(Math.max(0, run.furthest))} m`, Math.round(Math.max(0, run.furthest))],
      [times(run.busts, "Crates busted"), run.busts * POINTS.bust], [times(run.flips, "Flip"), run.flips * POINTS.flip],
      [times(run.cansCollected, "Fuel can"), run.cansCollected * POINTS.can], [times(run.crashes, "Wall crash"), run.crashes * POINTS.crash],
      ["Time bonus", finished ? Math.max(0, Math.round((60 - run.time) * 10)) : 0],
    ],
    note: finished ? undefined : "Three wall crashes wreck the car. Fly over walls with Space, or hit a yellow ramp fast",
    stats: [["Time", finished ? run.time.toFixed(1) + " s" : "—"], ["Crates", String(run.busts)], ["Flips", String(run.flips)], ["Cans", String(run.cansCollected)]],
    best: best.time ? `${best.time.toFixed(1)} s · ${best.score} pts` : "—",
    newBest,
    primary: ["Same course", () => retry(false)],
    secondary: ["New course", () => retry(true)],
  });
  if (finished) { playChime(520); setTimeout(() => playChime(780), 140); }
}

export function updateDrive(dt: number) {
  const input = carState.input;
  if (!run.started && !run.over && (input.throttle > 0 || input.jets || input.boost)) { run.started = true; showToast("Go! Bust crates, fly over walls"); }
  if (run.started && !run.over) run.time += dt;
  run.furthest = Math.max(run.furthest, carState.position.x);
  for (const can of run.course?.cans ?? []) {   // fuel canisters spin, bob and get picked up
    if (can.collected) continue;
    can.mesh.rotation.y += dt * 2;
    can.mesh.position.y = can.y + Math.sin(carState.time * 3 + can.x) * 0.12;
    if (can.mesh.position.distanceToSquared(carState.position) < PICKUP_RADIUS * PICKUP_RADIUS) {
      can.collected = true; can.mesh.visible = false; run.cansCollected++;
      carState.fuel = Math.min(100, carState.fuel + CAN_FUEL);
      showToast(`Fuel +${CAN_FUEL}`); playChime(660);
      pushPoints("fuel can", POINTS.can);
    }
  }
  for (let i = run.debris.length - 1; i >= 0; i--) {   // busted crates tumble, bounce and vanish
    const d = run.debris[i], m = d.mesh;
    d.velocity.y -= 9.81 * dt;
    m.position.addScaledVector(d.velocity, dt);
    m.rotation.x += d.spin.x * dt; m.rotation.y += d.spin.y * dt; m.rotation.z += d.spin.z * dt;
    if (m.position.y < 0.6) { m.position.y = 0.6; d.velocity.y *= -0.3; d.velocity.x *= 0.7; d.velocity.z *= 0.7; d.spin.multiplyScalar(0.7); }
    if ((d.life -= dt) < 0) { course.remove(m); run.debris.splice(i, 1); }
  }
  // walls and stacks the car gets past (over, around, or through) burst green
  for (const o of run.course?.obstacles ?? []) {
    if ((o.kind === "wall" || o.kind === "crates") && carState.position.x > o.maxX + 1 && setCheckpointState(o.id, "cleared") && o.kind === "wall") showBanner("Cleared!", "good", "", 0.9);
  }
  if (!run.over && carState.position.x >= FINISH_X) endRun(true);
  setScoreboard(score(), [
    ["Time", run.time.toFixed(1) + " s"], ["Best", best.time ? best.time.toFixed(1) + " s" : "—"],
    ["To finish", Math.max(0, Math.round(FINISH_X - carState.position.x)) + " m"],
    ["Damage", "●".repeat(run.crashes) + "○".repeat(MAX_CRASHES - run.crashes)],
    ["Course", "#" + (run.course?.seed ?? 0) % 10000],
  ]);
  followLight.position.set(carState.position.x - 8, 20, carState.position.z + 10);
  followLight.target.position.copy(carState.position);
}
