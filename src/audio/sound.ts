// Sound synthesised live from the simulation with the Web Audio API (no audio files).
// Motor whine follows wheel speed, tyre roar follows road speed, the jets hiss and roar with total thrust and pop as
// each valve opens, the suction fans whine with fan power, landings thump, the wing actuator whirs. Volume falls off
// with the camera's distance and pans with the car's position on screen. Browsers allow audio only after a click, so
// it starts off.
import * as THREE from "three";
import { app } from "../core/state";
import { buttons, setLabel } from "../ui/dom";
import { clamp } from "../core/math";
import { WHEEL_RADIUS } from "../config";
import { camera } from "../core/renderer";
import { car, wing } from "../car/roadster";
import { carState, sim } from "../run/sim";
import type { Phase, WingMode } from "../physics/types";

/** The continuous voices, each with the parameters the update drives. */
interface Voices {
  motorSaw: OscillatorNode; motorTriangle: OscillatorNode; motorFilter: BiquadFilterNode; motorGain: GainNode;
  tyreGain: GainNode;
  jetHissGain: GainNode; jetRoarGain: GainNode;
  fanOscillator: OscillatorNode; fanToneGain: GainNode; fanNoiseGain: GainNode;
  windGain: GainNode;
}

interface SoundRig {
  ctx: AudioContext;
  master: GainNode;
  carBus: GainNode;                  // everything that comes from the car: attenuated and panned
  panner: StereoPannerNode | null;
  noise: AudioBuffer;
  voices: Voices;
}

let rig: SoundRig | null = null;
let enabled = false;
export const isSoundOn = () => enabled;

function createRig(): SoundRig | null {
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  const ctx = new AudioContextClass(), now = ctx.currentTime;
  const master = ctx.createGain(); master.gain.value = 0;
  const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -16; compressor.ratio.value = 4;
  master.connect(compressor); compressor.connect(ctx.destination);
  const carBus = ctx.createGain(), panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (panner) { carBus.connect(panner); panner.connect(master); } else carBus.connect(master);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const noiseSource = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(now, Math.random() * 1.5); return s; };
  const filter = (type: BiquadFilterType, frequency: number, q: number) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = q; return f; };
  const silentGain = (to: AudioNode = carBus) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(to); return g; };
  /** Noise through a filter into a new gain. */
  const filteredNoise = (type: BiquadFilterType, frequency: number, q: number, to?: AudioNode) => {
    const gain = silentGain(to), f = filter(type, frequency, q);
    noiseSource().connect(f); f.connect(gain);
    return gain;
  };

  // electric motor: two detuned oscillators through a resonant low-pass
  const motorSaw = ctx.createOscillator(), motorTriangle = ctx.createOscillator();
  motorSaw.type = "sawtooth"; motorTriangle.type = "triangle";
  const motorFilter = filter("lowpass", 1400, 3), motorGain = silentGain();
  motorSaw.connect(motorFilter); motorTriangle.connect(motorFilter); motorFilter.connect(motorGain);
  motorSaw.start(); motorTriangle.start();
  // fan: a whining tone plus turbine noise
  const fanOscillator = ctx.createOscillator(); fanOscillator.type = "sawtooth";
  const fanFilter = filter("bandpass", 900, 4), fanToneGain = silentGain();
  fanOscillator.connect(fanFilter); fanFilter.connect(fanToneGain); fanOscillator.start();
  const voices: Voices = {
    motorSaw, motorTriangle, motorFilter, motorGain,
    tyreGain: filteredNoise("bandpass", 520, 0.6),
    jetHissGain: filteredNoise("highpass", 1400, 0.7),
    jetRoarGain: filteredNoise("lowpass", 240, 0.8),
    fanOscillator, fanToneGain, fanNoiseGain: filteredNoise("bandpass", 2600, 1.5),
    windGain: filteredNoise("lowpass", 420, 0.5, master),   // wind is around the listener, not at the car
  };
  return { ctx, master, carBus, panner, noise, voices };
}

/** A short filtered noise hit: valve pops, impacts, scrapes. */
export function playNoiseBurst(duration: number, type: BiquadFilterType, frequency: number, peak: number) {
  if (!enabled || !rig) return;
  const { ctx, noise, carBus } = rig, t = ctx.currentTime;
  const source = ctx.createBufferSource(); source.buffer = noise;
  const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency; filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(peak, t + 0.008); gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  source.connect(filter); filter.connect(gain); gain.connect(carBus);
  source.start(t, Math.random()); source.stop(t + duration + 0.05);
}

/** A landing or impact: a falling sine under a low noise hit. `strength` 0..1. */
export function playThump(strength: number) {
  if (!enabled || !rig) return;
  const { ctx, carBus } = rig, t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.frequency.setValueAtTime(75, t); osc.frequency.exponentialRampToValueAtTime(32, t + 0.35);
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.9 * strength, t + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain); gain.connect(carBus); osc.start(t); osc.stop(t + 0.55);
  playNoiseBurst(0.35, "lowpass", 500, 0.7 * strength);
}

/** The wing actuator whir. */
function playServo() {
  if (!enabled || !rig) return;
  const { ctx, carBus } = rig, t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
  const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 1100; filter.Q.value = 2;
  osc.type = "square"; osc.frequency.setValueAtTime(260, t); osc.frequency.linearRampToValueAtTime(820, t + 0.55);
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.06, t + 0.05); gain.gain.setValueAtTime(0.06, t + 0.5); gain.gain.linearRampToValueAtTime(0, t + 0.65);
  osc.connect(filter); filter.connect(gain); gain.connect(carBus); osc.start(t); osc.stop(t + 0.7);
}

/** A rising two-octave blip for pickups and the finish (not positioned on the car). */
export function playChime(frequency: number) {
  if (!enabled || !rig) return;
  const { ctx, master } = rig, t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = "triangle"; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(frequency * 2, t + 0.12);
  gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc.connect(gain); gain.connect(master); osc.start(t); osc.stop(t + 0.4);
}

const TOTAL_MAX_THRUST = 72000;   // N, all ten nozzles at full power
const onScreen = new THREE.Vector3();
const previous = { phase: "" as Phase | "", nozzleLevels: [] as number[], wingMode: -1 as WingMode | -1 };

/** Set every voice from the simulation; called once per frame. */
export function updateSound() {
  if (!enabled || !rig) return;
  const { ctx, carBus, panner, voices: v } = rig, t = ctx.currentTime;
  const glide = (param: AudioParam, value: number, timeConstant = 0.06) => param.setTargetAtTime(value, t, timeConstant);
  const live = app.playing && app.visible ? 1 : 0;
  const speed = carState.velocity.length(), grounded = carState.wheelsOnGround > 0;
  let thrust = 0;
  for (const n of sim.nozzles) thrust += n.thrust;
  const thrustShare = thrust / TOTAL_MAX_THRUST;

  glide(carBus.gain, live * clamp(9 / camera.position.distanceTo(car.position), 0.12, 1.3), 0.1);
  if (panner) { onScreen.copy(car.position).project(camera); glide(panner.pan, clamp(onScreen.x * 0.85, -1, 1), 0.08); }
  const wheelSpeed = Math.abs(sim.wheels[0].spinRate) * WHEEL_RADIUS, motorPitch = 70 + wheelSpeed * 34;
  glide(v.motorSaw.frequency, motorPitch); glide(v.motorTriangle.frequency, motorPitch * 2.013);
  glide(v.motorFilter.frequency, 700 + wheelSpeed * 160);
  glide(v.motorGain.gain, (carState.phase === "Parked" ? 0.012 : 0.03) + 0.07 * Math.min(1, wheelSpeed / 12));
  glide(v.tyreGain.gain, grounded ? 0.22 * Math.min(1, speed / 14) : 0, 0.04);
  glide(v.jetHissGain.gain, 0.55 * Math.sqrt(Math.min(1, thrustShare)), 0.03);
  glide(v.jetRoarGain.gain, 0.6 * Math.min(1, thrustShare * 1.3), 0.03);
  glide(v.fanOscillator.frequency, 90 + 520 * carState.fanLevel); glide(v.fanToneGain.gain, 0.09 * carState.fanLevel); glide(v.fanNoiseGain.gain, 0.16 * carState.fanLevel);
  glide(v.windGain.gain, live * (0.025 + (grounded ? 0 : 0.12 * Math.min(1, speed / 12))), 0.2);

  // events: valve pops, touchdown thump, the hang, wing actuator
  sim.nozzles.forEach((n, i) => {
    const level = n.thrust / n.maxThrust, before = previous.nozzleLevels[i] ?? 0;
    if (live && before < 0.12 && level >= 0.12) playNoiseBurst(0.09, "highpass", 2200, 0.35);
    previous.nozzleLevels[i] = level;
  });
  if (live && carState.phase === "Touchdown" && previous.phase !== "Touchdown") playThump(Math.min(1, 0.4 + Math.abs(carState.velocity.y) / 4));
  if (live && carState.phase === "Hang" && previous.phase !== "Hang") playNoiseBurst(0.25, "lowpass", 300, 0.3);
  if (wing.mode !== previous.wingMode && previous.wingMode >= 0) playServo();
  previous.phase = carState.phase;
  previous.wingMode = wing.mode;
}

export function setSound(on: boolean) {
  if (on && !rig) {
    rig = createRig();
    if (!rig) { setLabel(buttons.sound, "Sound unavailable"); buttons.sound.disabled = true; return; }
  }
  enabled = on;
  setLabel(buttons.sound, on ? "Sound: on" : "Sound: off");
  buttons.sound.setAttribute("aria-pressed", String(on));
  if (!rig) return;
  if (on) void rig.ctx.resume();
  rig.master.gain.setTargetAtTime(on ? 0.9 : 0, rig.ctx.currentTime, 0.08);
}
