// Buttons, full screen and keyboard shortcuts.
import { app } from "../core/state";
import { buttons, canvas, setLabel, stuntTabs } from "./dom";
import { WING_MODE_NAMES, animateWing, wing } from "../car/roadster";
import type { Scenario, WingMode } from "../physics/types";
import { isPlaying } from "../game/modes";
import { replay, setStunt } from "../run/runner";
import { carState } from "../run/sim";
import { setFreeLook } from "../camera/camera";
import { isSoundOn, setSound } from "../audio/sound";
import { byId } from "./dom";

buttons.pause.addEventListener("click", () => { app.playing = !app.playing; setLabel(buttons.pause, app.playing ? "Pause" : "Play"); });
buttons.replay.addEventListener("click", () => { replay(); canvas.focus({ preventScroll: true }); });
buttons.play.addEventListener("click", () => setStunt(carState.scenario, isPlaying() ? "auto" : "player"));
buttons.freeLook.addEventListener("click", () => setFreeLook(!app.freeLook));
buttons.sound.addEventListener("click", () => setSound(!isSoundOn()));
for (const tab of stuntTabs) tab.addEventListener("click", () => setStunt(tab.dataset.stunt as Scenario));

buttons.wing.addEventListener("click", () => {
  wing.mode = ((wing.mode + 1) % 3) as WingMode;
  setLabel(buttons.wing, "Wing: " + WING_MODE_NAMES[wing.mode]);
  buttons.wing.setAttribute("aria-pressed", String(wing.mode > 0));
  if (!app.playing) for (let i = 0; i < 90; i++) animateWing(1 / 60);   // paused: show the new position at once
  app.needsRender = true;
});

// full screen: the whole app goes full screen; where the browser refuses, the top bar folds away instead
const appRoot = byId("app");
const isFullScreen = () => !!document.fullscreenElement || appRoot.classList.contains("expanded");
function syncFullScreen() {
  const on = isFullScreen();
  buttons.fullScreen.setAttribute("aria-pressed", String(on));
  setLabel(buttons.fullScreen, on ? "Exit full screen" : "Full screen");
  appRoot.classList.toggle("is-full", on);
  app.needsRender = true;
}
async function toggleFullScreen() {
  if (isFullScreen()) {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    appRoot.classList.remove("expanded");
  } else {
    try { await appRoot.requestFullscreen({ navigationUI: "hide" }); } catch { appRoot.classList.add("expanded"); }
  }
  syncFullScreen();
}
buttons.fullScreen.addEventListener("click", toggleFullScreen);
buttons.exitFullScreen.addEventListener("click", toggleFullScreen);
document.addEventListener("fullscreenchange", syncFullScreen);
window.addEventListener("keydown", e => {
  if (e.code === "KeyF" && !e.metaKey && !e.ctrlKey) void toggleFullScreen();
  if (e.code === "Escape" && appRoot.classList.contains("expanded")) { appRoot.classList.remove("expanded"); syncFullScreen(); }
});
