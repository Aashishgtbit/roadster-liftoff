// The parked lineup for the jump: two sedans, a Semi cab, a Cybertruck and a Cybercab.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { scene } from "../core/renderer.js";
import { blackMat, darkGlass } from "../car/materials.js";

/* ---------- the lineup from the demo: two sedans, a Semi cab, a Cybertruck, a Cybercab ---------- */
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.85 });
function wheelsAt(g, r, w, xs, zs) { const tg = new THREE.CylinderGeometry(r, r, w, 28).rotateX(Math.PI / 2); for (const wx of xs) for (const wz of zs) { const m = new THREE.Mesh(tg, tireMat); m.position.set(wx, r, wz); g.add(m); } }
const lineup = new THREE.Group(); scene.add(lineup);
function place(g, x, z) { g.rotation.y = Math.PI / 2; g.position.set(x, 0, z); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); lineup.add(g); }
const carPaint = c => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.45, roughness: 0.33, clearcoat: 1, clearcoatRoughness: 0.06 });
function sedan(color, x, z) {
  const g = new THREE.Group(), paint = carPaint(color);
  const lower = new THREE.Mesh(new RoundedBoxGeometry(4.75, 0.8, 1.9, 5, 0.28), paint); lower.position.y = 0.7; g.add(lower);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.62, 1.66, 5, 0.28), darkGlass); cab.position.set(-0.25, 1.32, 0); g.add(cab);
  wheelsAt(g, 0.35, 0.25, [-1.45, 1.45], [-0.83, 0.83]); place(g, x, z);
}
function semiCab(x, z) {
  const g = new THREE.Group(), paint = carPaint(0xe8e9ec);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(4.3, 3.0, 2.5, 5, 0.4), paint); cab.position.y = 2.05; g.add(cab);
  const ws = new THREE.Mesh(new RoundedBoxGeometry(0.1, 1.0, 2.2, 3, 0.04), darkGlass); ws.position.set(2.12, 2.75, 0); g.add(ws);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.4, 2.3), blackMat); skirt.position.y = 0.55; g.add(skirt);
  wheelsAt(g, 0.52, 0.32, [-1.5, -0.3, 1.5], [-1.03, 1.03]); place(g, x, z);
}
function cybertruck(x, z) {
  const g = new THREE.Group();
  const sh = new THREE.Shape(); sh.moveTo(-2.85, 0.5); sh.lineTo(2.85, 0.5); sh.lineTo(2.85, 1.12); sh.lineTo(0.25, 1.92); sh.lineTo(-2.85, 1.28); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 2.0, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }).translate(0, 0, -1.0);
  g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xb9bdc3, metalness: 1, roughness: 0.36 })));
  const win = new THREE.Shape(); win.moveTo(-1.0, 1.36); win.lineTo(1.3, 1.36); win.lineTo(0.25, 1.86); win.lineTo(-1.0, 1.6); win.closePath();
  const winMat = darkGlass.clone(); winMat.side = THREE.DoubleSide;
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ShapeGeometry(win), winMat); w.position.z = s * 1.025; g.add(w); }
  wheelsAt(g, 0.45, 0.3, [-1.9, 1.9], [-0.9, 0.9]); place(g, x, z);
}
function cybercab(x, z) {
  const g = new THREE.Group(), paint = new THREE.MeshPhysicalMaterial({ color: 0xb8985c, metalness: 0.8, roughness: 0.3, clearcoat: 1 });
  const lower = new THREE.Mesh(new RoundedBoxGeometry(3.9, 0.82, 1.92, 5, 0.32), paint); lower.position.y = 0.66; g.add(lower);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.55, 1.64, 5, 0.27), darkGlass); cab.position.set(-0.15, 1.26, 0); g.add(cab);
  wheelsAt(g, 0.36, 0.25, [-1.3, 1.3], [-0.84, 0.84]); place(g, x, z);
}
sedan(0xe9eaed, -1.5, 0.2); sedan(0x8e1410, 1.6, -0.3); semiCab(4.9, 0.4); cybertruck(8.3, -0.2); cybercab(11.2, 0.1);
// red LED strips along the far side of the course, as in the footage
{
  const m = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2414, emissiveIntensity: 4 });
  for (const x of [-16, -2, 12, 26]) { const s = new THREE.Mesh(new THREE.BoxGeometry(11, 0.05, 0.08), m); s.position.set(x, 0.03, -7.5); scene.add(s); }
}

export { lineup };
