// Entry point: loads styles and modules in order, warms up the first frame and runs the render loop.
import "./styles/tokens.css";
import "./styles/buttons.css";
import "./styles/stage.css";
import "./styles/game.css";
import "./styles/app.css";
import "./core/state.js";
import "./ui/dom.js";
import "./core/math.js";
import "./config.js";
import "./core/renderer.js";
import "./scene/environment.js";
import "./scene/lights.js";
import "./car/geometry.js";
import "./car/materials.js";
import "./car/roadster.js";
import "./physics/roadster-sim.js";
import "./stunts/lineup.js";
import "./stunts/ramp.js";
import "./game/course.js";
import "./game/game.js";
import "./effects/plumes.js";
import "./run/runner.js";
import "./camera/camera.js";
import "./audio/sound.js";
import "./core/post.js";
import "./ui/controls.js";
import { reduce, state } from "./core/state.js";
import { msg, pauseBtn } from "./ui/dom.js";
import { clamp } from "./core/math.js";
import { simulate, st } from "./run/runner.js";
import { updateCamera } from "./camera/camera.js";
import { soundUpdate } from "./audio/sound.js";
import { composer, resize } from "./core/post.js";

/* ---------- start on the most dramatic frame: upside down over the lineup ---------- */
resize();
for (let i = 0; i < 900 && !(st.phase === "Roll" && st.roll > Math.PI * 0.95); i++) simulate(1 / 60);
state.snapCam = true; updateCamera(0);
if (reduce) pauseBtn.lastElementChild.textContent = "Play";

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now;   // a frame stamped before start must not run time backwards
  soundUpdate();
  if (!state.visible) return;
  if (state.playing) simulate(dt);
  if (state.playing || state.free || state.dirty) { updateCamera(dt); composer.render(); state.dirty = false; }
}
composer.render();
msg.hidden = true;
window.__sceneReady = true;
requestAnimationFrame(loop);
