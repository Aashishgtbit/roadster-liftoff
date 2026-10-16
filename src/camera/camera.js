// Cinematic camera shots per stunt phase, the chase camera, and free look.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { state } from "../core/state.js";
import { camBtn, canvas } from "../ui/dom.js";
import { RAMP } from "../config.js";
import { camera } from "../core/renderer.js";
import { car } from "../car/roadster.js";
import { game } from "../game/course.js";
import { st } from "../run/runner.js";

/* ---------- camera: cinematic shots, or free look ---------- */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3(), _cf = new THREE.Vector3();
function shot() {
  const cx = car.position.x, cy = car.position.y, cz = car.position.z;   // the car can drift sideways; every shot follows it
  if (st.scn === "drive") {   // chase camera behind the car
    const f = _cf.set(1, 0, 0).applyQuaternion(car.quaternion); f.y = 0; if (f.lengthSq() < 0.01) f.set(1, 0, 0); f.normalize();
    wantPos.copy(car.position).addScaledVector(f, -9.5); wantPos.y = Math.max(2.6, car.position.y + 2.9);
    wantLook.copy(car.position).addScaledVector(f, 7); wantLook.y = car.position.y + 0.4; return;
  }
  if (st.scn === "ramp") switch (st.phase) {   // the ramp stunt: wide on the climb, low and close on the hang
    case "Climb": case "Exit": wantPos.set(RAMP.cx + 1.5, 7.2, 35); wantLook.set(RAMP.cx + 1.5, 7.2, 0); return;
    case "Hang": wantPos.set(RAMP.cx - 4.5, 1.5, 7.5); wantLook.set(cx, cy - 0.4, 0); return;
    case "Flip": case "Hover": case "Descend": wantPos.set(RAMP.cx - 6, 0.8 + cy * 0.85, 16); wantLook.set(cx - 0.5, cy, cz * 0.5); return;   // tracks down the face, like the close-up in the video
    case "Touchdown": case "Drive off": case "Brake": wantPos.set(cx + 6, 1.7, cz + 7); wantLook.set(cx - 1, 0.7, cz); return;
  }
  switch (st.phase) {
    case "Approach": case "Spool": case "Fans": wantPos.set(cx + 3.6, 1.05, cz + 8.2); wantLook.set(cx + 0.6, 0.7, cz); break;
    case "Lift": case "Roll": case "Descend": wantPos.set(6, 2.8, 32 + cz * 0.5); wantLook.set(6 + (cx - 6) * 0.35, 2.4 + cy * 0.35, cz * 0.6); break;
    case "Touchdown": case "Brake": wantPos.set(cx - 7, 1.6, cz + 6.6); wantLook.set(cx + 1, 0.6, cz); break;
    default: { const a = 2.39 - st.pt * 0.42; wantPos.set(cx + Math.cos(a) * 8, 1.7, cz + Math.sin(a) * 8); wantLook.set(cx, 0.55, cz); }
  }
}
const controls = new OrbitControls(camera, canvas);
controls.enabled = false; controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 3.5; controls.maxDistance = 70; controls.maxPolarAngle = Math.PI * 0.49;
canvas.style.touchAction = "";
function setFree(on) {
  state.free = on; controls.enabled = on; camBtn.setAttribute("aria-pressed", on ? "true" : "false");
  camBtn.lastElementChild.textContent = on ? "Cinematic" : "Free look";
  canvas.classList.toggle("free", on); canvas.style.touchAction = on ? "none" : "pan-y";
  if (on) controls.target.copy(car.position);
  else { camPos.copy(camera.position); camLook.copy(controls.target); }
  state.dirty = true;
}
canvas.addEventListener("pointerdown", e => { if (!state.free && e.pointerType === "mouse") setFree(true); }, { capture: true });
const _prevTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (state.free) {
    _prevTarget.copy(controls.target);
    controls.target.lerp(car.position, 1 - Math.exp(-dt * 4));
    camera.position.add(_prevTarget.sub(controls.target).negate());
    controls.update();
    return;
  }
  shot();
  if (state.snapCam) { camPos.copy(wantPos); camLook.copy(wantLook); state.snapCam = false; }
  else { const k = 1 - Math.exp(-dt * (st.scn === "drive" ? 5 : 2.4)); camPos.lerp(wantPos, k); camLook.lerp(wantLook, k); }
  camera.position.copy(camPos); camera.lookAt(camLook);
  if (st.scn === "drive" && game.shake > 0) camera.position.add(_cf.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(game.shake * 0.9));
}

export { setFree, updateCamera };
