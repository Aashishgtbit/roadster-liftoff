// Cold-gas plumes: soft particles blown out of each firing nozzle, drifting up and spreading along the ground.
import * as THREE from "three";
import { scene } from "../core/renderer";

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;    // 1 when emitted, removed at 0
  decay: number;   // life lost per second
  size: number;    // m
  growth: number;  // m per second
}

const MAX_PARTICLES = 2200;
let particles: Particle[] = [];

const positions = new Float32Array(MAX_PARTICLES * 3), sizes = new Float32Array(MAX_PARTICLES), alphas = new Float32Array(MAX_PARTICLES);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
const material = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uScale: { value: 400 } },
  vertexShader: "attribute float aSize; attribute float aAlpha; varying float vAlpha; uniform float uScale; void main(){ vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }",
  fragmentShader: "varying float vAlpha; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(vec3(.82,.88,.96), a * a * vAlpha); }",
});
const points = new THREE.Points(geometry, material);
points.frustumCulled = false;
scene.add(points);

/** Pixels per metre at 1 m from the camera, so particle sizes are in metres. */
export function setPlumePointScale(scale: number) { material.uniforms.uScale.value = scale; }

export function clearPlumes() { particles = []; }

const origin = new THREE.Vector3(), direction = new THREE.Vector3(), rotation = new THREE.Quaternion();

/** Emit gas from a nozzle object (its -y axis points along the exhaust) firing at `level` (0..1) for `dt` seconds. */
export function emitPlume(nozzle: THREE.Object3D, level: number, dt: number) {
  let count = Math.floor((30 + 190 * level) * dt + Math.random());
  if (!count) return;
  nozzle.getWorldPosition(origin);
  nozzle.getWorldQuaternion(rotation);
  direction.set(0, -1, 0).applyQuaternion(rotation);
  const speed = 3 + 15 * level, size = 0.32 + 0.5 * level, jitter = speed * 0.18;
  while (count-- > 0 && particles.length < MAX_PARTICLES) {
    const v = speed * (0.6 + Math.random() * 0.7);
    particles.push({
      x: origin.x, y: origin.y, z: origin.z,
      vx: direction.x * v + (Math.random() - 0.5) * jitter, vy: direction.y * v + (Math.random() - 0.5) * jitter, vz: direction.z * v + (Math.random() - 0.5) * jitter,
      life: 1, decay: 0.45 + Math.random() * 0.5, size: size * (0.5 + Math.random() * 0.6), growth: size * (1.2 + Math.random()),
    });
  }
}

/** Move, grow and fade the particles; gas that reaches the ground spreads outward from `source` (the car). */
export function updatePlumes(dt: number, source: THREE.Vector3) {
  const drag = Math.exp(-2.2 * dt);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vx *= drag; p.vy = p.vy * drag + 0.5 * dt; p.vz *= drag;   // cold gas still rises a little as it mixes
    if (p.y < 0.08) {
      p.y = 0.08;
      const spread = Math.abs(p.vy) * 0.6, away = Math.atan2(p.z - source.z, p.x - source.x);
      p.vy = Math.abs(p.vy) * 0.08; p.vx += Math.cos(away) * spread; p.vz += Math.sin(away) * spread;
    }
    p.size += p.growth * dt; p.life -= p.decay * dt;
    if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); }
  }
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
    sizes[i] = p.size; alphas[i] = Math.pow(p.life, 1.4) * 0.42;
  }
  geometry.setDrawRange(0, particles.length);
  geometry.attributes.position.needsUpdate = geometry.attributes.aSize.needsUpdate = geometry.attributes.aAlpha.needsUpdate = true;
}
