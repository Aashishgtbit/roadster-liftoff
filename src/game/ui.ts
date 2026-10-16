// Handles to the play UI: the top panel (speedometer, fuel), the scoreboard on the right (live score, points feed,
// stats), toast, the control dock, touch buttons and the results card.
import { byId } from "../ui/dom";
import { createFuelGauge, createSpeedometer } from "../ui/gauges";

export const gameUI = {
  root: byId("gameUI"),
  toast: byId("gameToast"),
  score: byId("gameScore"),
  feed: byId("gameFeed"),
  stats: byId("gameStats"),
  help: byId("gameHelp"),
  tip: byId("gameTip"),
  touch: byId("gameTouch"),
};

export const setPanelSpeed = createSpeedometer(byId("gameSpeedo"), 160);
export const setPanelFuel = createFuelGauge(byId("gameFuel"));

export const resultsCard = {
  root: byId("gameOver"),
  title: byId("goTitle"),
  score: byId("goScore"),
  stats: byId("goStats"),
  note: byId("goNote"),
  best: byId("goBest"),
  newBest: byId("goNew"),
  close: byId<HTMLButtonElement>("goClose"),
  primary: byId<HTMLButtonElement>("againBtn"),
  secondary: byId<HTMLButtonElement>("newCourseBtn"),
};

/** A label and its value, as shown on the scoreboard and the results card. */
export type Stat = [label: string, value: string];

let statLabels = "";
let statValues: HTMLElement[] = [];
let shownScore = -1;

/** The live score and the stats under it; the stat rows are rebuilt only when their labels change. */
export function setScoreboard(score: number, stats: readonly Stat[]) {
  if (score !== shownScore) {
    if (score > shownScore && shownScore >= 0) { gameUI.score.classList.remove("bump"); void gameUI.score.offsetWidth; gameUI.score.classList.add("bump"); }
    shownScore = score;
    gameUI.score.textContent = String(score);
  }
  const labels = stats.map(([label]) => label).join("|");
  if (labels !== statLabels) {
    statLabels = labels;
    gameUI.stats.replaceChildren();
    statValues = stats.map(([label]) => {
      const row = document.createElement("span"), name = document.createElement("span"), value = document.createElement("b");
      name.className = "label"; name.textContent = label;
      row.append(name, value);
      gameUI.stats.append(row);
      return value;
    });
  }
  stats.forEach(([, value], i) => { if (statValues[i].textContent !== value) statValues[i].textContent = value; });
}

/** Add a line to the points feed under the score ("+100 Busted"); old lines fade out. */
export function pushPoints(label: string, points: number) {
  const line = document.createElement("li");
  line.className = points < 0 ? "minus" : "plus";
  const value = document.createElement("b"); value.textContent = (points < 0 ? "−" : "+") + Math.abs(points);
  line.append(value, " " + label);
  gameUI.feed.prepend(line);
  while (gameUI.feed.children.length > 5) gameUI.feed.lastElementChild!.remove();
  setTimeout(() => line.classList.add("old"), 3500);
  setTimeout(() => line.remove(), 4300);
}

/** Empty the scoreboard for a new run. */
export function resetScoreboard() {
  gameUI.feed.replaceChildren();
  shownScore = -1;
}
