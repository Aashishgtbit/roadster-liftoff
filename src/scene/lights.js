// Floodlight towers, moonlight and ambient light.
import * as THREE from "three";
import { small } from "../ui/dom.js";
import { scene } from "../core/renderer.js";

/* ---------- lights: three floodlight towers, moon, hemisphere ---------- */
scene.add(new THREE.HemisphereLight(0x3a4c80, 0x0b0b10, 0.55));
{ const moon = new THREE.DirectionalLight(0xa9bcff, 0.35); moon.position.set(-40, 60, -30); scene.add(moon); }
const towerMat = new THREE.MeshStandardMaterial({ color: 0x3a4152, roughness: 0.6, metalness: 0.6 });
const lampMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xeef4ff, emissiveIntensity: 7 });
function tower(x, z, tx, power) {
  const h = 16;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, h, 10), towerMat); pole.position.set(x, h / 2, z); scene.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.3), lampMat); head.position.set(x, h + 0.3, z); head.lookAt(tx, 0, 0); scene.add(head);
  const s = new THREE.SpotLight(0xf1f5ff, power, 0, 0.62, 0.65, 2);
  s.position.set(x, h + 0.2, z); s.target.position.set(tx, 0, 0);
  s.castShadow = true; s.shadow.mapSize.set(small() ? 1024 : 2048, small() ? 1024 : 2048);
  s.shadow.camera.near = 4; s.shadow.camera.far = 80; s.shadow.bias = -0.0003; s.shadow.normalBias = 0.03;
  scene.add(s, s.target);
}
tower(-13, 17, -2, 1500);
tower(16, 19, 16, 1500);
tower(26, -17, 8, 1100);
