// Moments, on screen: a big animated banner, an edge flash (green for good, red for bad) and confetti.
import { gameUI } from "./ui";

export type Mood = "good" | "bad" | "info";

const layer = document.createElement("div");
layer.className = "g-fx";
const flashEl = document.createElement("div");
flashEl.className = "g-flash";
const bannerEl = document.createElement("div");
bannerEl.className = "g-banner";
const confettiCanvas = document.createElement("canvas");
confettiCanvas.className = "g-confetti";
layer.append(flashEl, confettiCanvas, bannerEl);
gameUI.root.prepend(layer);

/** Restart a CSS animation by toggling its class. */
function replay(el: HTMLElement, className: string) {
  el.classList.remove("good", "bad", "info", "show");
  void el.offsetWidth;   // reflow, so the animation runs again
  el.classList.add(className, "show");
}

/** Flash the edges of the screen. */
export function flashScreen(mood: Exclude<Mood, "info">) { replay(flashEl, mood); }

let bannerTimer = 0;
/** A big banner in the middle of the screen, e.g. "CLEARED!" with "1 roll · soft landing" under it. */
export function showBanner(title: string, mood: Mood, subtitle = "", seconds = 1.5) {
  bannerEl.replaceChildren();
  const big = document.createElement("b"); big.textContent = title;
  bannerEl.append(big);
  if (subtitle) { const small = document.createElement("span"); small.textContent = subtitle; bannerEl.append(small); }
  replay(bannerEl, mood);
  gameUI.toast.classList.remove("show");   // the banner takes over from any hint
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => bannerEl.classList.remove("show"), seconds * 1000);
}

interface Piece { x: number; y: number; vx: number; vy: number; spin: number; angle: number; size: number; color: string; life: number }
const COLORS = ["#5dffb0", "#c4ecff", "#ffb547", "#ff6a5c", "#e8ecf4"];
let pieces: Piece[] = [];
let running = false;

/** A burst of confetti from the top of the screen. */
export function confetti(count = 170) {
  const w = (confettiCanvas.width = layer.clientWidth * devicePixelRatio), h = (confettiCanvas.height = layer.clientHeight * devicePixelRatio);
  for (let i = 0; i < count; i++) {
    const fromLeft = i % 2 === 0;
    pieces.push({
      x: fromLeft ? w * 0.18 : w * 0.82, y: h * 0.32,
      vx: (fromLeft ? 1 : -1) * (200 + Math.random() * 700) * devicePixelRatio, vy: -(500 + Math.random() * 900) * devicePixelRatio,
      spin: (Math.random() - 0.5) * 14, angle: Math.random() * 6, size: (5 + Math.random() * 6) * devicePixelRatio,
      color: COLORS[i % COLORS.length], life: 2.4 + Math.random(),
    });
  }
  if (!running) { running = true; let last = performance.now(); requestAnimationFrame(function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const ctx = confettiCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    pieces = pieces.filter(p => (p.life -= dt) > 0);
    for (const p of pieces) {
      p.vy += 1500 * devicePixelRatio * dt; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt; p.angle += p.spin * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
    }
    if (pieces.length) requestAnimationFrame(frame); else running = false;
  }); }
}

/** Stop everything (a new run). */
export function clearMoments() {
  pieces = [];
  bannerEl.classList.remove("show");
  flashEl.classList.remove("show");
}
