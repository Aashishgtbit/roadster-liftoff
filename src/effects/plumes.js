// Cold-gas plume particles.
import * as THREE from "three";
import { state } from "../core/state.js";
import { scene } from "../core/renderer.js";
import { NOZ, car } from "../car/roadster.js";

/* ---------- cold-gas plumes ---------- */
const MAXP = 2200;
const pPos = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute("aAlpha", new THREE.BufferAttribute(pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uScale: { value: 400 } },
  vertexShader: "attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale; void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }",
  fragmentShader: "varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(vec3(.82,.88,.96), a * a * vA); }"
});
const plume = new THREE.Points(pGeo, pMat); plume.frustumCulled = false; scene.add(plume);
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function emit(group, rate, dt, speed, size) {
  for (const nz of NOZ) {
    if (nz.group !== group) continue;
    nz.firing = true;
    let n = Math.floor(rate * dt + Math.random());
    if (!n) continue;
    nz.o.getWorldPosition(_p); nz.o.getWorldQuaternion(_q); _d.set(0, -1, 0).applyQuaternion(_q);
    while (n-- > 0 && state.parts.length < MAXP) {
      const sp = speed * (0.6 + Math.random() * 0.7), j = speed * 0.18;
      state.parts.push({ x: _p.x, y: _p.y, z: _p.z, vx: _d.x * sp + (Math.random() - 0.5) * j, vy: _d.y * sp + (Math.random() - 0.5) * j, vz: _d.z * sp + (Math.random() - 0.5) * j,
        life: 1, decay: 0.45 + Math.random() * 0.5, s: size * (0.5 + Math.random() * 0.6), grow: size * (1.2 + Math.random()) });
    }
  }
}
function updateParts(dt) {
  const drag = Math.exp(-2.2 * dt);
  for (let i = state.parts.length - 1; i >= 0; i--) {
    const q = state.parts[i];
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    q.vx *= drag; q.vy = q.vy * drag + 0.5 * dt; q.vz *= drag;
    if (q.y < 0.08) { q.y = 0.08; const h = Math.abs(q.vy) * 0.6; q.vy = Math.abs(q.vy) * 0.08; const a = Math.atan2(q.z - car.position.z, q.x - car.position.x); q.vx += Math.cos(a) * h; q.vz += Math.sin(a) * h; }
    q.s += q.grow * dt; q.life -= q.decay * dt;
    if (q.life <= 0) { state.parts[i] = state.parts[state.parts.length - 1]; state.parts.pop(); }
  }
  for (let i = 0; i < state.parts.length; i++) { const q = state.parts[i]; pPos[i * 3] = q.x; pPos[i * 3 + 1] = q.y; pPos[i * 3 + 2] = q.z; pSize[i] = q.s; pAlpha[i] = Math.pow(q.life, 1.4) * 0.42; }
  pGeo.setDrawRange(0, state.parts.length);
  pGeo.attributes.position.needsUpdate = pGeo.attributes.aSize.needsUpdate = pGeo.attributes.aAlpha.needsUpdate = true;
}

export { MAXP, _d, _p, _q, pMat, updateParts };
