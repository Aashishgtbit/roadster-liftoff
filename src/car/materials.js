// Paint, glass, carbon, chrome and light materials for the car.
import * as THREE from "three";

const PAINT = new THREE.Color("#dfe2e6"), UNDER = new THREE.Color("#0b0c0f");
const paintMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.4, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 });
const paintSolid = new THREE.MeshPhysicalMaterial({ color: PAINT, metalness: 0.4, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 });
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x150d06, metalness: 0.1, roughness: 0.08, clearcoat: 0.4, clearcoatRoughness: 0.03, envMapIntensity: 0.55 });
const darkGlass = new THREE.MeshPhysicalMaterial({ color: 0x05070b, metalness: 0.1, roughness: 0.05, clearcoat: 1, envMapIntensity: 2 });
const carbonMat = new THREE.MeshPhysicalMaterial({ color: 0x0d0e11, metalness: 0.3, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.12 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.7 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, metalness: 1, roughness: 0.15 });
const frontLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 5 });
const rearLightMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0a04, emissiveIntensity: 1.7 });

export { PAINT, UNDER, blackMat, carbonMat, chromeMat, darkGlass, frontLightMat, glassMat, paintMat, paintSolid, rearLightMat };
