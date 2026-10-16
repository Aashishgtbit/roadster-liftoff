// Where the parked vehicles for the lineup jump stand, and how big they are. Pure, so the physics and the tests use
// the same boxes the scene draws. Each vehicle is parked across the course: its length runs along z.
import type { BoxObstacle } from "../physics/types";

export interface ParkedVehicle {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly length: number;   // along z
  readonly width: number;    // along x
  readonly height: number;   // roof
}

export const LINEUP: readonly ParkedVehicle[] = [
  { name: "white sedan", x: -1.5, z: 0.2, length: 4.75, width: 1.9, height: 1.63 },
  { name: "red sedan", x: 1.6, z: -0.3, length: 4.75, width: 1.9, height: 1.63 },
  { name: "Semi", x: 4.9, z: 0.4, length: 4.3, width: 2.5, height: 3.55 },
  { name: "Cybertruck", x: 8.3, z: -0.2, length: 5.7, width: 2.04, height: 1.92 },
  { name: "Cybercab", x: 11.2, z: 0.1, length: 3.9, width: 1.92, height: 1.54 },
];

/** Past this x the car has cleared the whole lineup. */
export const LINEUP_END_X = Math.max(...LINEUP.map(v => v.x + v.width / 2)) + 1.5;

/** The vehicles as solid boxes for the physics. */
export function lineupObstacles(): BoxObstacle[] {
  return LINEUP.map(v => ({
    id: v.name, kind: "vehicle", minX: v.x - v.width / 2, maxX: v.x + v.width / 2,
    minY: 0, maxY: v.height, minZ: v.z - v.length / 2, maxZ: v.z + v.length / 2,
  }));
}
