// The parked lineup for the jump, as in the demo: two sedans, a Semi cab, a Cybertruck and a Cybercab.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { enableShadows, scene } from "../core/renderer";
import { blackMaterial, darkGlassMaterial } from "../car/materials";
import { LINEUP } from "./lineup-layout";

export const lineup = new THREE.Group();
scene.add(lineup);

const tyreMaterial = new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.85 });
const carPaint = (color: THREE.ColorRepresentation) => new THREE.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.33, clearcoat: 1, clearcoatRoughness: 0.06 });
const rounded = (w: number, h: number, d: number, radius: number, material: THREE.Material, segments = 5) =>
  new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segments, radius), material);

function addWheels(vehicle: THREE.Group, radius: number, width: number, xs: number[], zs: number[]) {
  const geometry = new THREE.CylinderGeometry(radius, radius, width, 28).rotateX(Math.PI / 2);
  for (const x of xs) for (const z of zs) { const tyre = new THREE.Mesh(geometry, tyreMaterial); tyre.position.set(x, radius, z); vehicle.add(tyre); }
}

/** Park a vehicle (modelled along x) across the course at (x, z). */
function park(vehicle: THREE.Group, x: number, z: number) {
  vehicle.rotation.y = Math.PI / 2;
  vehicle.position.set(x, 0, z);
  enableShadows(vehicle);
  lineup.add(vehicle);
}

function sedan(color: THREE.ColorRepresentation, x: number, z: number) {
  const vehicle = new THREE.Group();
  const lower = rounded(4.75, 0.8, 1.9, 0.28, carPaint(color)); lower.position.y = 0.7; vehicle.add(lower);
  const cabin = rounded(2.6, 0.62, 1.66, 0.28, darkGlassMaterial); cabin.position.set(-0.25, 1.32, 0); vehicle.add(cabin);
  addWheels(vehicle, 0.35, 0.25, [-1.45, 1.45], [-0.83, 0.83]);
  park(vehicle, x, z);
}

function semiCab(x: number, z: number) {
  const vehicle = new THREE.Group();
  const cab = rounded(4.3, 3.0, 2.5, 0.4, carPaint(0xe8e9ec)); cab.position.y = 2.05; vehicle.add(cab);
  const windshield = rounded(0.1, 1.0, 2.2, 0.04, darkGlassMaterial, 3); windshield.position.set(2.12, 2.75, 0); vehicle.add(windshield);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.4, 2.3), blackMaterial); skirt.position.y = 0.55; vehicle.add(skirt);
  addWheels(vehicle, 0.52, 0.32, [-1.5, -0.3, 1.5], [-1.03, 1.03]);
  park(vehicle, x, z);
}

function cybertruck(x: number, z: number) {
  const vehicle = new THREE.Group();
  const profile = new THREE.Shape();
  profile.moveTo(-2.85, 0.5); profile.lineTo(2.85, 0.5); profile.lineTo(2.85, 1.12); profile.lineTo(0.25, 1.92); profile.lineTo(-2.85, 1.28); profile.closePath();
  const shell = new THREE.ExtrudeGeometry(profile, { depth: 2.0, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }).translate(0, 0, -1.0);
  vehicle.add(new THREE.Mesh(shell, new THREE.MeshPhysicalMaterial({ color: 0xb9bdc3, metalness: 1, roughness: 0.36 })));
  const windowShape = new THREE.Shape();
  windowShape.moveTo(-1.0, 1.36); windowShape.lineTo(1.3, 1.36); windowShape.lineTo(0.25, 1.86); windowShape.lineTo(-1.0, 1.6); windowShape.closePath();
  const windowMaterial = darkGlassMaterial.clone(); windowMaterial.side = THREE.DoubleSide;
  for (const side of [-1, 1]) { const pane = new THREE.Mesh(new THREE.ShapeGeometry(windowShape), windowMaterial); pane.position.z = side * 1.025; vehicle.add(pane); }
  addWheels(vehicle, 0.45, 0.3, [-1.9, 1.9], [-0.9, 0.9]);
  park(vehicle, x, z);
}

function cybercab(x: number, z: number) {
  const vehicle = new THREE.Group();
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xb8985c, metalness: 0.8, roughness: 0.3, clearcoat: 1 });
  const lower = rounded(3.9, 0.82, 1.92, 0.32, gold); lower.position.y = 0.66; vehicle.add(lower);
  const cabin = rounded(2.1, 0.55, 1.64, 0.27, darkGlassMaterial); cabin.position.set(-0.15, 1.26, 0); vehicle.add(cabin);
  addWheels(vehicle, 0.36, 0.25, [-1.3, 1.3], [-0.84, 0.84]);
  park(vehicle, x, z);
}

// the models, in the order and places of LINEUP (their sizes match its boxes)
const [whiteSedan, redSedan, semi, truck, cab] = LINEUP;
sedan(0xe9eaed, whiteSedan.x, whiteSedan.z);
sedan(0x8e1410, redSedan.x, redSedan.z);
semiCab(semi.x, semi.z);
cybertruck(truck.x, truck.z);
cybercab(cab.x, cab.z);

// red LED strips along the far side of the course, as in the footage
{
  const led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2414, emissiveIntensity: 4 });
  for (const x of [-16, -2, 12, 26]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(11, 0.05, 0.08), led); strip.position.set(x, 0.03, -7.5); scene.add(strip); }
}
