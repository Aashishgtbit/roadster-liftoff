// Drive it: the best time and score, kept in this browser.

export interface BestRecord { time?: number; score?: number }

const KEY = "roadster-best";

export function loadBest(): BestRecord {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") as BestRecord; } catch { return {}; }
}

export function saveBest(record: BestRecord) {
  try { localStorage.setItem(KEY, JSON.stringify(record)); } catch { /* private window: keep it for this visit only */ }
}
