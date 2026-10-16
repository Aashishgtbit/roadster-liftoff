// Entry point: loads the styles and every module (importing a scene module builds its part of the scene), warms up
// the first frame and runs the render loop.
import "./styles/tokens.css";
import "./styles/buttons.css";
import "./styles/stage.css";
import "./styles/game.css";
import "./styles/app.css";
import "./scene/environment";
import "./scene/lights";
import "./stunts/lineup";
import "./stunts/ramp";
import "./ui/controls";
import { app, prefersReducedMotion } from "./core/state";
import { buttons, setLabel, stageMessage } from "./ui/dom";
import { clamp } from "./core/math";
import { simulate } from "./run/runner";
import { carState } from "./run/sim";
import { updateCamera } from "./camera/camera";
import { updateSound } from "./audio/sound";
import { composer, resize } from "./core/post";

declare global {
  interface Window { __sceneReady?: boolean }
}

// start on the most dramatic frame: upside down over the lineup
resize();
for (let i = 0; i < 900 && !(carState.phase === "Roll" && carState.rollAngle > Math.PI * 0.95); i++) simulate(1 / 60);
app.snapCamera = true;
updateCamera(0);
if (prefersReducedMotion) setLabel(buttons.pause, "Play");

let last = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05);   // a frame stamped before start must not run time backwards
  last = now;
  updateSound();
  if (!app.visible) return;
  if (app.playing) simulate(dt);
  if (app.playing || app.freeLook || app.needsRender) { updateCamera(dt); composer.render(); app.needsRender = false; }
}
composer.render();
stageMessage.hidden = true;
window.__sceneReady = true;
requestAnimationFrame(frame);
