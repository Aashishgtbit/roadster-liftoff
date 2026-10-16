// The two stunts from the unveiling, played. You fly the car with the same controls as Drive it, plus roll (Q / E).
//
// Lineup jump: lift off before the parked cars, roll in the air over them, land on your wheels past the Cybercab.
//   Hitting a vehicle, landing on one, or landing on the roof ends the attempt.
// Ramp hang: drive up the curved wall (the fans and motors hold you on it), stop upside down at the top, drive off
//   the end, roll 180° about the car's length and land on your wheels, facing back past the runway.
import * as THREE from "three";
import { COM_HEIGHT, RAMP } from "../config";
import { carState } from "../run/sim";
import { playChime, playNoiseBurst, playThump } from "../audio/sound";
import type { BoxObstacle, Scenario } from "../physics/types";
import { LINEUP, LINEUP_END_X } from "../stunts/lineup-layout";
import { shakeCamera, showToast } from "./feedback";
import { loadBest, saveBest } from "./records";
import { showResults } from "./results";
import { setStats } from "./ui";
import type { Stat } from "./ui";

type Stunt = Exclude<Scenario, "drive">;

const attempt = {
  stunt: "jump" as Stunt,
  over: false,
  peakHeight: 0,
  // ramp
  maxAngle: 0,     // how far round the curve the car got (rad)
  hangTime: 0,     // seconds stopped upside down near the top
  offTheWall: false,
};
let best = loadBest("jump");
let onRetry: () => void = () => {};
let onWatch: () => void = () => {};

const OBJECTIVES: Record<Stunt, string> = {
  jump: "Jets before the cars · roll with Q / E",
  ramp: "Up the wall · stop at the top · off the end",
};
const fullRolls = () => Math.floor((Math.abs(carState.rollAngle) + 0.6) / (2 * Math.PI));
const rampAngle = () => Math.atan2(carState.position.x - RAMP.startX, -(carState.position.y - RAMP.radius));
const carUp = () => new THREE.Vector3(0, 1, 0).applyQuaternion(carState.orientation);
const degrees = (radians: number) => Math.round(radians * 180 / Math.PI) + "°";

export const isStuntOver = () => attempt.over;

export function startStunt(stunt: Stunt, retry: () => void, watch: () => void) {
  Object.assign(attempt, { stunt, over: false, peakHeight: 0, maxAngle: 0, hangTime: 0, offTheWall: false });
  best = loadBest(stunt);
  onRetry = retry; onWatch = watch;
  showToast(OBJECTIVES[stunt], 3.2);
}

/** The car touched a parked vehicle. */
export function onStuntHit(obstacle: BoxObstacle, speed: number) {
  if (attempt.over || obstacle.kind !== "vehicle") return;
  shakeCamera(0.6);
  playThump(1); playNoiseBurst(0.6, "lowpass", 700, 0.9);
  fail(`Hit the ${obstacle.id}`, `${Math.round(speed * 3.6)} km/h into it`);
}

/** The wheels touched down after a flight. */
export function onStuntLanding(verticalSpeed: number) {
  if (attempt.over) return;
  const upright = carUp().y > 0.7, x = carState.position.x;
  if (attempt.stunt === "jump") {
    if (x < LINEUP[0].x - 2) return;   // a hop before the lineup: keep going
    if (!upright) return fail("Landed on the roof", "keep rolling until the wheels face down");
    if (carState.position.y > COM_HEIGHT + 0.6) {
      const under = LINEUP.find(v => Math.abs(x - v.x) < v.width / 2 + 1);
      return fail(`Parked on the ${under?.name ?? "roof"}`, "hold Space to fly past the last car");
    }
    if (x > LINEUP_END_X) succeed(verticalSpeed);
    return;
  }
  if (!attempt.offTheWall) return;
  if (!upright) return fail("Landed on the roof", "roll 180° with Q or E as you leave the wall");
  succeed(verticalSpeed);
}

function landingRating(verticalSpeed: number): [string, number] {
  const speed = Math.abs(verticalSpeed);
  return speed < 1.5 ? ["Feather-soft", 300] : speed < 3 ? ["Soft", 150] : speed < 5 ? ["Firm", 50] : ["Hard", 0];
}

function succeed(verticalSpeed: number) {
  const [rating, landingPoints] = landingRating(verticalSpeed);
  let score: number, title: string;
  const stats: Stat[] = [];
  if (attempt.stunt === "jump") {
    const rolls = fullRolls();
    score = 300 + rolls * 500 + landingPoints;
    title = rolls ? `Cleared with ${rolls === 1 ? "a roll" : rolls + " rolls"}` : "Cleared the lineup";
    stats.push(["Rolls", String(rolls)], ["Peak", attempt.peakHeight.toFixed(1) + " m"]);
  } else {
    const facingBack = new THREE.Vector3(1, 0, 0).applyQuaternion(carState.orientation).x < -0.5;
    const climb = Math.min(1, attempt.maxAngle / RAMP.endAngle);
    score = Math.round(climb * 400 + Math.min(3, attempt.hangTime) * 150 + 400 + (facingBack ? 200 : 0) + landingPoints);
    title = facingBack ? "Flipped and landed" : "Landed";
    stats.push(["Climb", degrees(attempt.maxAngle)], ["Hang", attempt.hangTime.toFixed(1) + " s"], ["Facing", facingBack ? "back ✓" : "away"]);
  }
  stats.push(["Landing", `${rating} · ${Math.abs(verticalSpeed).toFixed(1)} m/s`]);
  finish(title, score, stats);
  playChime(520); setTimeout(() => playChime(780), 140);
}

function fail(title: string, hint: string) {
  const stats: Stat[] = attempt.stunt === "jump"
    ? [["Rolls", String(fullRolls())], ["Peak", attempt.peakHeight.toFixed(1) + " m"]]
    : [["Climb", degrees(attempt.maxAngle)], ["Hang", attempt.hangTime.toFixed(1) + " s"]];
  finish(title, 0, stats, "Tip: " + hint);
}

function finish(title: string, score: number, stats: Stat[], note?: string) {
  attempt.over = true;
  const newBest = score > 0 && (!best.score || score > best.score);
  if (newBest) { best.score = score; saveBest(attempt.stunt, best); }
  showToast(title);
  showResults({
    title, score, stats, newBest, note,
    best: best.score ? `${best.score} pts` : "—",
    primary: ["Try again", () => onRetry()],
    secondary: ["Watch the demo", () => onWatch()],
  });
}

export function updateStunt(dt: number) {
  const height = carState.position.y - COM_HEIGHT;
  attempt.peakHeight = Math.max(attempt.peakHeight, height);
  if (attempt.stunt === "ramp" && !attempt.over) {
    const onWall = carState.phase === "Climb" || carState.phase === "Hang";
    if (onWall) attempt.maxAngle = Math.max(attempt.maxAngle, rampAngle());
    if (carState.phase === "Hang") attempt.hangTime += dt;
    // in the air after climbing past vertical: off the end (or fallen off), the landing decides
    if (carState.wheelsOnGround === 0 && attempt.maxAngle > Math.PI / 2 && carState.airTime > 0.2) attempt.offTheWall = true;
  }
  const bestText = best.score ? String(best.score) : "—";
  if (attempt.stunt === "jump") {
    const cleared = Math.max(0, Math.min(LINEUP.length, LINEUP.filter(v => carState.position.x > v.x + v.width / 2).length));
    setStats([["Rolls", String(fullRolls())], ["Height", height.toFixed(1) + " m"], ["Best", bestText], ["Cars cleared", `${cleared} / ${LINEUP.length}`]]);
  } else {
    setStats([["Climb", degrees(attempt.maxAngle)], ["Hang", attempt.hangTime.toFixed(1) + " s"], ["Best", bestText], ["Height", height.toFixed(1) + " m"]]);
  }
}
