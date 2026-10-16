// Builds the Roadster: body, glasshouse, lights, tail, actuated wing, ten nozzles and wheels.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { clamp } from "../core/math";
import { AXLE_X, CAR_LENGTH, COM_HEIGHT, HALF_TRACK, WHEEL_RADIUS } from "../config";
import { enableShadows, scene } from "../core/renderer";
import type { WingMode } from "../physics/types";
import { capSection, crossSection, halfWidthAt, interpolateKeyframes, loft, noseXAt, topHeightAt } from "./geometry";
import type { CrossSection, Keyframe } from "./geometry";
import {
  PAINT_COLOR, UNDERBODY_COLOR, blackMaterial, bronzeGlassMaterial, carbonMaterial, chromeMaterial, headlightMaterial,
  paintMaterial, solidPaintMaterial, tailLightMaterial,
} from "./materials";
import { NOZZLE_MOUNTS } from "./nozzle-layout";

/** The whole car; its origin is the centre of mass, so the physics pose applies directly. */
export const car = new THREE.Group();
/** The sprung parts: everything but the wheels. */
export const body = new THREE.Group();
car.add(body);
scene.add(car);
body.position.y = -COM_HEIGHT;

const TAIL_X = -CAR_LENGTH / 2;
const box = (w: number, h: number, d: number, material: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
const tube = (points: THREE.Vector3[], segments: number, radius: number, radial: number, material: THREE.Material) =>
  new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, radial, false), material);

// ---------- body shell ----------
{
  const SECTIONS = 300, sections: CrossSection[] = [];
  for (let i = 0; i <= SECTIONS; i++) sections.push(crossSection(-CAR_LENGTH / 2 + CAR_LENGTH * i / SECTIONS));
  // black: the lower strips, the cut arch edges, and the tail below the deck
  const isUnderbody = (strip: number, s: CrossSection, point: number) => strip <= 4 || (point <= 5 && s.lifted[point]) || (strip >= 8 && s.x < -1.69);
  body.add(new THREE.Mesh(loft(sections, (strip, s, point) => isUnderbody(strip, s, point) ? UNDERBODY_COLOR : PAINT_COLOR), paintMaterial));
  body.add(new THREE.Mesh(capSection(sections[0], false, PAINT_COLOR), paintMaterial));
  body.add(new THREE.Mesh(capSection(sections[SECTIONS], true, PAINT_COLOR), paintMaterial));
}

// ---------- glasshouse ----------
// windshield raked from just behind the front axle; roof peak 60% back; glass tapers to a cut just short of the tail.
// x, side-glass base half-width, roof-glass half-width, roof height
const CANOPY_KEYFRAMES: Keyframe[] = [
  [-1.74, 0.34, 0.33, 0], [-1.69, 0.35, 0.34, 1.0], [-1.578, 0.38, 0.37, 1.04], [-1.40, 0.43, 0.42, 1.08], [-1.240, 0.49, 0.46, 1.11],
  [-1.015, 0.66, 0.47, 1.135], [-0.789, 0.76, 0.49, 1.16], [-0.52, 0.83, 0.50, 1.17], [-0.2, 0.85, 0.52, 1.14], [0.2, 0.85, 0.54, 1.075],
  [0.66, 0.85, 0.61, 0.97], [0.89, 0.85, 0.665, 0.92], [1.18, 0.82, 0.72, 0.86], [1.368, 0.76, 0.74, 0.82], [1.48, 0.62, 0.59, 0],
];
{
  // three bands, as the overhead photo shows: near-vertical side windows, a white roof rail (the top of the doors),
  // bronze roof glass
  const x0 = CANOPY_KEYFRAMES[0][0], x1 = CANOPY_KEYFRAMES[CANOPY_KEYFRAMES.length - 1][0], STEPS = 160;
  const sideGlass: CrossSection[] = [], roofRail: CrossSection[] = [], roofGlass: CrossSection[] = [];
  const band = (x: number, points: [number, number][]): CrossSection => ({ x, points, lifted: [] });
  for (let i = 0; i <= STEPS; i++) {
    const x = x0 + (x1 - x0) * i / STEPS, [baseHalfWidth, roofHalfWidth, roofHeight] = interpolateKeyframes(CANOPY_KEYFRAMES, x), s = crossSection(x);
    const baseY = topHeightAt(s, baseHalfWidth) - 0.01, centreY = topHeightAt(s, 0);
    const top = Math.max(roofHeight, centreY + 0.004);
    const edgeY = Math.max(baseY, top - 0.035 - 0.02 * (roofHalfWidth / 0.7), topHeightAt(s, roofHalfWidth) + 0.002);
    // how tall the side window is here: none where the canopy narrows to the roof glass
    const sideShare = clamp((baseHalfWidth - roofHalfWidth) / 0.18, 0, 1);
    const railZ = baseHalfWidth - 0.07 * sideShare, railY = baseY + (edgeY - baseY) * 0.9 * sideShare;
    sideGlass.push(band(x, [[baseHalfWidth, baseY], [railZ, railY]]));
    roofRail.push(band(x, [[railZ, railY], [railZ - (railZ - roofHalfWidth) * 0.35, railY + (edgeY - railY) * 0.8], [roofHalfWidth, edgeY]]));
    roofGlass.push(band(x, [[roofHalfWidth, edgeY], [roofHalfWidth * 0.5, Math.max(top - 0.008, topHeightAt(s, roofHalfWidth * 0.5) + 0.002)], [0, top]]));
  }
  body.add(new THREE.Mesh(loft(sideGlass, () => PAINT_COLOR), bronzeGlassMaterial));
  body.add(new THREE.Mesh(loft(roofRail, () => PAINT_COLOR), solidPaintMaterial));
  body.add(new THREE.Mesh(loft(roofGlass, () => PAINT_COLOR), bronzeGlassMaterial));
}

// ---------- lights and details ----------
{
  // full-width front light bar where the hood meets the nose, following the round plan shape
  const LIGHT_BAR_Y = 0.47, barPoints: THREE.Vector3[] = [];
  for (let z = -0.74; z <= 0.7401; z += 0.04) barPoints.push(new THREE.Vector3(noseXAt(z, LIGHT_BAR_Y) + 0.004, LIGHT_BAR_Y - 0.012 * (z / 0.74) ** 2, z));
  body.add(tube(barPoints, 90, 0.009, 8, headlightMaterial));
  const splitter = box(0.25, 0.03, 1.2, carbonMaterial);
  splitter.position.set(noseXAt(0, 0.3) - 0.1, 0.2, 0); body.add(splitter);

  // tail: black band with the red light bar, silver plate panel, deep diffuser with strakes
  const lip = box(0.16, 0.075, 1.7, carbonMaterial); lip.position.set(TAIL_X - 0.02, 0.875, 0); body.add(lip);
  const lipTop = box(0.2, 0.012, 1.7, solidPaintMaterial); lipTop.position.set(TAIL_X, 0.918, 0); lipTop.rotation.z = -0.12; body.add(lipTop);
  const tailLight = box(0.02, 0.022, 1.62, tailLightMaterial); tailLight.position.set(TAIL_X - 0.105, 0.88, 0); body.add(tailLight);
  const plate = box(0.012, 0.15, 0.34, new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: 0.5 })); plate.position.set(TAIL_X - 0.01, 0.69, 0); body.add(plate);
  const diffuser = box(0.4, 0.5, 1.28, carbonMaterial); diffuser.position.set(TAIL_X + 0.19, 0.33, 0); body.add(diffuser);
  for (const z of [-0.62, -0.32, 0, 0.32, 0.62]) { const strake = box(0.42, 0.3, 0.014, carbonMaterial); strake.position.set(TAIL_X + 0.05, 0.25, z); body.add(strake); }
  const shelf = box(0.4, 0.02, 1.3, carbonMaterial); shelf.position.set(TAIL_X + 0.03, 0.42, 0); body.add(shelf);

  // camera wings by the windshield base
  for (const z of [-0.9, 0.9]) {
    const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.045, 0.09, 2, 0.02), carbonMaterial);
    mirror.position.set(1.18, 0.84, z); body.add(mirror);
  }
  // amber side marker at the back of the front fender, as in the wheel close-up
  const markerMaterial = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff5a10, emissiveIntensity: 1.2 });
  const markerSection = crossSection(0.95);
  for (const side of [-1, 1]) {
    const marker = box(0.11, 0.022, 0.006, markerMaterial);
    marker.position.set(0.95, 0.68, side * (halfWidthAt(markerSection, 0.68) + 0.004)); body.add(marker);
  }
  // the dark C-pillar vents on top of each buttress (rear photo from above)
  for (const side of [-1, 1]) {
    const points: THREE.Vector3[] = [];
    for (let x = -0.95; x >= -1.45; x -= 0.05) { const s = crossSection(x), z = s.points[8][0] - 0.07; points.push(new THREE.Vector3(x, topHeightAt(s, z) + 0.004, side * z)); }
    body.add(tube(points, 20, 0.028, 6, carbonMaterial));
  }
  // door cut line
  const doorSection = crossSection(0.3);
  for (const side of [1, -1]) {
    const points = [5, 6, 7].map(k => new THREE.Vector3(0.3 - (k - 5) * 0.05, doorSection.points[k][1], side * (doorSection.points[k][0] + 0.003)));
    body.add(tube(points, 12, 0.004, 4, blackMaterial));
  }
}

// ---------- the wing ----------
// Actuated as in Tesla's Track Mode video: a polished titanium plane whose tips turn down into endplates, on black
// uprights. Road = stowed on the deck, High-Downforce = raised and pitched, Low-Drag = raised and flat.
export const WING_MODE_NAMES = ["Road", "High-Downforce", "Low-Drag"] as const;

export interface WingRig {
  group: THREE.Group;
  plane: THREE.Group;
  tips: THREE.Group[];
  posts: THREE.Mesh[];
  mode: WingMode;
  raised: number;   // 0 stowed .. 1 up, eased toward the mode
  pitch: number;    // eased plane angle (rad)
}

export const wing: WingRig = (() => {
  const group = new THREE.Group();
  const titanium = new THREE.MeshPhysicalMaterial({ color: 0xcfc4b8, metalness: 1, roughness: 0.22, clearcoat: 0.6 });
  const plane = new THREE.Group(); plane.position.set(TAIL_X + 0.22, 0, 0); group.add(plane);
  plane.add(box(0.38, 0.018, 1.62, titanium));
  const tips = [-1, 1].map(side => {
    const tip = new THREE.Group(); tip.position.set(0, 0, side * 0.81); plane.add(tip);
    const curl = box(0.38, 0.018, 0.16, titanium); curl.position.set(0, -0.03, side * 0.07); curl.rotation.x = side * 0.45; tip.add(curl);
    const endplate = box(0.34, 0.19, 0.01, titanium); endplate.position.set(0, -0.14, side * 0.14); endplate.rotation.x = side * -0.25; tip.add(endplate);
    return tip;
  });
  const posts = [-0.42, 0.42].map(z => { const post = box(0.06, 1, 0.024, carbonMaterial); post.position.set(TAIL_X + 0.3, 0, z); group.add(post); return post; });
  body.add(group);
  return { group, plane, tips, posts, mode: 1, raised: 1, pitch: -0.2 };
})();

/** Ease the wing toward its mode: raise or stow, and pitch. */
export function animateWing(dt: number) {
  const ease = Math.min(1, dt * 3);
  wing.raised += ((wing.mode === 0 ? 0 : 1) - wing.raised) * ease;
  wing.pitch += ((wing.mode === 1 ? -0.2 : 0) - wing.pitch) * ease;
  const y = 0.88 + (1.16 - 0.88) * wing.raised, up = wing.raised > 0.05;
  wing.plane.position.y = y;
  wing.plane.rotation.z = wing.pitch * wing.raised;
  for (const tip of wing.tips) { tip.scale.y = Math.max(0.01, wing.raised); tip.visible = up; }
  for (const post of wing.posts) { const h = Math.max(0.01, y - 0.93); post.scale.y = h; post.position.y = 0.93 + h / 2; post.visible = up; }
}

// ---------- nozzles ----------
export interface NozzleVisual {
  object: THREE.Group;                         // the nozzle; its -y axis points along the exhaust
  glowMaterial: THREE.MeshStandardMaterial;    // lights up with thrust
}

/** One per entry of NOZZLE_MOUNTS, in the same order. */
export const nozzleVisuals: NozzleVisual[] = (() => {
  const shell = new THREE.CylinderGeometry(0.046, 0.058, 0.09, 18, 1, true);
  const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x3b4150, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide });
  const ring = new THREE.TorusGeometry(0.05, 0.01, 8, 28);
  return NOZZLE_MOUNTS.map(({ at, direction, group }) => {
    const object = new THREE.Group();
    object.position.copy(at);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().negate());
    const tail = group === "rear";
    const glowMaterial = new THREE.MeshStandardMaterial({ color: tail ? 0x6b4a22 : 0x0a0c10, metalness: tail ? 1 : 0, roughness: 0.3, emissive: 0x9fdcff, emissiveIntensity: 0 });
    const throat = new THREE.Mesh(new THREE.CircleGeometry(0.044, 18).rotateX(Math.PI / 2), glowMaterial);
    throat.position.y = -0.03;
    object.add(new THREE.Mesh(shell, shellMaterial), throat);
    if (tail) { const trim = new THREE.Mesh(ring, chromeMaterial); trim.rotation.x = Math.PI / 2; trim.position.y = -0.045; object.add(trim); }
    body.add(object);
    return { object, glowMaterial };
  });
})();

// ---------- wheels ----------
export interface WheelVisual {
  group: THREE.Group;    // moves with the suspension
  spinner: THREE.Group;  // rotates with the wheel
  side: number;          // +1 left, -1 right
  angle: number;
}

/** Rear left, rear right, front left, front right: the same order as the physics wheels. */
export const wheelVisuals: WheelVisual[] = (() => {
  // wide tyres, white aero discs with six black spokes, as in the wheel close-up
  const profile = [[0.27, -0.17], [0.35, -0.172], [0.364, -0.145], [0.37, 0], [0.364, 0.145], [0.35, 0.172], [0.27, 0.17]].map(([r, y]) => new THREE.Vector2(r, y));
  const tyre = new THREE.LatheGeometry(profile, 60).rotateX(Math.PI / 2);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.88 });
  const discMaterial = new THREE.MeshPhysicalMaterial({ color: 0xdfe1e4, metalness: 0.55, roughness: 0.28, clearcoat: 1 });
  const spokeMaterial = new THREE.MeshPhysicalMaterial({ color: 0x08090b, metalness: 0.4, roughness: 0.25, clearcoat: 1 });
  const brakeMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4e56, metalness: 0.8, roughness: 0.45 });
  const cylinder = (r: number, depth: number, segments: number, open = false) => new THREE.CylinderGeometry(r, r, depth, segments, 1, open).rotateX(Math.PI / 2);
  const polar = (r: number, a: number) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  const visuals: WheelVisual[] = [];
  for (const axleX of AXLE_X) for (const side of [1, -1]) {
    const group = new THREE.Group(), spinner = new THREE.Group();
    group.add(spinner);
    spinner.add(new THREE.Mesh(tyre, rubber));
    spinner.add(new THREE.Mesh(cylinder(0.268, 0.32, 40, true), blackMaterial));
    const disc = new THREE.Mesh(cylinder(0.265, 0.02, 56), discMaterial); disc.position.z = 0.14; spinner.add(disc);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([polar(0.05, a - 0.4), polar(0.05, a + 0.4), polar(0.255, a + 0.15), polar(0.255, a - 0.07)])), spokeMaterial);
      spoke.position.z = 0.152; spinner.add(spoke);
    }
    const hub = new THREE.Mesh(cylinder(0.045, 0.03, 20), spokeMaterial); hub.position.z = 0.155; spinner.add(hub);
    const brake = new THREE.Mesh(cylinder(0.21, 0.026, 36), brakeMaterial); brake.position.z = 0.04; group.add(brake);
    group.position.set(axleX, WHEEL_RADIUS - COM_HEIGHT, side * HALF_TRACK);
    if (side < 0) group.rotation.y = Math.PI;   // the right-hand wheels face outward too
    car.add(group);
    visuals.push({ group, spinner, side, angle: 0 });
  }
  return visuals;
})();

enableShadows(car);
