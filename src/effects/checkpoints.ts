// Checkpoints in the 3D world: glowing rings over what you have to get past, and pads where you should land.
// Each pulses blue until the car gets past it, then bursts green (cleared) or flashes red (hit).
import * as THREE from "three";
import { scene } from "../core/renderer";

export type CheckpointState = "idle" | "cleared" | "failed";

export interface CheckpointSpec {
  id: string;
  x: number; y: number; z: number;
  radius: number;
  kind: "gate" | "pad";    // gate: a ring floating over an obstacle; pad: a target ring on the ground
  facing?: "up" | "along"; // gates stand up across the course by default (hoops you go over or through); "up" lies flat
}

interface Checkpoint {
  spec: CheckpointSpec;
  root: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  state: CheckpointState;
  since: number;           // seconds in the current state
}

const COLORS: Record<CheckpointState, THREE.Color> = {
  idle: new THREE.Color(0x8fd8ff), cleared: new THREE.Color(0x5dffb0), failed: new THREE.Color(0xff3b30),
};
const group = new THREE.Group();
scene.add(group);
const checkpoints = new Map<string, Checkpoint>();

const ringGeometry = new THREE.TorusGeometry(1, 0.06, 10, 64);
const chevronGeometry = new THREE.ConeGeometry(0.28, 0.45, 4).rotateX(Math.PI);   // points down
const padRing = new THREE.RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2);
const padDisc = new THREE.CircleGeometry(0.86, 64).rotateX(-Math.PI / 2);
const padDash = new THREE.RingGeometry(0.6, 0.66, 48, 1, 0, Math.PI * 1.6).rotateX(-Math.PI / 2);

const glow = (opacity: number) => new THREE.MeshBasicMaterial({ color: COLORS.idle.clone(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });

function build(spec: CheckpointSpec): Checkpoint {
  const root = new THREE.Group();
  root.position.set(spec.x, spec.y, spec.z);
  const materials: THREE.MeshBasicMaterial[] = [];
  const add = (geometry: THREE.BufferGeometry, opacity: number) => { const m = glow(opacity); materials.push(m); const mesh = new THREE.Mesh(geometry, m); root.add(mesh); return mesh; };
  if (spec.kind === "gate") {
    const ring = add(ringGeometry, 0.9);
    ring.scale.setScalar(spec.radius);
    const flat = spec.facing === "up";
    if (flat) ring.rotation.x = Math.PI / 2; else ring.rotation.y = Math.PI / 2;
    const chevron = add(chevronGeometry, 0.85);
    chevron.position.y = flat ? 0.7 : spec.radius + 0.5;
  } else {
    root.position.y = 0.03;
    add(padRing, 0.85).scale.setScalar(spec.radius);
    add(padDisc, 0.12).scale.setScalar(spec.radius);
    add(padDash, 0.6).scale.setScalar(spec.radius);
  }
  group.add(root);
  return { spec, root, materials, state: "idle", since: 0 };
}

/** Replace all checkpoints. */
export function setCheckpoints(specs: readonly CheckpointSpec[]) {
  clearCheckpoints();
  for (const spec of specs) checkpoints.set(spec.id, build(spec));
}

export function clearCheckpoints() {
  for (const c of checkpoints.values()) { group.remove(c.root); for (const m of c.materials) m.dispose(); }
  checkpoints.clear();
}

/** Mark a checkpoint cleared or failed; returns false if it was not idle (each one changes once). */
export function setCheckpointState(id: string, state: Exclude<CheckpointState, "idle">): boolean {
  const c = checkpoints.get(id);
  if (!c || c.state !== "idle") return false;
  c.state = state; c.since = 0;
  for (const m of c.materials) m.color.copy(COLORS[state]);
  return true;
}

export const checkpointState = (id: string) => checkpoints.get(id)?.state;

/** Animate: idle ones bob and pulse, cleared ones burst outward and fade, failed ones flicker red. */
export function updateCheckpoints(dt: number, time: number) {
  for (const c of checkpoints.values()) {
    c.since += dt;
    const { root, spec } = c;
    if (c.state === "idle") {
      const pulse = 0.75 + 0.25 * Math.sin(time * 4 + spec.x);
      root.scale.setScalar(1);
      if (spec.kind === "gate") root.position.y = spec.y + Math.sin(time * 2 + spec.x) * 0.12;
      else root.rotation.y += dt * 0.8;
      c.materials.forEach((m, i) => { m.opacity = (i === 1 && spec.kind === "pad" ? 0.12 : 0.85) * pulse; });
    } else if (c.state === "cleared") {
      // a quick burst: grow and fade over 0.7 s (pads stay lit, they mark where you landed)
      const t = Math.min(1, c.since / 0.7);
      if (spec.kind === "gate") { root.scale.setScalar(1 + t * 0.9); c.materials.forEach(m => { m.opacity = (1 - t) * 1.2; }); root.visible = t < 1; }
      else { root.scale.setScalar(1 + 0.12 * Math.sin(Math.min(1, c.since / 0.5) * Math.PI)); c.materials.forEach((m, i) => { m.opacity = i === 1 ? 0.3 : 1; }); }
    } else {
      // failed: flicker for a second, then stay dim red
      const flicker = c.since < 1 ? (Math.sin(c.since * 40) > 0 ? 1 : 0.25) : 0.55;
      root.scale.setScalar(spec.kind === "gate" ? 1 + 0.1 * Math.max(0, 1 - c.since * 2) : 1);
      c.materials.forEach((m, i) => { m.opacity = (i === 1 && spec.kind === "pad" ? 0.25 : 1) * flicker; });
    }
  }
}
