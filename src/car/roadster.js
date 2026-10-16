// Builds the Roadster: body, glasshouse, lights, tail, actuated wing, ten nozzles and wheels.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { clamp } from "../core/math.js";
import { CAR_L, COM, TRACK_Z, WR, XW } from "../config.js";
import { scene } from "../core/renderer.js";
import { cap, halfWidthAt, interp, loft, noseX, section, topAt } from "./geometry.js";
import { PAINT, UNDER, blackMat, carbonMat, chromeMat, frontLightMat, glassMat, paintMat, paintSolid, rearLightMat } from "./materials.js";

const car = new THREE.Group();      // pivot at centre of mass
const body = new THREE.Group();     // sprung parts (dip on landing)
car.add(body); scene.add(car);
body.position.y = -COM;
const wing = new THREE.Group();
{
  const X0 = -CAR_L / 2, X1 = CAR_L / 2, NS = 300, secs = [];
  for (let i = 0; i <= NS; i++) secs.push(section(X0 + (X1 - X0) * i / NS));
  body.add(new THREE.Mesh(loft(secs, (s, S, k) => (s <= 4 || (k <= 5 && S.lifted[k]) || (s >= 8 && S.x < -1.69)) ? UNDER : PAINT), paintMat));
  body.add(new THREE.Mesh(cap(secs[0], false, PAINT), paintMat));
  body.add(new THREE.Mesh(cap(secs[NS], true, PAINT), paintMat));

  // bronze glass: windshield just behind the front axle, roof glass tapering almost to the tail
  // windshield raked from just behind the front axle; roof peak 60% back; glass tapers to a cut just short of the tail
  const CK = [ // x, side-glass base half-width, roof-glass half-width, roof height
    [-1.74, 0.34, 0.33, 0], [-1.69, 0.35, 0.34, 1.0], [-1.578, 0.38, 0.37, 1.04], [-1.40, 0.43, 0.42, 1.08], [-1.240, 0.49, 0.46, 1.11],
    [-1.015, 0.66, 0.47, 1.135], [-0.789, 0.76, 0.49, 1.16], [-0.52, 0.83, 0.50, 1.17], [-0.2, 0.85, 0.52, 1.14], [0.2, 0.85, 0.54, 1.075],
    [0.66, 0.85, 0.61, 0.97], [0.89, 0.85, 0.665, 0.92], [1.18, 0.82, 0.72, 0.86], [1.368, 0.76, 0.74, 0.82], [1.48, 0.62, 0.59, 0],
  ];

  // three bands, as the overhead photo shows: near-vertical side windows, a white roof rail (the top of the doors), bronze roof glass
  const gx0 = CK[0][0], gx1 = CK[CK.length - 1][0], sideG = [], rail = [], roofG = [];
  for (let i = 0; i <= 160; i++) {
    const x = gx0 + (gx1 - gx0) * i / 160, [cwB, cwR, top0] = interp(CK, x), S = section(x);
    const b = topAt(S, cwB) - 0.01, centre = topAt(S, 0);
    const top = Math.max(top0, centre + 0.004), eY = Math.max(b, top - 0.035 - 0.02 * (cwR / 0.7), topAt(S, cwR) + 0.002);
    const hS = clamp((cwB - cwR) / 0.18, 0, 1), cwS = cwB - 0.07 * hS, yS = b + (eY - b) * 0.9 * hS;
    sideG.push({ x, p: [[cwB, b], [cwS, yS]] });
    rail.push({ x, p: [[cwS, yS], [cwS - (cwS - cwR) * 0.35, yS + (eY - yS) * 0.8], [cwR, eY]] });
    roofG.push({ x, p: [[cwR, eY], [cwR * 0.5, Math.max(top - 0.008, topAt(S, cwR * 0.5) + 0.002)], [0, top]] });
  }
  body.add(new THREE.Mesh(loft(sideG, () => PAINT), glassMat));
  body.add(new THREE.Mesh(loft(rail, () => PAINT), paintSolid));
  body.add(new THREE.Mesh(loft(roofG, () => PAINT), glassMat));

  // full-width front light bar where the hood meets the nose, following the round plan shape
  const fp = [], BAR_Y = 0.47;
  for (let z = -0.74; z <= 0.7401; z += 0.04) fp.push(new THREE.Vector3(noseX(z, BAR_Y) + 0.004, BAR_Y - 0.012 * (z / 0.74) ** 2, z));
  body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fp), 90, 0.009, 8, false), frontLightMat));
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 1.2), carbonMat); splitter.position.set(noseX(0, 0.3) - 0.1, 0.2, 0); body.add(splitter);

  // tail: black band with the red bar, silver plate panel, deep diffuser with strakes
  const XT = -CAR_L / 2;
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.075, 1.7), carbonMat); lip.position.set(XT - 0.02, 0.875, 0); body.add(lip);
  const lipTop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 1.7), paintSolid); lipTop.position.set(XT, 0.918, 0); lipTop.rotation.z = -0.12; body.add(lipTop);
  const rl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, 1.62), rearLightMat); rl.position.set(XT - 0.105, 0.88, 0); body.add(rl);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.15, 0.34), new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: 0.5 })); plate.position.set(XT - 0.01, 0.69, 0); body.add(plate);
  const diff = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.28), carbonMat); diff.position.set(XT + 0.19, 0.33, 0); body.add(diff);
  for (const z of [-0.62, -0.32, 0, 0.32, 0.62]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.014), carbonMat); f.position.set(XT + 0.05, 0.25, z); body.add(f); }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 1.3), carbonMat); shelf.position.set(XT + 0.03, 0.42, 0); body.add(shelf);

  // the wing, actuated as in Tesla's Track Mode video: a polished titanium plane whose tips turn down into endplates,
  // on black uprights. Road = stowed on the deck, High-Downforce = raised and pitched, Low-Drag = raised and flat.
  const tiMat = new THREE.MeshPhysicalMaterial({ color: 0xcfc4b8, metalness: 1, roughness: 0.22, clearcoat: 0.6 });
  const wPlane = new THREE.Group(); wPlane.position.set(XT + 0.22, 0, 0); wing.add(wPlane);
  wPlane.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.018, 1.62), tiMat));
  for (const s of [-1, 1]) {
    const tip = new THREE.Group(); tip.position.set(0, 0, s * 0.81); wPlane.add(tip);
    const curl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.018, 0.16), tiMat); curl.position.set(0, -0.03, s * 0.07); curl.rotation.x = s * 0.45; tip.add(curl);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.19, 0.01), tiMat); plate.position.set(0, -0.14, s * 0.14); plate.rotation.x = s * -0.25; tip.add(plate);
    wing.userData["tip" + s] = tip;
  }
  const posts = [];
  for (const z of [-0.42, 0.42]) { const u = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.024), carbonMat); u.position.set(XT + 0.3, 0, z); wing.add(u); posts.push(u); }
  wing.userData = { ...wing.userData, plane: wPlane, posts, mode: 1, k: 1, pitch: -0.2 };
  body.add(wing);

  // camera wings by the windshield base, a door cut line
  for (const z of [-0.9, 0.9]) { const m = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.045, 0.09, 2, 0.02), carbonMat); m.position.set(1.18, 0.84, z); body.add(m); }
  // amber side marker at the back of the front fender, as in the wheel close-up
  const markMat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff5a10, emissiveIntensity: 1.2 });
  for (const s of [-1, 1]) { const Sm = section(0.95); const mk = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.006), markMat); mk.position.set(0.95, 0.68, s * (halfWidthAt(Sm, 0.68) + 0.004)); body.add(mk); }
  // the dark C-pillar vents on top of each buttress (rear photo from above)
  for (const s of [-1, 1]) for (let i = 0; i < 1; i++) {
    const pts = []; for (let x = -0.95; x >= -1.45; x -= 0.05) { const Sv = section(x), z = Sv.p[8][0] - 0.07; pts.push(new THREE.Vector3(x, topAt(Sv, z) + 0.004, s * z)); }
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.028, 6, false), carbonMat));
  }
  const S = section(0.3);
  for (const side of [1, -1]) {
    const pts = [5, 6, 7].map(k => new THREE.Vector3(0.3 - (k - 5) * 0.05, S.p[k][1], side * (S.p[k][0] + 0.003)));
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.004, 4, false), blackMat));
  }
}

// ten cold-gas nozzles: four under the floor near the wheel arches, four in the diffuser, two in the nose
const NOZ = [];
{
  const shell = new THREE.CylinderGeometry(0.046, 0.058, 0.09, 18, 1, true);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x3b4150, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide });
  const ring = new THREE.TorusGeometry(0.05, 0.01, 8, 28);
  const add = (x, y, z, dir, group) => {
    const o = new THREE.Group(); o.position.set(x, y, z);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    const glowMat = new THREE.MeshStandardMaterial({ color: group === "rear" ? 0x6b4a22 : 0x0a0c10, metalness: group === "rear" ? 1 : 0, roughness: 0.3, emissive: 0x9fdcff, emissiveIntensity: 0 });
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.044, 18).rotateX(Math.PI / 2), glowMat); d.position.y = -0.03;
    o.add(new THREE.Mesh(shell, shellMat), d);
    if (group === "rear") { const r = new THREE.Mesh(ring, chromeMat); r.rotation.x = Math.PI / 2; r.position.y = -0.045; o.add(r); }
    body.add(o); NOZ.push({ o, dir, group, glowMat, p: new THREE.Vector3(x, y - COM, z), e: dir.clone(), Tmax: { down: 18000, rear: 7000, front: 5000 }[group] });
  };
  for (const x of [-1.6, 1.6]) for (const z of [-0.55, 0.55]) add(x, 0.14, z, new THREE.Vector3(0, -1, 0), "down");
  for (const z of [-0.375, -0.135, 0.135, 0.375]) add(-CAR_L / 2 - 0.02, 0.52, z, new THREE.Vector3(-1, 0, 0), "rear");
  for (const z of [-0.3, 0.3]) add(noseX(z, 0.3) - 0.06, 0.3, z, new THREE.Vector3(1, 0, 0), "front");
}

// wheels: wide tyres, white aero discs with black twin spokes
const wheels = [];
{
  const prof = [[0.27, -0.17], [0.35, -0.172], [0.364, -0.145], [0.37, 0], [0.364, 0.145], [0.35, 0.172], [0.27, 0.17]].map(p => new THREE.Vector2(p[0], p[1]));
  const tireGeo = new THREE.LatheGeometry(prof, 60).rotateX(Math.PI / 2);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.88 });
  const discMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe1e4, metalness: 0.55, roughness: 0.28, clearcoat: 1 });
  const spokeMat = new THREE.MeshPhysicalMaterial({ color: 0x08090b, metalness: 0.4, roughness: 0.25, clearcoat: 1 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x4a4e56, metalness: 0.8, roughness: 0.45 });
  for (const xw of XW) for (const side of [1, -1]) {
    const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
    spin.add(new THREE.Mesh(tireGeo, rubber));
    spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.268, 0.268, 0.32, 40, 1, true).rotateX(Math.PI / 2), blackMat));
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.02, 56).rotateX(Math.PI / 2), discMat); face.position.z = 0.14; spin.add(face);
    for (let k = 0; k < 6; k++) {   // six black spokes on a white aero disc, as in the wheel close-up
      const a = k / 6 * Math.PI * 2, P = (r, t) => new THREE.Vector2(Math.cos(t) * r, Math.sin(t) * r);
      const sh = new THREE.Shape([P(0.05, a - 0.4), P(0.05, a + 0.4), P(0.255, a + 0.15), P(0.255, a - 0.07)]);
      const blade = new THREE.Mesh(new THREE.ShapeGeometry(sh), spokeMat); blade.position.z = 0.152; spin.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 20).rotateX(Math.PI / 2), spokeMat); hub.position.z = 0.155; spin.add(hub);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.026, 36).rotateX(Math.PI / 2), brakeMat); disc.position.z = 0.04; g.add(disc);
    g.position.set(xw, WR - COM, side * TRACK_Z);
    if (side < 0) g.rotation.y = Math.PI;
    car.add(g); wheels.push({ spin, side, g });
  }
}
car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

export { NOZ, body, car, wheels, wing };
