// Sound synthesised live from the simulation with the Web Audio API.
import * as THREE from "three";
import { state } from "../core/state.js";
import { soundBtn } from "../ui/dom.js";
import { clamp } from "../core/math.js";
import { WR } from "../config.js";
import { camera } from "../core/renderer.js";
import { car, wing } from "../car/roadster.js";
import { sim, st } from "../run/runner.js";

/* ---------- sound: synthesised live from the simulation (no audio files) ---------- */
// Motor whine follows wheel speed, tyre roar follows road speed, the jets hiss and roar with total thrust and pop as each
// valve opens, the suction fans whine with fan power, landings thump, the wing actuator whirs. Volume falls off with the
// camera's distance and pans with the car's position on screen. Browsers allow audio only after a click, so it starts off.
const snd = { ctx: null, on: false };
function soundInit() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  const ctx = new AC(), now = ctx.currentTime;
  const master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  const carBus = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) { carBus.connect(pan); pan.connect(master); } else carBus.connect(master);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(now, Math.random() * 1.5); return s; };
  const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = (to = carBus) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(to); return g; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  // electric motor: two detuned oscillators through a resonant low-pass
  const m1 = ctx.createOscillator(), m2 = ctx.createOscillator(); m1.type = "sawtooth"; m2.type = "triangle";
  const mF = filt("lowpass", 1400, 3), mG = gain(); m1.connect(mF); m2.connect(mF); mF.connect(mG); m1.start(); m2.start();
  const tG = gain(); chain(noise(), filt("bandpass", 520, 0.6), tG);                     // tyre roar
  const jH = gain(); chain(noise(), filt("highpass", 1400, 0.7), jH);                    // jet hiss
  const jR = gain(); chain(noise(), filt("lowpass", 240, 0.8), jR);                      // jet roar
  const f1 = ctx.createOscillator(); f1.type = "sawtooth"; const fF = filt("bandpass", 900, 4), fG = gain(); f1.connect(fF); fF.connect(fG); f1.start();
  const fN = gain(); chain(noise(), filt("bandpass", 2600, 1.5), fN);                    // fan turbine
  const wG = gain(master); chain(noise(), filt("lowpass", 420, 0.5), wG);                // wind, around the listener
  snd.ctx = ctx; snd.master = master; snd.pan = pan; snd.carBus = carBus;
  snd.n = { m1, m2, mF, mG, tG, jH, jR, f1, fG, fN, wG };
  snd.burst = (dur, type, f, peak, to = carBus) => {     // short filtered noise hit: valve pops, impacts
    const s = ctx.createBufferSource(); s.buffer = nb; const b = filt(type, f, 0.8), g = ctx.createGain(), t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(b); b.connect(g); g.connect(to); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  };
  snd.thump = (k) => {   // landing: a falling sine under a low noise hit
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(75, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9 * k, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(carBus); o.start(t); o.stop(t + 0.55); snd.burst(0.35, "lowpass", 500, 0.7 * k);
  };
  snd.servo = () => {    // wing actuator whir
    const t = ctx.currentTime, o = ctx.createOscillator(), b = filt("bandpass", 1100, 2), g = ctx.createGain();
    o.type = "square"; o.frequency.setValueAtTime(260, t); o.frequency.linearRampToValueAtTime(820, t + 0.55);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.05); g.gain.setValueAtTime(0.06, t + 0.5); g.gain.linearRampToValueAtTime(0, t + 0.65);
    o.connect(b); b.connect(g); g.connect(carBus); o.start(t); o.stop(t + 0.7);
  };
  return true;
}
const _sv = new THREE.Vector3(), sndPrev = { phase: "", frac: [], wing: -1 };
function soundUpdate() {
  if (!snd.on || !snd.ctx) return;
  const t = snd.ctx.currentTime, set = (p, v, k = 0.06) => p.setTargetAtTime(v, t, k), n = snd.n;
  const live = state.playing && state.visible ? 1 : 0;
  const spd = st.vel.length(), grounded = st.contacts > 0, airborne = !grounded;
  let frac = 0; for (const z of sim.noz) frac += z.T; frac /= 72000;
  set(snd.carBus.gain, live * clamp(9 / camera.position.distanceTo(car.position), 0.12, 1.3), 0.1);
  if (snd.pan) { _sv.copy(car.position).project(camera); set(snd.pan.pan, clamp(_sv.x * 0.85, -1, 1), 0.08); }
  const wheelSpd = Math.abs(sim.wheels[0].spin) * WR;
  set(n.m1.frequency, 70 + wheelSpd * 34); set(n.m2.frequency, (70 + wheelSpd * 34) * 2.013);
  set(n.mF.frequency, 700 + wheelSpd * 160);
  set(n.mG.gain, (st.phase === "Parked" ? 0.012 : 0.03) + 0.07 * Math.min(1, wheelSpd / 12));
  set(n.tG.gain, grounded ? 0.22 * Math.min(1, spd / 14) : 0, 0.04);
  set(n.jH.gain, 0.55 * Math.sqrt(Math.min(1, frac)), 0.03); set(n.jR.gain, 0.6 * Math.min(1, frac * 1.3), 0.03);
  set(n.f1.frequency, 90 + 520 * st.fan); set(n.fG.gain, 0.09 * st.fan); set(n.fN.gain, 0.16 * st.fan);
  set(n.wG.gain, live * (0.025 + (airborne ? 0.12 * Math.min(1, spd / 12) : 0)), 0.2);
  // events: valve pops, touchdown thump, wing actuator
  sim.noz.forEach((z, i) => { const f = z.T / z.Tmax, p = sndPrev.frac[i] || 0; if (live && p < 0.12 && f >= 0.12) snd.burst(0.09, "highpass", 2200, 0.35); sndPrev.frac[i] = f; });
  if (live && st.phase === "Touchdown" && sndPrev.phase !== "Touchdown") snd.thump(Math.min(1, 0.4 + Math.abs(st.vel.y) / 4));
  if (live && st.phase === "Hang" && sndPrev.phase !== "Hang") snd.burst(0.25, "lowpass", 300, 0.3);
  if (wing.userData.mode !== sndPrev.wing && sndPrev.wing >= 0) snd.servo();
  sndPrev.phase = st.phase; sndPrev.wing = wing.userData.mode;
}
function setSound(on) {
  if (on && !snd.ctx && !soundInit()) { soundBtn.lastElementChild.textContent = "Sound unavailable"; soundBtn.disabled = true; return; }
  snd.on = on;
  soundBtn.lastElementChild.textContent = on ? "Sound: on" : "Sound: off"; soundBtn.setAttribute("aria-pressed", String(on));
  if (!snd.ctx) return;
  if (on) snd.ctx.resume();
  snd.master.gain.setTargetAtTime(on ? 0.9 : 0, snd.ctx.currentTime, 0.08);
}

export { setSound, snd, soundUpdate };
