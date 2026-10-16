// The Roadster's shape: measured cross-sections lofted into faceted body and glass geometry.
// Plan-view widths and the glass outline were traced from Tesla's overhead photo, the profile from the side photo
// (using the 0.72 m wheel as the scale). Each cross-section is a polygon, so the creases run nose to tail.
import * as THREE from "three";
import { clamp, sstep } from "../core/math.js";
import { AR, CAR_L, WR, XW } from "../config.js";

const KF = [ // x, half-width, floor, widest-point height, shoulder half-width, shoulder height, deck-edge half-width, deck-edge height, centreline height
  [ 2.280, 0.20, 0.30, 0.40, 0.18, 0.47, 0.14, 0.50, 0.50],
  [ 2.166, 0.64, 0.25, 0.40, 0.60, 0.52, 0.50, 0.56, 0.56],
  [ 2.052, 0.72, 0.22, 0.41, 0.68, 0.56, 0.56, 0.60, 0.60],
  [ 1.824, 0.865, 0.19, 0.42, 0.81, 0.62, 0.66, 0.66, 0.66],
  [ 1.596, 0.966, 0.16, 0.43, 0.91, 0.69, 0.74, 0.72, 0.72],
  [ 1.368, 0.976, 0.14, 0.44, 0.92, 0.75, 0.80, 0.77, 0.77],
  [ 0.912, 0.963, 0.12, 0.45, 0.91, 0.78, 0.84, 0.79, 0.77],
  [ 0.228, 0.955, 0.12, 0.45, 0.90, 0.82, 0.84, 0.83, 0.79],
  [-0.456, 0.953, 0.12, 0.47, 0.90, 0.86, 0.84, 0.87, 0.81],
  [-0.912, 0.953, 0.12, 0.51, 0.90, 0.94, 0.78, 0.98, 0.84],
  [-1.140, 0.970, 0.12, 0.54, 0.91, 1.00, 0.70, 1.07, 0.87],
  [-1.368, 1.000, 0.12, 0.56, 0.92, 0.97, 0.64, 1.07, 0.88],
  [-1.710, 1.000, 0.12, 0.56, 0.91, 0.94, 0.60, 1.04, 0.89],
  [-1.938, 0.946, 0.12, 0.56, 0.88, 0.92, 0.58, 1.00, 0.90],
  [-2.098, 0.890, 0.14, 0.56, 0.86, 0.90, 0.57, 0.975, 0.91],
  [-2.280, 0.840, 0.16, 0.57, 0.82, 0.89, 0.56, 0.95, 0.92],
].reverse();   // ascending x for interpolation
const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
function interp(K, x) {
  x = clamp(x, K[0][0], K[K.length - 1][0]);
  let i = 0; while (i < K.length - 2 && x > K[i + 1][0]) i++;
  const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(K.length - 1, i + 2)];
  const t = (x - b[0]) / (c[0] - b[0]);
  const out = []; for (let k = 1; k < b.length; k++) out.push(cr(a[k], b[k], c[k], d[k], t)); return out;
}
function archY(x) { let a = -1; for (const xw of XW) { const d = x - xw; if (Math.abs(d) < AR) a = Math.max(a, WR + Math.sqrt(AR * AR - d * d)); } return a; }
const swoopY = x => 0.27 + 0.27 * sstep(-0.4, -1.1, x);   // the black lower body sweeps up ahead of the rear wheel
const LIFT = [null, null, 0, 0, 0, 0, 0.015, 0.025, 0.03, null, null];
// half cross-section, z >= 0, from bottom centre round to top centre; points over a wheel are lifted to cut the arch
function section(x) {
  const [hw, yb, ySide0, hwS, yS, hwT, yT, yC] = interp(KF, x);
  const ySide = Math.max(ySide0, yb + 0.14), ysill = yb + Math.min(0.09, (ySide - yb) * 0.4);
  const ysw = clamp(swoopY(x), ysill + 0.015, ySide - 0.02);
  // behind the rear arches the lower body pulls in between the tyres, leaving the haunches overhanging
  const tuck = sstep(-1.95, -2.12, x), low = hw + (0.64 - hw) * tuck;
  const p = [[0, yb], [Math.min(0.58, hw * 0.6), yb], [Math.min(0.64, hw * 0.66, low * 0.9), yb], [low * 0.9, yb], [low * 0.985, ysill], [low, ysw], [hw, ySide],
             [Math.min(hwS, hw * 0.99), Math.max(yS, ySide + 0.02)], [Math.min(hwT, hwS * 0.98), Math.max(yT, yS)], [hwT * 0.45, yC + (yT - yC) * 0.3], [0, yC]];
  const lifted = p.map(() => false), A = archY(x);
  if (A > 0) for (let i = 2; i <= 8; i++) { const want = A + LIFT[i]; if (p[i][1] < want) { p[i] = [p[i][0], want]; lifted[i] = true; } }
  return { x, p, lifted };
}
function topAt(S, z) {   // body top surface height at |z|, across the upper facets
  const p = S.p, az = Math.abs(z);
  for (let k = 10; k > 6; k--) { const [z0, y0] = p[k], [z1, y1] = p[k - 1]; if (az <= z1) return y0 + (y1 - y0) * (az - z0) / ((z1 - z0) || 1); }
  return p[6][1];
}
function halfWidthAt(S, y) {   // widest |z| of the section outline at height y
  let w = 0; const p = S.p;
  for (let k = 0; k < p.length - 1; k++) { const [z0, y0] = p[k], [z1, y1] = p[k + 1]; if ((y - y0) * (y - y1) <= 0 && y0 !== y1) w = Math.max(w, z0 + (z1 - z0) * (y - y0) / (y1 - y0)); }
  return w;
}
function noseX(z, y) { for (let x = CAR_L / 2; x > 1.2; x -= 0.003) if (halfWidthAt(section(x), y) >= Math.abs(z)) return x; return 1.2; }
// loft both halves; every facet strip gets its own vertices so the creases stay sharp
function loft(secs, colorOf) {
  const pos = [], col = [], idx = [], NP = secs[0].p.length;
  for (const side of [1, -1]) for (let s = 0; s < NP - 1; s++) {
    const base = pos.length / 3;
    for (const S of secs) for (const k of [s, s + 1]) {
      const [z, y] = S.p[k]; pos.push(S.x, y, z * side);
      const c = colorOf(s, S, k); col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < secs.length - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function cap(S, front, color) {
  const loop = S.p.map(([z, y]) => [z, y]); for (let k = S.p.length - 2; k >= 1; k--) loop.push([-S.p[k][0], S.p[k][1]]);
  let cy = 0; for (const q of loop) cy += q[1]; cy /= loop.length;
  const pos = [S.x, cy, 0], col = [color.r, color.g, color.b], idx = [], M = loop.length;
  for (const [z, y] of loop) { pos.push(S.x, y, z); col.push(color.r, color.g, color.b); }
  for (let j = 0; j < M; j++) front ? idx.push(0, 1 + (j + 1) % M, 1 + j) : idx.push(0, 1 + j, 1 + (j + 1) % M);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

export { cap, halfWidthAt, interp, loft, noseX, section, topAt };
