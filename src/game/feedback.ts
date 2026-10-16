// Short messages over the stage, and camera shake for impacts.
import { gameUI } from "./ui";

let toastTime = 0;
let shake = 0;

export function showToast(text: string, seconds = 1.6) {
  gameUI.toast.textContent = text;
  gameUI.toast.classList.add("show");
  toastTime = seconds;
}

/** Shake the camera for at least `seconds`. */
export function shakeCamera(seconds: number) { shake = Math.max(shake, seconds); }

/** How hard the camera should shake right now (0 = still). */
export const cameraShake = () => shake;

export function updateFeedback(dt: number) {
  shake = Math.max(0, shake - dt);
  if ((toastTime -= dt) < 0) gameUI.toast.classList.remove("show");
}

export function clearFeedback() { shake = 0; toastTime = 0; gameUI.toast.classList.remove("show"); }
