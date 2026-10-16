// What the current run has got past (each parked car, each ramp mark, each wall and crate stack, the finish) or
// failed at. Each milestone changes once, so the banner, chime or points for it fire once.

export type MilestoneState = "cleared" | "failed";

const reached = new Map<string, MilestoneState>();

/** Record a milestone; returns false if it was already decided. */
export function markMilestone(id: string, state: MilestoneState): boolean {
  if (reached.has(id)) return false;
  reached.set(id, state);
  return true;
}

export function resetMilestones() { reached.clear(); }
