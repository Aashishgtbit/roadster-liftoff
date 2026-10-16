// Sky, stars, asphalt, track markings and cones.
import * as THREE from "three";
import { scene } from "../core/renderer.js";

/* ---------- sky and stars ---------- */
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x03050b) }, mid: { value: new THREE.Color(0x0b1226) }, hor: { value: new THREE.Color(0x1f2a4a) } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: "uniform vec3 top, mid, hor; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(hor, mid, smoothstep(0.0, 0.12, h)); c = mix(c, top, smoothstep(0.12, 0.6, h)); gl_FragColor = vec4(c, 1.); }"
  }));
  scene.add(sky);
  const n = 1600, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2, v = 0.08 + Math.random() * 0.9, r = 560;
    p[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r; p[i * 3 + 1] = v * r; p[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
}

/* ---------- ground, track markings, cones ---------- */
function asphaltTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d"); x.fillStyle = "#2a2c31"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 40 | 0; x.fillStyle = `rgba(${v},${v + 2},${v + 6},${0.35 + Math.random() * 0.5})`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(140, 140); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: asphaltTexture(), color: 0x9aa1ad, roughness: 0.93 }));
ground.receiveShadow = true; scene.add(ground);
{
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(7, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.85 }));
  pad.position.set(-9.5, 0.004, 0); pad.receiveShadow = true; scene.add(pad);
  const paint = new THREE.MeshStandardMaterial({ color: 0xd9dde4, roughness: 0.7 });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 6).rotateX(-Math.PI / 2), paint); line.position.set(-6.2, 0.008, 0); scene.add(line);
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.8, 0.14).rotateX(-Math.PI / 2), paint, 60);
  const m = new THREE.Matrix4(); let k = 0;
  for (let xx = -40; xx < 56 && k < 60; xx += 3.4) for (const z of [-3.6, 3.6]) { if (k >= 60) break; m.makeTranslation(xx, 0.006, z); dash.setMatrixAt(k++, m); }
  dash.count = k; dash.receiveShadow = true; scene.add(dash);
  const coneGeo = new THREE.ConeGeometry(0.16, 0.5, 18).translate(0, 0.25, 0);
  const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshStandardMaterial({ color: 0xff5a14, roughness: 0.55 }), 40);
  k = 0; for (let xx = -22; xx <= 36 && k < 40; xx += 3) for (const z of [-4.6, 4.6]) { if (k >= 40) break; m.makeTranslation(xx, 0, z); cones.setMatrixAt(k++, m); }
  cones.count = k; cones.castShadow = true; scene.add(cones);
}
