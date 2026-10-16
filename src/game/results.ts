// The card at the end of a run: title, score, stats, best, and two buttons.
import { resultsCard } from "./ui";
import type { Stat } from "./ui";

export interface Results {
  title: string;
  score: number;
  stats: readonly Stat[];
  best: string;
  newBest: boolean;
  note?: string;   // a line under the stats, e.g. a tip after a failed attempt
  primary: [label: string, onClick: () => void];
  secondary: [label: string, onClick: () => void];
}

export function showResults(results: Results) {
  const card = resultsCard;
  card.title.textContent = results.title;
  card.score.textContent = String(results.score);
  card.stats.replaceChildren(...results.stats.map(([label, value]) => {
    const tile = document.createElement("span"), name = document.createElement("small"), number = document.createElement("b");
    name.textContent = label; number.textContent = value;
    tile.append(number, name);
    return tile;
  }));
  card.note.textContent = results.note ?? "";
  card.note.hidden = !results.note;
  card.best.textContent = results.best;
  card.newBest.hidden = !results.newBest;
  card.primary.textContent = results.primary[0];
  card.primary.onclick = results.primary[1];
  card.secondary.textContent = results.secondary[0];
  card.secondary.onclick = results.secondary[1];
  card.root.hidden = false;
}

export function hideResults() { resultsCard.root.hidden = true; }
