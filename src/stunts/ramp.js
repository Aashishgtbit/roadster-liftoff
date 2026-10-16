// The curved ramp, its LED edges, truss and its own floodlight.
import * as THREE from "three";
import { RAMP } from "../config.js";
import { scene } from "../core/renderer.js";

const rampGroup = new THREE.Group(); rampGroup.visible = false; scene.add(rampGroup);
{
  const { cx, R, thMax } = RAMP, W = RAMP.hw * 2 + 0.2, NT = 120, NZ = 6;
  const tex = (() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 512; const x = c.getContext("2d");
    x.fillStyle = "#d9dbde"; x.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 5000; i++) { const v = 190 + Math.random() * 50 | 0; x.fillStyle = `rgba(${v},${v},${v + 3},0.5)`; x.fillRect(Math.random() * 256, Math.random() * 512, 1.5, 1.5); }
    x.fillStyle = "#8d9299"; x.fillRect(120, 0, 16, 512);                         // centre stripe, as in the video
    x.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 0; y < 512; y += 128) x.fillRect(0, y, 256, 2);   // panel seams
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  tex.repeat.set(1, R * thMax / 8);
  const at = (th, off) => [cx + (R + off) * Math.sin(th), R - (R + off) * Math.cos(th)];
  function sheet(off, inward) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NT; i++) { const th = thMax * i / NT, [x, y] = at(th, off); for (let j = 0; j <= NZ; j++) { pos.push(x, y, -W / 2 + W * j / NZ); uv.push(j / NZ, i / NT); } }
    for (let i = 0; i < NT; i++) for (let j = 0; j < NZ; j++) {
      const a = i * (NZ + 1) + j, b = a + 1, c = a + NZ + 1, d = c + 1;
      if (inward) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const steel = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.7, roughness: 0.45 });
  rampGroup.add(new THREE.Mesh(sheet(0, true), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62 })));
  rampGroup.add(new THREE.Mesh(sheet(0.22, false), steel));
  for (const s of [-1, 1]) {   // side plates between the running surface and the back
    const pos = [], idx = [];
    for (let i = 0; i <= NT; i++) { const th = thMax * i / NT; for (const off of [0, 0.22]) { const [x, y] = at(th, off); pos.push(x, y, s * W / 2); } }
    for (let i = 0; i < NT; i++) { const a = i * 2; s > 0 ? idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) : idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    rampGroup.add(new THREE.Mesh(g, steel));
    // red LED strip along each edge of the running surface
    const pts = []; for (let i = 0; i <= 80; i++) { const [x, y] = at(thMax * i / 80, -0.03); pts.push(new THREE.Vector3(x, y, s * (W / 2 - 0.03))); }
    rampGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.035, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a10, emissiveIntensity: 2.6 })));
  }
  // steel truss: a tower behind the wall, posts under the lower curve, braces holding up the overhang
  const beam = (a, b, t) => {
    const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.BoxGeometry(t, d.length(), t), steel);
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); rampGroup.add(m);
  };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z), TX = cx + R + 1.4, TOP = 2 * R + 0.9;
  for (const z of [-2.6, 2.6]) {
    beam(V3(TX, 0, z), V3(TX, TOP, z), 0.28); beam(V3(TX + 1.6, 0, z), V3(TX + 1.6, TOP - 1.5, z), 0.24);
    for (let y = 1.5; y < TOP - 1; y += 1.8) { beam(V3(TX, y, z), V3(TX + 1.6, y, z), 0.12); beam(V3(TX, y, z), V3(TX + 1.6, y + 1.8, z), 0.08); }
    for (let th = 0.2 * Math.PI; th <= 0.5 * Math.PI + 1e-6; th += 0.1 * Math.PI) { const [x, y] = at(th, 0.24); beam(V3(x, 0, z), V3(x, y, z), 0.14); beam(V3(x, y, z), V3(TX, Math.min(TOP, y + 1.2), z), 0.1); }
    for (let th = 0.6 * Math.PI; th <= thMax + 1e-6; th += 0.1 * Math.PI) { const [x, y] = at(th, 0.24); beam(V3(x, y, z), V3(TX, TOP, z), 0.12); }
  }
  for (let y = 2; y < TOP; y += 2.4) beam(V3(TX, y, -2.6), V3(TX, y, 2.6), 0.12);
  beam(V3(TX, TOP, -2.6), V3(TX, TOP, 2.6), 0.2);
  // red light lines on the ground in front of the ramp, as in the footage
  const led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2414, emissiveIntensity: 2 });
  for (const z of [-3.4, 3.4]) { const s = new THREE.Mesh(new THREE.BoxGeometry(16, 0.04, 0.07), led); s.position.set(cx - 8, 0.03, z); rampGroup.add(s); }
  rampGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const spot = new THREE.SpotLight(0xf1f5ff, 1700, 0, 0.55, 0.6, 2);
  spot.position.set(cx - 10, 19, 17); spot.target.position.set(cx + 2.5, 6.5, 0);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.camera.near = 4; spot.shadow.camera.far = 60; spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.03;
  rampGroup.add(spot, spot.target);
}

export { rampGroup };
