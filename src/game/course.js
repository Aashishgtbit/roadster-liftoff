// Drive it: the course — random obstacle layouts, barriers, grandstands, finish arch and course lights.
import * as THREE from "three";
import { BARRIERS, FENCE_TOP, FINISH_X, RUNOFF, TRACK_HW } from "../config.js";
import { scene } from "../core/renderer.js";
import { body } from "../car/roadster.js";
import { st } from "../run/runner.js";

/* ---------- "Drive it": the player takes the wheel. Bust crates or fly over them, fly over walls, collect fuel ---------- */
// Every run gets a new random layout (or retry the same one). Kicker ramps launch the car without fuel. Hitting a wall
// above 35 km/h is a crash; three crashes wreck the car. Best time and score are remembered in this browser.
const CRASH_SPEED = 9.7, MAX_CRASHES = 3;
const $ = id => document.getElementById(id);
const gameUI = $("gameUI"), gameToast = $("gameToast"), gameOver = $("gameOver");
const gameSpeed = $("gameSpeed"), fuelBar = $("fuelBar"), fuelNum = $("fuelNum"), gameScore = $("gameScore"), gameLeft = $("gameLeft"), gameTime = $("gameTime"), gameBest = $("gameBest"), gameCourse = $("gameCourse"), gameDamage = $("gameDamage");
const goTitle = $("goTitle"), goScore = $("goScore"), goTime = $("goTime"), goBusts = $("goBusts"), goCans = $("goCans"), goBest = $("goBest"), goNew = $("goNew");
const course = new THREE.Group(); course.visible = false; scene.add(course);
const obstacles = new THREE.Group(); course.add(obstacles);
const game = { boxes: [], cans: [], debris: [], seed: 0, started: false, over: false, t: 0, busts: 0, cansGot: 0, crashes: 0, best: 0, toastT: 0, shake: 0 };
const store = { get() { try { return JSON.parse(localStorage.getItem("roadster-best") || "{}"); } catch { return {}; } },
                set(v) { try { localStorage.setItem("roadster-best", JSON.stringify(v)); } catch { /* private window: keep it for this visit only */ } } };
let bestRec = store.get();
const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const MAT = (() => {
  const crate = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = "#b9803f"; x.fillRect(0, 0, w, h); x.strokeStyle = "#6e4519"; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10);
    x.lineWidth = 8; x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, h - 8); x.stroke();
    x.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 24; y < h; y += 24) x.fillRect(10, y, w - 20, 2);
  });
  const stripes = (a, b) => canvasTex(256, 64, (x, w, h) => { x.fillStyle = a; x.fillRect(0, 0, w, h); x.fillStyle = b; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, h); x.lineTo(i * 32 + 48, 0); x.lineTo(i * 32 + 32, 0); x.fill(); } });
  const wall = stripes("#e9ebee", "#d42a1f"); wall.wrapS = THREE.RepeatWrapping; wall.repeat.set(4, 1);
  const ramp = stripes("#1d2128", "#f2c230"); ramp.wrapS = ramp.wrapT = THREE.RepeatWrapping; ramp.repeat.set(1, 3);
  return {
    crate: new THREE.MeshStandardMaterial({ map: crate, roughness: 0.85 }), crateGeo: new THREE.BoxGeometry(1.2, 1.2, 1.2),
    wall: new THREE.MeshStandardMaterial({ map: wall, roughness: 0.7 }),
    rampTop: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.8 }), rampSide: new THREE.MeshStandardMaterial({ map: ramp, roughness: 0.7 }),
    can: new THREE.MeshStandardMaterial({ color: 0x0b2a33, emissive: 0x57d9ff, emissiveIntensity: 2.4, metalness: 0.4, roughness: 0.3 }),
    ring: new THREE.MeshStandardMaterial({ color: 0xdde4ee, metalness: 1, roughness: 0.2 }),
  };
})();
function buildCourse(seed) {
  for (const o of [...obstacles.children]) { obstacles.remove(o); o.traverse(m => { if (m.isMesh && m.geometry !== MAT.crateGeo) m.geometry.dispose(); }); }
  game.boxes = []; game.cans = []; game.seed = seed;
  let s = seed; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const can = (x, y, z) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.72, 20), MAT.can));
    for (const yy of [-0.3, 0.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 8, 24), MAT.ring); r.rotation.x = Math.PI / 2; r.position.y = yy; g.add(r); }
    obstacles.add(g); game.cans.push({ g, x, y, z, got: false });
  };
  const crates = (x, n, z0) => {
    const g = new THREE.Group(); g.position.set(x, 0, 0);
    for (let row = 0; row < 2; row++) for (let k = 0; k < n; k++) { const m = new THREE.Mesh(MAT.crateGeo, MAT.crate); m.position.set(0.6, 0.6 + row * 1.2, z0 + 0.6 + k * 1.2); m.rotation.y = (R() - 0.5) * 0.08; m.castShadow = m.receiveShadow = true; g.add(m); }
    obstacles.add(g); game.boxes.push({ id: "crates@" + x.toFixed(0), kind: "crates", g, x0: x, x1: x + 1.2, y0: 0, y1: 2.4, z0, z1: z0 + n * 1.2, bust: true });
  };
  const wall = x => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 16), MAT.wall); m.position.set(x + 0.5, 1.2, 0); m.castShadow = m.receiveShadow = true;
    obstacles.add(m); game.boxes.push({ id: "wall@" + x.toFixed(0), kind: "wall", g: m, x0: x, x1: x + 1, y0: 0, y1: 2.4, z0: -8, z1: 8 });
  };
  const ramp = (x, L, h, w) => {   // a wedge: sloped top, striped sides, open back
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L, 0), new THREE.Vector2(L, h)]);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: w * 2, bevelEnabled: false }).translate(0, 0, -w);
    const m = new THREE.Mesh(geo, [MAT.rampSide, MAT.rampTop]); m.position.set(x, 0, 0); m.castShadow = m.receiveShadow = true;
    obstacles.add(m); game.boxes.push({ id: "ramp@" + x.toFixed(0), kind: "ramp", ramp: true, g: m, x0: x, x1: x + L, h, z0: -w, z1: w });
  };
  let x = 34, first = true;
  while (x < FINISH_X - 30) {
    let r = R(); if (first && r >= 0.66 && r < 0.86) r = 0.5; first = false;   // never open with a ramp-wall: no run-up yet
    if (r < 0.38) {                     // crate stack, sometimes off-centre so you can choose to dodge it
      const n = 5 + Math.floor(R() * 3), z0 = -n * 0.6 + (R() - 0.5) * 3;
      crates(x, n, z0); can(x + 5, 0.95, z0 + n * 0.6); x += 26 + R() * 10;
    } else if (r < 0.66) {              // wall: fly over it; a fuel can floats above it
      wall(x); can(x + 0.5, 4.3, (R() - 0.5) * 2); x += 34 + R() * 8;
    } else if (r < 0.86) {              // kicker ramp straight into a wall: launch over it with no fuel
      ramp(x, 7, 1.8, 3.2); wall(x + 16); can(x + 16.5, 4.6, 0); x += 46 + R() * 8;
    } else {                            // kicker ramp with a can high in the air ahead
      ramp(x, 6, 1.1, 3); can(x + 16, 3.6, 0); x += 34 + R() * 8;
    }
    if (x < FINISH_X - 20) can(x - 10, 0.95, (R() - 0.5) * 4);
  }
  game.boxes.push(...BARRIERS);
  st.boxes = game.boxes;
  gameCourse.textContent = "#" + seed % 10000;
}
// the track is boxed in: concrete barriers with catch fences down both sides and across both ends (see config.js)
{
  const concrete = canvasTex(512, 64, (x, w, h) => {
    x.fillStyle = "#b9bdc4"; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { const v = 150 + Math.random() * 60 | 0; x.fillStyle = `rgba(${v},${v},${v + 4},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#e9ebee" : "#d42a1f"; x.fillRect(i * 64, 0, 64, 12); }
    x.fillStyle = "rgba(0,0,0,.25)"; for (let i = 0; i <= 8; i++) x.fillRect(i * 64, 0, 2, h);
  });
  concrete.wrapS = THREE.RepeatWrapping;
  const L = FINISH_X + RUNOFF + 40, led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2414, emissiveIntensity: 2.2 });
  for (const s of [-1, 1]) {
    const t = concrete.clone(); t.needsUpdate = true; t.repeat.set(L / 8, 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, 1.05, 0.8), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
    m.position.set(-40 + L / 2, 0.525, s * (TRACK_HW + 0.4)); m.castShadow = m.receiveShadow = true; course.add(m);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, 0.05), led); strip.position.set(-40 + L / 2, 0.86, s * (TRACK_HW - 0.02)); course.add(strip);
  }
  for (const x of [-40.5, FINISH_X + RUNOFF + 0.5]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 2 * TRACK_HW + 1.6), MAT.wall); m.position.set(x, 1.1, 0); m.castShadow = m.receiveShadow = true; course.add(m);
  }
  // catch fences: wire mesh on posts, up to the same height the physics uses, so what you see is what stops you
  const wire = canvasTex(128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = "rgba(205,214,228,0.85)"; x.lineWidth = 2.2;
    for (let k = -w; k < w * 2; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + h, h); x.stroke(); x.beginPath(); x.moveTo(k + h, 0); x.lineTo(k, h); x.stroke(); }
  });
  wire.wrapS = wire.wrapT = THREE.RepeatWrapping;
  const fenceMat = new THREE.MeshBasicMaterial({ map: wire, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.55 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.7, roughness: 0.4 });
  const fenceH = FENCE_TOP - 1.05, fenceY = 1.05 + fenceH / 2;
  const fence = (len, x, z, rotY) => {
    const t = wire.clone(); t.needsUpdate = true; t.repeat.set(len / 1.6, fenceH / 1.6);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, fenceH), fenceMat.clone()); m.material.map = t;
    m.position.set(x, fenceY, z); m.rotation.y = rotY; course.add(m);
  };
  for (const s of [-1, 1]) {
    fence(L, -40 + L / 2, s * (TRACK_HW + 0.4), 0);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, fenceH, 0.12), postMat, Math.ceil(L / 6) + 1), m4 = new THREE.Matrix4();
    for (let k = 0; k <= L / 6; k++) { m4.makeTranslation(-40 + k * 6, fenceY, s * (TRACK_HW + 0.4)); posts.setMatrixAt(k, m4); }
    course.add(posts);
  }
  for (const x of [-40.5, FINISH_X + RUNOFF + 0.5]) fence(2 * TRACK_HW + 1.6, x, 0, Math.PI / 2);
  // grandstands with crowd lights beyond the barriers, so the view never runs into empty dark
  const standMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.9 }), dots = new THREE.MeshBasicMaterial({ color: 0xffe7b8 });
  const dotGeo = new THREE.SphereGeometry(0.07, 6, 4);
  for (let x = -20; x < FINISH_X + RUNOFF; x += 48) for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(x, 0, s * 20);
    for (let k = 0; k < 5; k++) { const step = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 1.6), standMat); step.position.set(0, 0.5 + k, s * k * 1.6); step.receiveShadow = true; g.add(step); }
    const crowd = new THREE.InstancedMesh(dotGeo, dots, 60), m4 = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) { const k = i % 5; m4.makeTranslation((Math.random() - 0.5) * 28, 1.25 + k, s * k * 1.6 + (Math.random() - 0.5) * 0.6); crowd.setMatrixAt(i, m4); }
    g.add(crowd); course.add(g);
  }
}
// static parts of the course: finish arch, lane markings, cones, lamp posts
{
  const chk = canvasTex(256, 32, (c, w, h) => { for (let a = 0; a < w / 16; a++) for (let b = 0; b < 2; b++) { c.fillStyle = (a + b) % 2 ? "#111" : "#f2f2f2"; c.fillRect(a * 16, b * 16, 16, 16); } });
  const post = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.7, roughness: 0.4 });
  for (const z of [-8.5, 8.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.6, 0.35), post); p.position.set(FINISH_X, 2.8, z); course.add(p); }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(17, 1.4), new THREE.MeshStandardMaterial({ map: chk, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: chk, emissiveIntensity: 0.6 }));
  banner.position.set(FINISH_X, 5, 0); banner.rotation.y = Math.PI / 2; course.add(banner);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.8 }));
  line.position.set(FINISH_X, 0.01, 0); course.add(line);
  const paint = new THREE.MeshStandardMaterial({ color: 0xd9dde4, roughness: 0.7 }), m4 = new THREE.Matrix4();
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.8, 0.14).rotateX(-Math.PI / 2), paint, 220); let k = 0;
  for (let xx = 0; xx < FINISH_X + 20 && k < 220; xx += 3.4) for (const z of [-3.6, 3.6]) { if (k < 220) { m4.makeTranslation(xx, 0.006, z); dashes.setMatrixAt(k++, m4); } }
  dashes.count = k; course.add(dashes);
  const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.5, 14).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: 0xff5a14, roughness: 0.55 }), 80); k = 0;
  for (let xx = 0; xx < FINISH_X + 10 && k < 80; xx += 9) for (const z of [-8.6, 8.6]) { if (k < 80) { m4.makeTranslation(xx, 0, z); cones.setMatrixAt(k++, m4); } }
  cones.count = k; course.add(cones);
  const lamp = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xeef4ff, emissiveIntensity: 5 });
  for (let xx = 40; xx < FINISH_X; xx += 55) for (const z of [-13, 13]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9, 8), post); p.position.set(xx, 4.5, z); course.add(p);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.5), lamp); hd.position.set(xx, 9.1, z * 0.94); course.add(hd);
  }
}
// lights for the course: a key light that follows the car, and the car's own headlights
const followLight = new THREE.DirectionalLight(0xdfe8ff, 1.3); followLight.visible = false;
followLight.castShadow = true; followLight.shadow.mapSize.set(2048, 2048);
Object.assign(followLight.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 }); followLight.shadow.bias = -0.0004;
scene.add(followLight, followLight.target);
const headlight = new THREE.SpotLight(0xf4f8ff, 420, 0, 0.5, 0.55, 2); headlight.visible = false;
headlight.position.set(2.2, 0.5, 0); headlight.target.position.set(14, -0.4, 0); body.add(headlight, headlight.target);

export { CRASH_SPEED, FINISH_X, MAT, MAX_CRASHES, bestRec, buildCourse, course, followLight, fuelBar, fuelNum, game, gameBest, gameDamage, gameLeft, gameOver, gameScore, gameSpeed, gameTime, gameToast, gameUI, goBest, goBusts, goCans, goNew, goScore, goTime, goTitle, headlight, store };
