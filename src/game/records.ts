// Best times and scores, kept in this browser, one record per mode.

export interface BestRecord { time?: number; score?: number }

const keyFor = (mode: string) => mode === "drive" ? "roadster-best" : `roadster-best-${mode}`;

export function loadBest(mode: string): BestRecord {
  try { return JSON.parse(localStorage.getItem(keyFor(mode)) || "{}") as BestRecord; } catch { return {}; }
}

export function saveBest(mode: string, record: BestRecord) {
  try { localStorage.setItem(keyFor(mode), JSON.stringify(record)); } catch { /* private window: keep it for this visit only */ }
}
