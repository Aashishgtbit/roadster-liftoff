// Steps the physics and applies it to the scene: car pose, suspension, wheels, nozzle glow, gas and HUD. Also switches
// between the stunts and the game.
import { app } from "../core/state";
import { buttons, canvas, hud, setLabel, stage, stuntTabs } from "../ui/dom";
import { COM_HEIGHT, WHEEL_RADIUS } from "../config";
import { STATIC_LENGTH, FAN_MAX_FORCE } from "../physics/constants";
import type { Scenario } from "../physics/types";
import { animateWing, car, nozzleVisuals, wheelVisuals, wing } from "../car/roadster";
import { lineup } from "../stunts/lineup";
import { rampGroup } from "../stunts/ramp";
import { course, followLight, headlight } from "../game/course";
import { applyPlayerInput, resetGame, updateGame } from "../game/game";
import { gameUI } from "../game/ui";
import { clearPlumes, emitPlume, updatePlumes } from "../effects/plumes";
import { updateCamera } from "../camera/camera";
import { carState, sim } from "./sim";

/** On the ramp wall the car pitches; past the runway it rolls. The HUD shows whichever is happening. */
const RAMP_PITCH_PHASES = new Set(["Approach", "Fans", "Climb", "Hang", "Exit"]);

/** Put the car back on the start line of `scenario` (the current one by default). */
export function restart(scenario?: Scenario) {
  sim.reset(scenario);
  clearPlumes();
  app.snapCamera = true;
}

export function play() {
  app.playing = true;
  setLabel(buttons.pause, "Pause");
}

/** Switch stunt or game: scenery, game UI and controls follow. */
export function setStunt(scenario: Scenario) {
  restart(scenario);
  const driving = scenario === "drive";
  lineup.visible = scenario === "jump";
  rampGroup.visible = scenario === "ramp";
  course.visible = followLight.visible = headlight.visible = driving;
  gameUI.root.hidden = !driving;
  stage.classList.toggle("driving", driving);
  carState.obstacles = [];
  if (driving) { resetGame(false); play(); canvas.focus({ preventScroll: true }); }
  for (const tab of stuntTabs) tab.setAttribute("aria-selected", String(tab.dataset.stunt === scenario));
  if (!app.playing) { simulate(1 / 60); updateCamera(0); }
  app.needsRender = true;
}

/** Advance the simulation by `dt` seconds and update everything that shows it. */
export function simulate(dt: number) {
  if (carState.scenario === "drive") applyPlayerInput();
  sim.step(dt);
  if (carState.phase === "Parked" && carState.phaseTime > 2.8) restart();   // the stunts loop
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

  let firing = 0, totalThrust = 0;
  sim.nozzles.forEach((nozzle, i) => {
    const level = nozzle.thrust / nozzle.maxThrust, visual = nozzleVisuals[i];
    if (level > 0.04) { firing++; emitPlume(visual.object, level, dt); }
    totalThrust += nozzle.thrust;
    visual.glowMaterial.emissiveIntensity = 2.5 * level;
  });
  updatePlumes(dt, car.position);
  animateWing(dt);
  if (carState.scenario === "drive") updateGame(dt);
  updateHud(firing, totalThrust);
  app.needsRender = true;
}

function updateHud(firing: number, totalThrust: number) {
  hud.phase.textContent = carState.phase;
  hud.height.textContent = Math.max(0, carState.position.y - COM_HEIGHT).toFixed(1) + " m";
  hud.speed.textContent = Math.round(carState.velocity.length() * 3.6) + " km/h";
  const showPitch = carState.scenario === "ramp" && RAMP_PITCH_PHASES.has(carState.phase);
  const degrees = (showPitch ? carState.pitchAngle : carState.rollAngle) * 180 / Math.PI;
  hud.rotation.textContent = Math.round((degrees % 360 + 360) % 360) + "°";
  hud.jets.textContent = firing ? `${firing} / 10 · ${Math.round(totalThrust / 1000)} kN` : "0 / 10";
  hud.jets.classList.toggle("on", firing > 0);
  hud.suction.textContent = carState.fanLevel > 0.02 ? Math.round(carState.fanLevel * FAN_MAX_FORCE / 1000) + " kN" : "off";
  hud.suction.classList.toggle("on", carState.fanLevel > 0.02);
}
