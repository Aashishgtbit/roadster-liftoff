// Cinematic camera shots per stunt phase, the chase camera in the game, and free look.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { app } from "../core/state";
import { clamp } from "../core/math";
import { buttons, canvas, setLabel } from "../ui/dom";
import { RAMP } from "../config";
import { camera } from "../core/renderer";
import { car } from "../car/roadster";
import { cameraShake } from "../game/feedback";
import { carState } from "../run/sim";

const position = new THREE.Vector3(), lookAt = new THREE.Vector3();             // where the camera is
const wantPosition = new THREE.Vector3(), wantLookAt = new THREE.Vector3();     // where the current shot wants it
const heading = new THREE.Vector3(), shake = new THREE.Vector3();

/** Pick the shot for the current moment. The car can drift sideways; every shot follows it. */
function chooseShot() {
  const { x, y, z } = car.position;
  const player = carState.pilot === "player";
  if (player && carState.scenario === "ramp" && x > RAMP.startX - 9) {
    // playing the ramp: side on, leading the car. Camera and aim move ahead the way it is going, so the wall above,
    // the lip, or the ground it is about to land on is in view in time to decide what to do
    const v = carState.velocity, leadX = clamp(v.x * 0.9, -10, 10), leadY = clamp(v.y * 0.5, -5, 1.5);
    wantPosition.set(x + 1.5 + leadX * 0.6, Math.max(3, y * 0.75 + 2.5 + leadY * 0.4), 30);
    wantLookAt.set(x + 1 + leadX, Math.max(1.5, y * 0.8 + 1 + leadY), 0);
    return;
  }
  if (player) {
    // chase camera: behind the car along its direction of travel (its nose when slow), looking down the path ahead.
    // The faster it goes, the further ahead it aims and the wider the lens (see updateCamera), so walls and stacks
    // come into view sooner while the car stays above the controls. A little wider over the lineup.
    const wide = carState.scenario === "jump" ? 1.25 : 1, v = carState.velocity, speed = Math.hypot(v.x, v.z);
    if (speed > 3) heading.set(v.x, 0, v.z);
    else { heading.set(1, 0, 0).applyQuaternion(car.quaternion); heading.y = 0; }
    if (heading.lengthSq() < 0.01) heading.set(1, 0, 0);
    heading.normalize();
    const back = (9.5 + speed * 0.05) * wide, ahead = 8 + speed * 0.3, rise = (2.9 + speed * 0.02) * wide;
    wantPosition.copy(car.position).addScaledVector(heading, -back); wantPosition.y = Math.max(2.6 * wide, y + rise);
    // aim a little lower at speed, so the car stays above the control dock while the road ahead fills the view
    wantLookAt.copy(car.position).addScaledVector(heading, ahead); wantLookAt.y = y - 0.4 - speed * 0.06;
    return;
  }
  if (carState.scenario === "ramp") {   // wide on the climb, low and close on the hang
    switch (carState.phase) {
      case "Climb": case "Exit": wantPosition.set(RAMP.startX + 1.5, 7.2, 35); wantLookAt.set(RAMP.startX + 1.5, 7.2, 0); return;
      case "Hang": wantPosition.set(RAMP.startX - 4.5, 1.5, 7.5); wantLookAt.set(x, y - 0.4, 0); return;
      // tracks down the face, like the close-up in the video
      case "Flip": case "Hover": case "Descend": wantPosition.set(RAMP.startX - 6, 0.8 + y * 0.85, 16); wantLookAt.set(x - 0.5, y, z * 0.5); return;
      case "Touchdown": case "Drive off": case "Brake": wantPosition.set(x + 6, 1.7, z + 7); wantLookAt.set(x - 1, 0.7, z); return;
    }
  }
  switch (carState.phase) {
    case "Approach": case "Spool": case "Fans": wantPosition.set(x + 3.6, 1.05, z + 8.2); wantLookAt.set(x + 0.6, 0.7, z); break;
    case "Lift": case "Roll": case "Descend": wantPosition.set(6, 2.8, 32 + z * 0.5); wantLookAt.set(6 + (x - 6) * 0.35, 2.4 + y * 0.35, z * 0.6); break;
    case "Touchdown": case "Brake": wantPosition.set(x - 7, 1.6, z + 6.6); wantLookAt.set(x + 1, 0.6, z); break;
    default: {   // parked: a slow orbit
      const angle = 2.39 - carState.phaseTime * 0.42;
      wantPosition.set(x + Math.cos(angle) * 8, 1.7, z + Math.sin(angle) * 8); wantLookAt.set(x, 0.55, z);
    }
  }
}

const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.5;
controls.maxDistance = 70;
controls.maxPolarAngle = Math.PI * 0.49;   // stay above the ground
canvas.style.touchAction = "";

export function setFreeLook(on: boolean) {
  app.freeLook = on;
  controls.enabled = on;
  buttons.freeLook.setAttribute("aria-pressed", String(on));
  setLabel(buttons.freeLook, on ? "Cinematic" : "Free look");
  canvas.classList.toggle("free", on);
  canvas.style.touchAction = on ? "none" : "pan-y";
  if (on) controls.target.copy(car.position);
  else { position.copy(camera.position); lookAt.copy(controls.target); }   // ease back from wherever the user left it
  app.needsRender = true;
}
// dragging with a mouse starts free look straight away
canvas.addEventListener("pointerdown", e => { if (!app.freeLook && e.pointerType === "mouse") setFreeLook(true); }, { capture: true });

const previousTarget = new THREE.Vector3();
export function updateCamera(dt: number) {
  if (app.freeLook) {   // keep orbiting the car as it moves
    previousTarget.copy(controls.target);
    controls.target.lerp(car.position, 1 - Math.exp(-dt * 4));
    camera.position.add(previousTarget.sub(controls.target).negate());
    controls.update();
    return;
  }
  chooseShot();
  // playing: the lens widens with speed (up to 8°), like a racing game, to show more of the way ahead
  const baseFov = camera.aspect < 1.2 ? 42 : 32, v = carState.velocity;
  const wantFov = baseFov + (carState.pilot === "player" ? clamp(Math.hypot(v.x, v.z) / 40, 0, 1) * 8 : 0);
  if (Math.abs(camera.fov - wantFov) > 0.05) { camera.fov += (wantFov - camera.fov) * (app.snapCamera ? 1 : 1 - Math.exp(-dt * 2)); camera.updateProjectionMatrix(); }
  if (app.snapCamera) { position.copy(wantPosition); lookAt.copy(wantLookAt); app.snapCamera = false; }
  else {
    const ease = 1 - Math.exp(-dt * (carState.pilot === "player" ? 5 : 2.4));
    position.lerp(wantPosition, ease); lookAt.lerp(wantLookAt, ease);
  }
  camera.position.copy(position);
  camera.lookAt(lookAt);
  const shaking = cameraShake();
  if (shaking > 0) camera.position.add(shake.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shaking * 0.9));
}
