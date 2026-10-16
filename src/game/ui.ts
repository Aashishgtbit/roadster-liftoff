// Handles to the play UI: the panel (speedometer, fuel, stats), toast, controls help, touch buttons and results card.
import { byId } from "../ui/dom";
import { createFuelGauge, createSpeedometer } from "../ui/gauges";

export const gameUI = {
  root: byId("gameUI"),
  toast: byId("gameToast"),
  stats: byId("gameStats"),
  help: byId("gameHelp"),
  tip: byId("gameTip"),
  touch: byId("gameTouch"),
};

export const setPanelSpeed = createSpeedometer(byId("gameSpeedo"));
export const setPanelFuel = createFuelGauge(byId("gameFuel"));

export const resultsCard = {
  root: byId("gameOver"),
  title: byId("goTitle"),
  score: byId("goScore"),
  stats: byId("goStats"),
  note: byId("goNote"),
  best: byId("goBest"),
  newBest: byId("goNew"),
  primary: byId<HTMLButtonElement>("againBtn"),
  secondary: byId<HTMLButtonElement>("newCourseBtn"),
};

/** A label and its value, as shown in the panel and on the results card. */
export type Stat = [label: string, value: string];

let statLabels = "";
let statValues: HTMLElement[] = [];

/** Show these stats in the panel; the slots are rebuilt only when the labels change. */
export function setStats(stats: readonly Stat[]) {
  const labels = stats.map(([label]) => label).join("|");
  if (labels !== statLabels) {
    statLabels = labels;
    gameUI.stats.replaceChildren();
    statValues = stats.map(([label]) => {
      const slot = document.createElement("span"), name = document.createElement("span"), value = document.createElement("b");
      name.className = "label"; name.textContent = label;
      slot.append(name, value);
      gameUI.stats.append(slot);
      return value;
    });
  }
  stats.forEach(([, value], i) => { if (statValues[i].textContent !== value) statValues[i].textContent = value; });
}
