// Where the ten cold-gas nozzles sit: four under the floor near the wheel arches, four in the diffuser, two in the
// nose. The car model draws them here and the physics pushes from here, so the two always agree.
import { Vector3 } from "three";
import { CAR_LENGTH, COM_HEIGHT } from "../config";
import type { NozzleGroup, NozzleSpec } from "../physics/types";
import { noseXAt } from "./geometry";

/** A nozzle as placed on the body: position above the ground (car frame) and the direction it blows. */
export interface NozzleMount {
  readonly at: Vector3;
  readonly direction: Vector3;
  readonly group: NozzleGroup;
}

/** Peak thrust per nozzle (N); estimates. */
const MAX_THRUST: Record<NozzleGroup, number> = { down: 18000, rear: 7000, front: 5000 };

export const NOZZLE_MOUNTS: readonly NozzleMount[] = [
  ...[-1.6, 1.6].flatMap(x => [-0.55, 0.55].map(z => ({ at: new Vector3(x, 0.14, z), direction: new Vector3(0, -1, 0), group: "down" as const }))),
  ...[-0.375, -0.135, 0.135, 0.375].map(z => ({ at: new Vector3(-CAR_LENGTH / 2 - 0.02, 0.52, z), direction: new Vector3(-1, 0, 0), group: "rear" as const })),
  ...[-0.3, 0.3].map(z => ({ at: new Vector3(noseXAt(z, 0.3) - 0.06, 0.3, z), direction: new Vector3(1, 0, 0), group: "front" as const })),
];

/** The same nozzles for the physics: positions relative to the centre of mass. */
export const NOZZLE_SPECS: readonly NozzleSpec[] = NOZZLE_MOUNTS.map(m => ({
  position: new Vector3(m.at.x, m.at.y - COM_HEIGHT, m.at.z),
  exhaust: m.direction.clone(),
  group: m.group,
  maxThrust: MAX_THRUST[m.group],
}));
