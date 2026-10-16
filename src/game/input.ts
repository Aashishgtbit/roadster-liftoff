// The player's controls: keyboard and on-screen touch buttons, drawn as keycaps and icon buttons that light up while
// held. One table (ACTIONS) drives the keys, the help graphic and the touch buttons, so they always agree.
import * as THREE from "three";
import { app } from "../core/state";
import { COM_HEIGHT } from "../config";
import { carState } from "../run/sim";
import { svg } from "../ui/gauges";
import { showToast } from "./feedback";
import { gameUI } from "./ui";

export type Action = "gas" | "brake" | "left" | "right" | "rollLeft" | "rollRight" | "jet" | "boost" | "reset";

interface ActionInfo {
  keys: string[];        // KeyboardEvent.code values
  cap: string;           // what is printed on the keycap
  caption: string;
  icon: string;          // SVG path, 24×24, stroked
  wide?: boolean;
}

export const ACTIONS: Record<Action, ActionInfo> = {
  gas: { keys: ["KeyW", "ArrowUp"], cap: "W", caption: "gas", icon: "M12 19V5M6 11l6-6 6 6" },
  brake: { keys: ["KeyS", "ArrowDown"], cap: "S", caption: "brake", icon: "M12 5v14M6 13l6 6 6-6" },
  left: { keys: ["KeyA", "ArrowLeft"], cap: "A", caption: "steer", icon: "M15 18l-6-6 6-6" },
  right: { keys: ["KeyD", "ArrowRight"], cap: "D", caption: "steer", icon: "M9 18l6-6-6-6" },
  rollLeft: { keys: ["KeyQ"], cap: "Q", caption: "roll", icon: "M5 13a7 7 0 1 0 2.5-6.4M5 3.5V8h4.5" },
  rollRight: { keys: ["KeyE"], cap: "E", caption: "roll", icon: "M19 13a7 7 0 1 1-2.5-6.4M19 3.5V8h-4.5" },
  jet: { keys: ["Space"], cap: "Space", caption: "jets · fly", icon: "M5 7h14M8 11l-1.5 8M12 11v9M16 11l1.5 8", wide: true },
  boost: { keys: ["ShiftLeft", "ShiftRight"], cap: "Shift", caption: "boost", icon: "M4 6l6 6-6 6M12 6l6 6-6 6", wide: true },
  reset: { keys: ["KeyR"], cap: "R", caption: "reset", icon: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" },
};

const held: Record<Action, boolean> = { gas: false, brake: false, left: false, right: false, rollLeft: false, rollRight: false, jet: false, boost: false, reset: false };
const byKey = new Map<string, Action>();
for (const [action, info] of Object.entries(ACTIONS) as [Action, ActionInfo][]) for (const key of info.keys) byKey.set(key, action);

function iconSvg(path: string) {
  const icon = svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", class: "icon" });
  svg("path", { d: path }, icon);
  return icon;
}

/** Light every keycap and touch button for `action`. */
function showHeld(action: Action, down: boolean) {
  for (const el of document.querySelectorAll(`[data-action="${action}"]`)) el.classList.toggle("down", down);
}

function press(action: Action) {
  if (action === "reset") { resetUpright(); showHeld(action, true); return; }
  held[action] = true;
  showHeld(action, true);
}
function release(action: Action) {
  held[action] = false;
  showHeld(action, false);
}

// ---------- the help graphic: keycaps laid out as on a keyboard ----------
{
  const layout: (Action | null)[][] = [["rollLeft", "gas", "rollRight", "reset"], ["left", "brake", "right"], ["boost", "jet"]];
  const keyboard = document.createElement("div");
  keyboard.className = "keys";
  for (const row of layout) {
    const line = document.createElement("div");
    line.className = "key-row";
    for (const action of row) {
      if (!action) continue;
      const info = ACTIONS[action], key = document.createElement("span");
      key.className = "key" + (info.wide ? " wide" : "");
      key.dataset.action = action;
      key.title = `${info.keys.map(k => k.replace(/^Key|Left$|Right$/g, "")).join(" / ")}: ${info.caption}`;
      const cap = document.createElement("b"); cap.textContent = info.cap;
      const caption = document.createElement("small"); caption.textContent = info.caption;
      key.append(iconSvg(info.icon), cap, caption);
      line.append(key);
    }
    keyboard.append(line);
  }
  gameUI.help.prepend(keyboard);
}

// ---------- touch buttons ----------
{
  const groups: Action[][] = [["left", "right", "rollLeft", "rollRight"], ["brake", "boost", "jet", "gas"]];
  for (const group of groups) {
    const side = document.createElement("div");
    for (const action of group) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = action;
      button.className = action;
      button.setAttribute("aria-label", ACTIONS[action].caption);
      button.append(iconSvg(ACTIONS[action].icon));
      button.addEventListener("pointerdown", e => { e.preventDefault(); press(action); });
      for (const type of ["pointerup", "pointerleave", "pointercancel"] as const) button.addEventListener(type, () => release(action));
      side.append(button);
    }
    gameUI.touch.append(side);
  }
}

// ---------- keyboard ----------
const playerFlying = () => carState.pilot === "player" && app.visible;
window.addEventListener("keydown", e => {
  const action = byKey.get(e.code);
  if (!action || !playerFlying()) return;
  e.preventDefault();
  if (!e.repeat) press(action);
});
window.addEventListener("keyup", e => { const action = byKey.get(e.code); if (action) release(action); });
window.addEventListener("blur", () => { for (const action of Object.keys(held) as Action[]) release(action); });

/** Copy the held controls into the car. `locked` (the run is over): brake to a stop, never reverse. */
export function applyControls(locked: boolean) {
  const input = carState.input;
  input.throttle = !locked ? (held.gas ? 1 : 0) - (held.brake ? 1 : 0) : (carState.velocity.x > 0.5 ? -1 : 0);
  input.steer = !locked ? (held.right ? 1 : 0) - (held.left ? 1 : 0) : 0;
  input.roll = !locked ? (held.rollRight ? 1 : 0) - (held.rollLeft ? 1 : 0) : 0;
  input.jets = !locked && held.jet;
  input.boost = !locked && held.boost;
}

/** R: put the car back on its wheels where it is, keeping its heading. */
function resetUpright() {
  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(carState.orientation), yaw = Math.atan2(-forward.z, forward.x);
  carState.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  carState.angularVelocity.set(0, 0, 0);
  carState.velocity.multiplyScalar(0.2);
  carState.position.y = Math.max(carState.position.y, COM_HEIGHT + 0.3);
  carState.rollAngle = carState.pitchAngle = 0;
  showToast("Reset");
  setTimeout(() => showHeld("reset", false), 150);
}
