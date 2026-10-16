// The Roadster's shape: measured cross-sections lofted into faceted body and glass geometry.
// Plan-view widths and the glass outline were traced from Tesla's overhead photo, the profile from the side photo
// (using the 0.72 m wheel as the scale). Each cross-section is a polygon, so the creases run nose to tail.
import * as THREE from "three";
import { clamp, smoothstep } from "../core/math";
import { AXLE_X, CAR_LENGTH, WHEEL_ARCH_RADIUS, WHEEL_RADIUS } from "../config";

/** A row of numbers keyed by x: the first column is x, the rest are interpolated along the car. */
export type Keyframe = readonly number[];

/** A point on a cross-section: [z (half-width), y (height)]. */
export type SectionPoint = [number, number];

/** A half cross-section at `x`, from bottom centre round to top centre (z >= 0). */
export interface CrossSection {
  x: number;
  points: SectionPoint[];
  lifted: boolean[];   // points raised to cut a wheel arch
}

// x, half-width, floor, widest-point height, shoulder half-width, shoulder height, deck-edge half-width,
// deck-edge height, centreline height
const BODY_KEYFRAMES: Keyframe[] = [
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

const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

/** Smoothly interpolate every column of a keyframe table (ascending x) at `x`. */
export function interpolateKeyframes(table: readonly Keyframe[], x: number): number[] {
  x = clamp(x, table[0][0], table[table.length - 1][0]);
  let i = 0;
  while (i < table.length - 2 && x > table[i + 1][0]) i++;
  const a = table[Math.max(0, i - 1)], b = table[i], c = table[i + 1], d = table[Math.min(table.length - 1, i + 2)];
  const t = (x - b[0]) / (c[0] - b[0]);
  const out: number[] = [];
  for (let k = 1; k < b.length; k++) out.push(catmullRom(a[k], b[k], c[k], d[k], t));
  return out;
}

/** Height of the top of the wheel arch at `x`, or -1 away from the wheels. */
function wheelArchTop(x: number): number {
  let top = -1;
  for (const axle of AXLE_X) {
    const d = x - axle;
    if (Math.abs(d) < WHEEL_ARCH_RADIUS) top = Math.max(top, WHEEL_RADIUS + Math.sqrt(WHEEL_ARCH_RADIUS * WHEEL_ARCH_RADIUS - d * d));
  }
  return top;
}

/** The black lower body sweeps up ahead of the rear wheel. */
const swoopHeight = (x: number) => 0.27 + 0.27 * smoothstep(-0.4, -1.1, x);

/** How far above the arch each section point is lifted (null: never lifted). */
const ARCH_CLEARANCE = [null, null, 0, 0, 0, 0, 0.015, 0.025, 0.03, null, null];

/** The body's half cross-section at `x`; points over a wheel are lifted to cut the arch. */
export function crossSection(x: number): CrossSection {
  const [halfWidth, floorY, widestY0, shoulderHalfWidth, shoulderY, deckHalfWidth, deckY, centreY] = interpolateKeyframes(BODY_KEYFRAMES, x);
  const widestY = Math.max(widestY0, floorY + 0.14), sillY = floorY + Math.min(0.09, (widestY - floorY) * 0.4);
  const swoopY = clamp(swoopHeight(x), sillY + 0.015, widestY - 0.02);
  // behind the rear arches the lower body pulls in between the tyres, leaving the haunches overhanging
  const tuck = smoothstep(-1.95, -2.12, x), lowerHalfWidth = halfWidth + (0.64 - halfWidth) * tuck;
  const points: SectionPoint[] = [
    [0, floorY],
    [Math.min(0.58, halfWidth * 0.6), floorY],
    [Math.min(0.64, halfWidth * 0.66, lowerHalfWidth * 0.9), floorY],
    [lowerHalfWidth * 0.9, floorY],
    [lowerHalfWidth * 0.985, sillY],
    [lowerHalfWidth, swoopY],
    [halfWidth, widestY],
    [Math.min(shoulderHalfWidth, halfWidth * 0.99), Math.max(shoulderY, widestY + 0.02)],
    [Math.min(deckHalfWidth, shoulderHalfWidth * 0.98), Math.max(deckY, shoulderY)],
    [deckHalfWidth * 0.45, centreY + (deckY - centreY) * 0.3],
    [0, centreY],
  ];
  const lifted = points.map(() => false), archTop = wheelArchTop(x);
  if (archTop > 0) {
    for (let i = 2; i <= 8; i++) {
      const want = archTop + (ARCH_CLEARANCE[i] ?? 0);
      if (points[i][1] < want) { points[i] = [points[i][0], want]; lifted[i] = true; }
    }
  }
  return { x, points, lifted };
}

/** Body top surface height at |z|, across the upper facets. */
export function topHeightAt(section: CrossSection, z: number): number {
  const p = section.points, az = Math.abs(z);
  for (let k = 10; k > 6; k--) {
    const [z0, y0] = p[k], [z1, y1] = p[k - 1];
    if (az <= z1) return y0 + (y1 - y0) * (az - z0) / ((z1 - z0) || 1);
  }
  return p[6][1];
}

/** Widest |z| of the section outline at height y. */
export function halfWidthAt(section: CrossSection, y: number): number {
  let width = 0;
  const p = section.points;
  for (let k = 0; k < p.length - 1; k++) {
    const [z0, y0] = p[k], [z1, y1] = p[k + 1];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) width = Math.max(width, z0 + (z1 - z0) * (y - y0) / (y1 - y0));
  }
  return width;
}

/** Where the nose surface is, along x, at a given side offset and height. */
export function noseXAt(z: number, y: number): number {
  for (let x = CAR_LENGTH / 2; x > 1.2; x -= 0.003) if (halfWidthAt(crossSection(x), y) >= Math.abs(z)) return x;
  return 1.2;
}

/** The colour of one facet strip: which strip, the section, and which point of it. */
export type FacetColor = (strip: number, section: CrossSection, point: number) => THREE.Color;

/** Loft both halves of a list of sections; every facet strip gets its own vertices so the creases stay sharp. */
export function loft(sections: readonly CrossSection[], colorOf: FacetColor): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const pointCount = sections[0].points.length;
  for (const side of [1, -1]) {
    for (let strip = 0; strip < pointCount - 1; strip++) {
      const base = positions.length / 3;
      for (const s of sections) {
        for (const k of [strip, strip + 1]) {
          const [z, y] = s.points[k];
          positions.push(s.x, y, z * side);
          const c = colorOf(strip, s, k);
          colors.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < sections.length - 1; i++) {
        const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
        if (side > 0) indices.push(a, c, b, b, c, d); else indices.push(a, b, c, b, d, c);
      }
    }
  }
  return indexedGeometry(positions, colors, indices);
}

/** Close the end of a loft with a fan of triangles across the full (both-sided) section. */
export function capSection(section: CrossSection, facingForward: boolean, color: THREE.Color): THREE.BufferGeometry {
  const loop = section.points.map(([z, y]): SectionPoint => [z, y]);
  for (let k = section.points.length - 2; k >= 1; k--) loop.push([-section.points[k][0], section.points[k][1]]);
  let centreY = 0;
  for (const [, y] of loop) centreY += y;
  centreY /= loop.length;
  const positions = [section.x, centreY, 0], colors = [color.r, color.g, color.b], indices: number[] = [], n = loop.length;
  for (const [z, y] of loop) { positions.push(section.x, y, z); colors.push(color.r, color.g, color.b); }
  for (let j = 0; j < n; j++) {
    if (facingForward) indices.push(0, 1 + (j + 1) % n, 1 + j); else indices.push(0, 1 + j, 1 + (j + 1) % n);
  }
  return indexedGeometry(positions, colors, indices);
}

function indexedGeometry(positions: number[], colors: number[], indices: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
