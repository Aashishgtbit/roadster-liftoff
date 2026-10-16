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
import { showResultsSoon } from "./results";
import { confetti, flashScreen, showBanner } from "./celebrate";
import { markMilestone } from "./milestones";
import { pushPoints, setScoreboard } from "./ui";
import type { Stat } from "./ui";

type Stunt = Exclude<Scenario, "drive">;

const attempt = {
  stunt: "jump" as Stunt,
  over: false,
  peakHeight: 0,
  rollsCounted: 0,   // full rolls already announced in the points feed
  cleared: false,    // the car is past the last vehicle
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
const POINTS = { cleared: 300, roll: 500, landed: 400, facingBack: 200, climb: 400, hangPerSecond: 150 };
/** The ramp's points so far: how far round the curve, and the hang (up to 3 s). */
const rampScore = () => Math.round(Math.min(1, attempt.maxAngle / RAMP.endAngle) * POINTS.climb + Math.min(3, attempt.hangTime) * POINTS.hangPerSecond);
const fullRolls = () => Math.floor((Math.abs(carState.rollAngle) + 0.6) / (2 * Math.PI));
const rampAngle = () => Math.atan2(carState.position.x - RAMP.startX, -(carState.position.y - RAMP.radius));
const carUp = () => new THREE.Vector3(0, 1, 0).applyQuaternion(carState.orientation);
const degrees = (radians: number) => Math.round(radians * 180 / Math.PI) + "°";

export const isStuntOver = () => attempt.over;

export function startStunt(stunt: Stunt, retry: () => void, watch: () => void) {
  Object.assign(attempt, { stunt, over: false, peakHeight: 0, rollsCounted: 0, cleared: false, maxAngle: 0, hangTime: 0, offTheWall: false });
  best = loadBest(stunt);
  onRetry = retry; onWatch = watch;
  showToast(OBJECTIVES[stunt], 3.2);
}

/** Milestones up the ramp: a banner as the car gets to each. */
const RAMP_MARKS = [
  { id: "vertical", angle: Math.PI / 2, title: "Vertical!", subtitle: "the fans hold you on" },
  { id: "inverted", angle: 0.74 * Math.PI, title: "Upside down!", subtitle: "let go of the gas to hang" },
  { id: "lip", angle: RAMP.endAngle - 0.06, title: "The lip", subtitle: "gas off the end, then roll 180°" },
];

/** The car touched a parked vehicle. */
export function onStuntHit(obstacle: BoxObstacle, speed: number) {
  if (attempt.over || obstacle.kind !== "vehicle") return;
  shakeCamera(0.6);
  playThump(1); playNoiseBurst(0.6, "lowpass", 700, 0.9);
  fail(`Hit the ${obstacle.id} at ${Math.round(speed * 3.6)} km/h`, "lift off earlier: hold Space before the first car", "Crash!");
}

/** The wheels touched down after a flight. */
export function onStuntLanding(verticalSpeed: number) {
  if (attempt.over) return;
  const upright = carUp().y > 0.7, x = carState.position.x;
  if (attempt.stunt === "jump") {
    if (x < LINEUP[0].x - 2) return;   // a hop before the lineup: keep going
    if (!upright) return fail("Landed on the roof", "keep rolling until the wheels face down (or let go past halfway)", "Roof landing!");
    if (carState.position.y > COM_HEIGHT + 0.6) {
      const under = LINEUP.find(v => Math.abs(x - v.x) < v.width / 2 + 1);
      return fail(`Parked on the ${under?.name ?? "roof"}`, "hold Space to fly past the last car", "Too short!");
    }
    if (x > LINEUP_END_X) succeed(verticalSpeed);
    return;
  }
  if (!attempt.offTheWall) return;
  if (!upright) return fail("Landed on the roof", "roll 180° with Q or E as you leave the wall", "Roof landing!");
  succeed(verticalSpeed);
}

function landingRating(verticalSpeed: number): [string, number] {
  const speed = Math.abs(verticalSpeed);
  return speed < 1.5 ? ["Feather-soft", 300] : speed < 3 ? ["Soft", 150] : speed < 5 ? ["Firm", 50] : ["Hard", 0];
}

function succeed(verticalSpeed: number) {
  const [rating, landingPoints] = landingRating(verticalSpeed);
  const landing = `${rating} landing`, touchdown = Math.abs(verticalSpeed).toFixed(1) + " m/s";
  let title: string, breakdown: [string, number][], stats: Stat[];
  if (attempt.stunt === "jump") {
    const rolls = fullRolls();
    title = rolls ? `Cleared with ${rolls === 1 ? "a roll" : rolls + " rolls"}` : "Cleared the lineup";
    breakdown = [["Lineup cleared", POINTS.cleared], [rolls === 1 ? "Roll" : `Rolls × ${rolls}`, rolls * POINTS.roll], [landing, landingPoints]];
    stats = [["Rolls", String(rolls)], ["Peak", attempt.peakHeight.toFixed(1) + " m"], ["Touchdown", touchdown]];
  } else {
    const facingBack = new THREE.Vector3(1, 0, 0).applyQuaternion(carState.orientation).x < -0.5;
    pushPoints("on its wheels", POINTS.landed);
    if (facingBack) pushPoints("facing back", POINTS.facingBack);
    title = facingBack ? "Flipped and landed" : "Landed";
    breakdown = [
      [`Climb to ${degrees(attempt.maxAngle)}`, Math.round(Math.min(1, attempt.maxAngle / RAMP.endAngle) * POINTS.climb)],
      [`Hang ${attempt.hangTime.toFixed(1)} s`, Math.round(Math.min(3, attempt.hangTime) * POINTS.hangPerSecond)],
      ["On its wheels", POINTS.landed], ["Facing back", facingBack ? POINTS.facingBack : 0], [landing, landingPoints],
    ];
    stats = [["Climb", degrees(attempt.maxAngle)], ["Hang", attempt.hangTime.toFixed(1) + " s"], ["Touchdown", touchdown]];
  }
  if (landingPoints) pushPoints(`${rating.toLowerCase()} landing`, landingPoints);
  flashScreen("good");
  showBanner(attempt.stunt === "jump" ? "Cleared!" : "Stuck it!", "good", `${title} · ${rating.toLowerCase()} landing`, 1.8);
  confetti();
  finish("success", title, breakdown.reduce((sum, [, points]) => sum + points, 0), stats, breakdown);
  playChime(520); setTimeout(() => playChime(780), 140);
}

function fail(title: string, hint: string, banner: string) {
  flashScreen("bad");
  shakeCamera(0.5);
  showBanner(banner, "bad", title, 1.8);
  const stats: Stat[] = attempt.stunt === "jump"
    ? [["Rolls", String(fullRolls())], ["Peak", attempt.peakHeight.toFixed(1) + " m"], ["Cars cleared", `${LINEUP.filter(v => carState.position.x > v.x + v.width / 2).length} / ${LINEUP.length}`]]
    : [["Climb", degrees(attempt.maxAngle)], ["Hang", attempt.hangTime.toFixed(1) + " s"], ["Peak", attempt.peakHeight.toFixed(1) + " m"]];
  finish("fail", title, 0, stats, [], hint[0].toUpperCase() + hint.slice(1));
}

function finish(outcome: "success" | "fail", title: string, score: number, stats: Stat[], breakdown: [string, number][], note?: string) {
  attempt.over = true;
  const newBest = score > 0 && (!best.score || score > best.score);
  if (newBest) { best.score = score; saveBest(attempt.stunt, best); }
  showResultsSoon({
    outcome, mode: attempt.stunt === "jump" ? "Lineup jump" : "Ramp hang", title, score, breakdown, stats, newBest, note,
    best: best.score ? `${best.score} pts` : "—",
    primary: ["Try again", () => onRetry()],
    secondary: ["Watch the demo", () => onWatch()],
  });
}

export function updateStunt(dt: number) {
  const height = Math.max(0, carState.position.y - COM_HEIGHT);
  attempt.peakHeight = Math.max(attempt.peakHeight, height);
  if (attempt.stunt === "ramp" && !attempt.over) {
    const onWall = carState.phase === "Climb" || carState.phase === "Hang";
    if (onWall) attempt.maxAngle = Math.max(attempt.maxAngle, rampAngle());
    if (carState.phase === "Hang") attempt.hangTime += dt;
    // in the air after climbing past vertical: off the end (or fallen off), the landing decides
    if (carState.wheelsOnGround === 0 && attempt.maxAngle > Math.PI / 2 && carState.airTime > 0.2) attempt.offTheWall = true;
  }
  if (attempt.over) return;
  const bestText = best.score ? String(best.score) : "—";
  if (attempt.stunt === "jump") {
    const cleared = LINEUP.filter(v => carState.position.x > v.x + v.width / 2).length, rolls = fullRolls();
    // announce points as they are earned (they count once the car lands on its wheels)
    if (rolls > attempt.rollsCounted) {
      pushPoints(rolls > 1 ? `roll ${rolls}` : "roll", (rolls - attempt.rollsCounted) * POINTS.roll);
      attempt.rollsCounted = rolls;
      showBanner(rolls > 1 ? `${rolls}× roll!` : "Full roll!", "info", "+" + POINTS.roll, 1.1);
    }
    // each car the car gets past bursts green
    for (const v of LINEUP) if (carState.position.x > v.x + v.width / 2 && markMilestone(v.name, "cleared")) playChime(520 + 60 * LINEUP.indexOf(v));
    if (!attempt.cleared && carState.position.x > LINEUP_END_X) { attempt.cleared = true; pushPoints("lineup cleared", POINTS.cleared); showBanner("Lineup cleared!", "info", "now land on your wheels", 1.4); }
    const live = (attempt.cleared ? POINTS.cleared : 0) + rolls * POINTS.roll;
    setScoreboard(live, [["Rolls", String(rolls)], ["Cars cleared", `${cleared} / ${LINEUP.length}`], ["Height", height.toFixed(1) + " m"], ["Best", bestText]]);
  } else {
    for (const mark of RAMP_MARKS) if (attempt.maxAngle >= mark.angle && markMilestone(mark.id, "cleared")) { showBanner(mark.title, "info", mark.subtitle, 1.4); playChime(600); }
    setScoreboard(rampScore(), [["Climb", degrees(attempt.maxAngle)], ["Hang", attempt.hangTime.toFixed(1) + " s"], ["Height", height.toFixed(1) + " m"], ["Best", bestText]]);
  }
}
