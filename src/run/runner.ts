// Steps the physics and applies it to the scene: car pose, suspension, wheels, nozzle glow, gas and the HUD. Also
// switches between the stunts and Drive it, watched or played.
import { app } from "../core/state";
import { buttons, canvas, setLabel, stage, stuntTabs } from "../ui/dom";
import { updateTelemetry } from "../ui/hud";
import { COM_HEIGHT, WHEEL_RADIUS } from "../config";
import { STATIC_LENGTH } from "../physics/constants";
import type { Pilot, Scenario } from "../physics/types";
import { animateWing, car, nozzleVisuals, wheelVisuals, wing } from "../car/roadster";
import { lineup } from "../stunts/lineup";
import { rampGroup } from "../stunts/ramp";
import { course, followLight, headlight } from "../game/course";
import { applyPlayInput, isPlaying, onWatchDemo, restartRun, startPlay, updatePlay } from "../game/modes";
import { gameUI } from "../game/ui";
import { emitPlume, updatePlumes } from "../effects/plumes";
import { updateCamera } from "../camera/camera";
import { carState, sim } from "./sim";

export function play() {
  app.playing = true;
  setLabel(buttons.pause, "Pause");
}

/** Switch stunt or game, watched (the flight computer flies) or played: scenery, panels and controls follow. */
export function setStunt(scenario: Scenario, pilot: Pilot = scenario === "drive" ? "player" : "auto") {
  const playing = pilot === "player";
  lineup.visible = scenario === "jump";
  rampGroup.visible = scenario === "ramp";
  course.visible = followLight.visible = headlight.visible = scenario === "drive";
  gameUI.root.hidden = !playing;
  stage.classList.toggle("playing", playing);
  stage.dataset.scenario = scenario;
  buttons.play.hidden = scenario === "drive";
  setLabel(buttons.play, playing ? "Watch demo" : "Play it");
  if (playing) { startPlay(scenario); play(); canvas.focus({ preventScroll: true }); }
  else restartRun(scenario, "auto");
  for (const tab of stuntTabs) tab.setAttribute("aria-selected", String(tab.dataset.stunt === scenario));
  if (!app.playing) { simulate(1 / 60); updateCamera(0); }
  app.needsRender = true;
}
onWatchDemo(scenario => setStunt(scenario, "auto"));

/** Start the current run again from its start line. */
export function replay() {
  if (isPlaying()) startPlay(carState.scenario); else restartRun(carState.scenario, "auto");
  simulate(0);
  if (!app.playing) play();
}

/** Advance the simulation by `dt` seconds and update everything that shows it. */
export function simulate(dt: number) {
  applyPlayInput();
  sim.step(dt);
  if (carState.phase === "Parked" && carState.phaseTime > 2.8) restartRun(carState.scenario, "auto");   // the demos loop
  carState.wingMode = wing.mode;

  car.position.copy(carState.position);
  car.quaternion.copy(carState.orientation);
  car.updateMatrixWorld(true);
  sim.wheels.forEach((wheel, i) => {   // each wheel rides its own spring and spins at road speed
    const visual = wheelVisuals[i];
    visual.group.position.y = WHEEL_RADIUS - COM_HEIGHT + STATIC_LENGTH - wheel.length;
    visual.angle += wheel.spinRate * dt;
    visual.spinner.rotation.z = -visual.angle * visual.side;
  });
  sim.nozzles.forEach((nozzle, i) => {
    const level = nozzle.thrust / nozzle.maxThrust, visual = nozzleVisuals[i];
    if (level > 0.04) emitPlume(visual.object, level, dt);
    visual.glowMaterial.emissiveIntensity = 2.5 * level;
  });
  updatePlumes(dt, car.position);
  animateWing(dt);
  updatePlay(dt);
  updateTelemetry(dt);
  app.needsRender = true;
}
