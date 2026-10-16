// The telemetry cluster on the stage: speed, rotation, height, the nozzle map and suction, drawn as gauges.
import { NOZZLE_MOUNTS } from "../car/nozzle-layout";
import { COM_HEIGHT } from "../config";
import { FAN_MAX_FORCE } from "../physics/constants";
import { carState, sim } from "../run/sim";
import { byId } from "./dom";
import { createAltimeter, createAttitudeDial, createNozzleMap, createSpeedometer, createSuctionMeter } from "./gauges";

const phase = byId("hudPhase");
const setSpeed = createSpeedometer(byId("hudSpeed"));
const setAttitude = createAttitudeDial(byId("hudAttitude"));
const setHeight = createAltimeter(byId("hudHeight"));
const setNozzles = createNozzleMap(byId("hudNozzles"), NOZZLE_MOUNTS);
const setSuction = createSuctionMeter(byId("hudSuction"));

/** On the ramp wall the car pitches; past the runway it rolls. The dial shows whichever is happening. */
const ON_THE_WALL = new Set(["Fans", "Climb", "Hang", "Exit"]);

export function updateTelemetry(dt: number) {
  if (phase.textContent !== carState.phase) phase.textContent = carState.phase;
  setSpeed(carState.velocity.length() * 3.6);
  const pitching = carState.scenario === "ramp" && ON_THE_WALL.has(carState.phase);
  setAttitude(pitching ? carState.pitchAngle : carState.rollAngle, pitching ? "pitch" : "roll");
  setHeight(Math.max(0, carState.position.y - COM_HEIGHT));
  let total = 0;
  const levels = sim.nozzles.map(n => { total += n.thrust; return n.thrust / n.maxThrust; });
  setNozzles(levels, total / 1000);
  setSuction(carState.fanLevel, carState.fanLevel * FAN_MAX_FORCE / 1000, dt);
}
