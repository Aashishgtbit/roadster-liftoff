// Who is flying, and which rules apply. Watching a stunt: the scripted flight computer flies it. Playing: the player
// has the controls, and Drive it or the stunt challenge keeps score. Routes the physics events to the active rules.
import { app } from "../core/state";
import { clearPlumes } from "../effects/plumes";
import { carState, sim } from "../run/sim";
import { playThump } from "../audio/sound";
import type { Pilot, Scenario } from "../physics/types";
import { lineupObstacles } from "../stunts/lineup-layout";
import { isDriveOver, onDriveBust, onDriveHit, onDriveLanding, startDrive, updateDrive } from "./drive-game";
import { clearFeedback, showToast, updateFeedback } from "./feedback";
import { applyControls } from "./input";
import { clearResults } from "./results";
import { isStuntOver, onStuntHit, onStuntLanding, startStunt, updateStunt } from "./stunt-play";
import { gameUI, setPanelFuel, setPanelSpeed } from "./ui";

const TIPS: Record<Scenario, string> = {
  drive: "Bust crates at 45+ km/h · fly over walls, or hit a yellow ramp fast · 3 wall crashes wreck the car",
  jump: "Lift off before the first car · roll over the lineup · hold S to land softly past the Cybercab",
  ramp: "Gas up the wall · let go to stop upside down · gas off the end, roll 180° · S to land softly",
};

let rollOnGround = 0;      // roll angle the last time the wheels were down, to count flips in the air
let flipHintShown = false;

/** Called by the results card's "Watch the demo" button; set by the runner, which owns the scenery. */
let watchDemo: (scenario: Scenario) => void = () => {};
export function onWatchDemo(handler: (scenario: Scenario) => void) { watchDemo = handler; }

export const isPlaying = () => carState.pilot === "player";

/** Put the car on the start line of `scenario`, flown by `pilot`, with that scenario's obstacles. */
export function restartRun(scenario: Scenario, pilot: Pilot) {
  sim.reset(scenario, pilot);
  carState.obstacles = scenario === "jump" ? lineupObstacles() : [];
  clearPlumes();
  app.snapCamera = true;
}

/** Start playing `scenario`; for Drive it, optionally on a new random course. */
export function startPlay(scenario: Scenario, newLayout = false) {
  restartRun(scenario, "player");
  clearFeedback();
  clearResults();
  gameUI.tip.textContent = TIPS[scenario];
  gameUI.root.classList.remove("seasoned");
  if (scenario === "drive") startDrive(newLayout, fresh => startPlay("drive", fresh));
  else startStunt(scenario, () => startPlay(scenario), () => watchDemo(scenario));
}

/** Read the controls before the physics step. */
export function applyPlayInput() {
  if (!isPlaying()) return;
  applyControls(carState.scenario === "drive" ? isDriveOver() : isStuntOver());
}

/** After the physics step: rules, panel and messages. */
export function updatePlay(dt: number) {
  if (!isPlaying()) return;
  if (carState.scenario === "drive") updateDrive(dt); else updateStunt(dt);
  if (carState.wheelsOnGround > 0) rollOnGround = carState.rollAngle;
  else if (!flipHintShown && carState.airTime > 0.4) { flipHintShown = true; showToast("Q / E to flip in the air", 2.4); }
  setPanelSpeed(carState.velocity.length() * 3.6);
  setPanelFuel(carState.fuel);
  if (carState.time > 8) gameUI.root.classList.add("seasoned");   // fade the controls help once you are going
  updateFeedback(dt);
}

// ---------- what the physics reports ----------
sim.events.onBust = (obstacle, speed) => { if (isPlaying() && carState.scenario === "drive") onDriveBust(obstacle, speed); };
sim.events.onHit = (obstacle, speed) => {
  if (!isPlaying()) return;
  if (carState.scenario === "drive") onDriveHit(obstacle, speed); else onStuntHit(obstacle, speed);
};
sim.events.onLanding = verticalSpeed => {
  if (!isPlaying()) return;
  if (verticalSpeed < -1) playThump(Math.min(1, 0.3 + -verticalSpeed / 6));
  if (carState.scenario !== "drive") onStuntLanding(verticalSpeed);
  else onDriveLanding(Math.floor((Math.abs(carState.rollAngle - rollOnGround) + 0.6) / (2 * Math.PI)));
};
sim.events.onRecover = () => { if (isPlaying()) showToast("Back on your wheels"); };
