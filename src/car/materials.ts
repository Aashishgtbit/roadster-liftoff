// Paint, glass, carbon, chrome and light materials for the car (and the parked lineup's glass).
import * as THREE from "three";

export const PAINT_COLOR = new THREE.Color("#dfe2e6");
export const UNDERBODY_COLOR = new THREE.Color("#0b0c0f");
/** Body paint, coloured per vertex so the black lower body and the white upper body share one mesh. */
export const paintMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.4, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 });
export const solidPaintMaterial = new THREE.MeshPhysicalMaterial({ color: PAINT_COLOR, metalness: 0.4, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 });
export const bronzeGlassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x150d06, metalness: 0.1, roughness: 0.08, clearcoat: 0.4, clearcoatRoughness: 0.03, envMapIntensity: 0.55 });
export const darkGlassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x05070b, metalness: 0.1, roughness: 0.05, clearcoat: 1, envMapIntensity: 2 });
export const carbonMaterial = new THREE.MeshPhysicalMaterial({ color: 0x0d0e11, metalness: 0.3, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.12 });
export const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.7 });
export const chromeMaterial = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, metalness: 1, roughness: 0.15 });
export const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 5 });
export const tailLightMaterial = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0a04, emissiveIntensity: 1.7 });
