// The card at the end of a run: a success or fail header, the score counting up with a breakdown of how it was
// earned, a few stat tiles, a tip after a failed attempt, and two actions. Frosted glass over the live scene.
import { buttons } from "../ui/dom";
import { svg } from "../ui/gauges";
import { gameUI, resultsCard } from "./ui";
import type { Stat } from "./ui";

export interface Results {
  outcome: "success" | "fail";
  mode: string;                                    // e.g. "Lineup jump", "Drive it · course #4901"
  title: string;
  score: number;
  breakdown?: readonly [label: string, points: number][];   // how the score was made; zero lines are left out
  stats: readonly Stat[];
  best: string;
  newBest: boolean;
  note?: string;                                   // a tip after a failed attempt
  primary: [label: string, onClick: () => void];
  secondary: [label: string, onClick: () => void];
}

const ICONS = {
  success: "M5 12.5l4.5 4.5L19 7.5",
  fail: "M7 7l10 10M17 7L7 17",
  close: "M6 6l12 12M18 6L6 18",
  tip: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
};

function icon(path: string, className = "icon") {
  const element = svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", class: className });
  svg("path", { d: path }, element);
  return element;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Count a number up from 0 over ~0.7 s, easing out. */
function countUp(target: HTMLElement, value: number) {
  const start = performance.now(), duration = 700;
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration), eased = 1 - (1 - t) ** 3;
    target.textContent = String(Math.round(value * eased));
    if (t < 1) requestAnimationFrame(frame);
  };
  target.textContent = "0";
  requestAnimationFrame(frame);
}

export function showResults(r: Results) {
  const card = resultsCard.card;
  card.className = `g-card ${r.outcome}`;
  const close = el("button", "g-close");
  close.type = "button"; close.setAttribute("aria-label", "Close"); close.append(icon(ICONS.close));
  close.addEventListener("click", hideResults);

  const head = el("div", "g-head"), badge = el("span", "g-badge"), titles = el("div");
  badge.append(icon(r.outcome === "success" ? ICONS.success : ICONS.fail));
  const title = el("h2", "g-title", r.title);
  title.id = "goTitle";
  titles.append(el("span", "label", r.mode), title);
  head.append(badge, titles);

  const scoreline = el("div", "g-scoreline"), number = el("b", "g-big");
  scoreline.append(number, el("span", "g-points", "points"));
  if (r.newBest) { const best = el("span", "g-new"); best.append(icon(ICONS.star), "New best"); scoreline.append(best); }
  countUp(number, r.score);

  // a failed attempt with nothing scored leads with what happened, not a big zero
  const parts: HTMLElement[] = r.outcome === "fail" && r.score === 0 ? [close, head] : [close, head, scoreline];
  const lines = (r.breakdown ?? []).filter(([, points]) => points !== 0);
  if (lines.length) {
    const list = el("ul", "g-breakdown");
    lines.forEach(([label, points], i) => {
      const line = el("li");
      line.style.animationDelay = `${120 + i * 70}ms`;
      line.append(el("span", undefined, label), el("b", points < 0 ? "minus" : undefined, (points < 0 ? "−" : "+") + Math.abs(points)));
      list.append(line);
    });
    parts.push(list);
  }
  const tiles = el("div", `g-tiles n${Math.min(4, r.stats.length)}`);
  for (const [label, value] of r.stats) { const tile = el("span"); tile.append(el("b", undefined, value), el("small", undefined, label)); tiles.append(tile); }
  parts.push(tiles);
  if (r.note) { const note = el("p", "g-note"); note.append(icon(ICONS.tip), el("span", undefined, r.note)); parts.push(note); }

  const actions = el("div", "g-btns");
  const primary = el("button", "btn primary"), secondary = el("button", "btn");
  primary.type = secondary.type = "button";
  primary.append(r.primary[0], el("kbd", undefined, "Enter"));
  secondary.textContent = r.secondary[0];
  primary.addEventListener("click", r.primary[1]);
  secondary.addEventListener("click", r.secondary[1]);
  actions.append(primary, secondary);
  parts.push(actions);

  const foot = el("p", "g-foot");
  foot.append(icon(ICONS.trophy), el("span", undefined, "Best "), el("b", undefined, r.best), el("span", "g-esc", " · Esc to close"));
  parts.push(foot);

  card.replaceChildren(...parts);
  resultsCard.primary = primary;
  resultsCard.root.hidden = false;
  gameUI.root.classList.add("over");
}

export function hideResults() { resultsCard.root.hidden = true; }

/** A new run: controls back. */
export function clearResults() { hideResults(); gameUI.root.classList.remove("over"); }

// Enter: the card's primary action (try again / same course), or start the run again while playing;
// Escape: just close the card
window.addEventListener("keydown", e => {
  if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;   // they handle Enter themselves
  if (e.code === "Enter" && !resultsCard.root.hidden) { e.preventDefault(); resultsCard.primary?.click(); }
  else if (e.code === "Enter" && !gameUI.root.hidden) { e.preventDefault(); buttons.replay.click(); }
  if (e.code === "Escape" && !resultsCard.root.hidden) hideResults();
});
