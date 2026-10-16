// Buttons, full screen and keyboard shortcuts.
import { state } from "../core/state.js";
import { camBtn, canvas, pauseBtn, replayBtn, soundBtn, stuntBtns, wingBtn } from "./dom.js";
import { wing } from "../car/roadster.js";
import { gameReset } from "../game/game.js";
import { WING_MODES, restart, setStunt, simulate, st, updateWing } from "../run/runner.js";
import { setFree } from "../camera/camera.js";
import { setSound, snd } from "../audio/sound.js";

document.getElementById("againBtn").addEventListener("click", () => { restart("drive"); gameReset(false); canvas.focus({ preventScroll: true }); });
document.getElementById("newCourseBtn").addEventListener("click", () => { restart("drive"); gameReset(true); canvas.focus({ preventScroll: true }); });

/* ---------- controls ---------- */
pauseBtn.addEventListener("click", () => { state.playing = !state.playing; pauseBtn.lastElementChild.textContent = state.playing ? "Pause" : "Play"; });
replayBtn.addEventListener("click", () => { restart(st.scn); if (st.scn === "drive") gameReset(false); simulate(0); if (!state.playing) { state.playing = true; pauseBtn.lastElementChild.textContent = "Pause"; } });
camBtn.addEventListener("click", () => setFree(!state.free));
soundBtn.addEventListener("click", () => setSound(!snd.on));
// full screen: the whole app goes full screen; where the browser refuses, the top bar folds away instead
const appEl = document.getElementById("app"), fsBtn = document.getElementById("fsBtn"), fsFloat = document.getElementById("fsFloat");
const fsOn = () => !!document.fullscreenElement || appEl.classList.contains("expanded");
function syncFs() { const on = fsOn(); fsBtn.setAttribute("aria-pressed", String(on)); fsBtn.lastElementChild.textContent = on ? "Exit full screen" : "Full screen"; appEl.classList.toggle("is-full", on); state.dirty = true; }
async function toggleFs() {
  if (fsOn()) { if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); appEl.classList.remove("expanded"); }
  else { try { await appEl.requestFullscreen({ navigationUI: "hide" }); } catch { appEl.classList.add("expanded"); } }
  syncFs();
}
fsBtn.addEventListener("click", toggleFs); fsFloat.addEventListener("click", toggleFs);
document.addEventListener("fullscreenchange", syncFs);
window.addEventListener("keydown", e => {
  if (e.code === "KeyF" && !e.metaKey && !e.ctrlKey) toggleFs();
  if (e.code === "Escape" && appEl.classList.contains("expanded")) { appEl.classList.remove("expanded"); syncFs(); }
});
for (const b of stuntBtns) b.addEventListener("click", () => setStunt(b.dataset.stunt));
wingBtn.addEventListener("click", () => { const u = wing.userData; u.mode = (u.mode + 1) % 3; wingBtn.lastElementChild.textContent = "Wing: " + WING_MODES[u.mode]; wingBtn.setAttribute("aria-pressed", String(u.mode > 0)); if (!state.playing) { for (let i = 0; i < 90; i++) updateWing(1 / 60); } state.dirty = true; });
