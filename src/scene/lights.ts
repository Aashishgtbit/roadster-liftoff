// Floodlight towers, moonlight and ambient light.
import * as THREE from "three";
import { isSmallScreen } from "../ui/dom";
import { scene } from "../core/renderer";
import { addOccluder } from "../core/occluders";

scene.add(new THREE.HemisphereLight(0x3a4c80, 0x0b0b10, 0.55));
const moon = new THREE.DirectionalLight(0xa9bcff, 0.35);
moon.position.set(-40, 60, -30);
scene.add(moon);

const towerMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4152, roughness: 0.6, metalness: 0.6 });
const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xeef4ff, emissiveIntensity: 7 });

/** A 16 m floodlight tower at (x, z), aimed at (aimX, 0, 0). */
function floodlightTower(x: number, z: number, aimX: number, power: number) {
  const height = 16;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, height, 10), towerMaterial);
  pole.position.set(x, height / 2, z); scene.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.3), lampMaterial);
  head.position.set(x, height + 0.3, z); head.lookAt(aimX, 0, 0); scene.add(head);
  addOccluder([pole, head], x, z, 0.9);
  const spot = new THREE.SpotLight(0xf1f5ff, power, 0, 0.62, 0.65, 2);
  spot.position.set(x, height + 0.2, z); spot.target.position.set(aimX, 0, 0);
  const shadowSize = isSmallScreen() ? 1024 : 2048;
  spot.castShadow = true; spot.shadow.mapSize.set(shadowSize, shadowSize);
  spot.shadow.camera.near = 4; spot.shadow.camera.far = 80; spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.03;
  scene.add(spot, spot.target);
}
floodlightTower(-13, 17, -2, 1500);
floodlightTower(16, 19, 16, 1500);
floodlightTower(26, -17, 8, 1100);
