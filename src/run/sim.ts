// The one simulation the app runs. The game hooks its events (busts, hits, recoveries) in game/game.ts.
import { NOZZLE_SPECS } from "../car/nozzle-layout";
import { createRoadsterSim } from "../physics/simulation";

export const sim = createRoadsterSim(NOZZLE_SPECS);
export const carState = sim.state;
