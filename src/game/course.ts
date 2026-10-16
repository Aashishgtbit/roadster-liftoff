// Drive it: the course in 3D. Obstacles and fuel canisters from a random layout (layout.ts), plus the fixed scenery:
// barriers, grandstands, the finish arch, lane markings and the course lights.
import * as THREE from "three";
import { BARRIERS, END_WALL_X, FINISH_X, START_WALL_X, TRACK_HALF_WIDTH } from "../config";
import { canvasTexture, scene } from "../core/renderer";
import { addOccluder } from "../core/occluders";
import { body } from "../car/roadster";
import type { Obstacle } from "../physics/types";
import { CRATE_SIZE, WALL_HALF_WIDTH, WALL_HEIGHT, generateLayout, obstacleFor } from "./layout";
import type { CourseItem } from "./layout";

export const course = new THREE.Group();
course.visible = false;
scene.add(course);
const obstacleGroup = new THREE.Group();
course.add(obstacleGroup);

export interface FuelCan { mesh: THREE.Group; x: number; y: number; z: number; collected: boolean }

export interface BuiltCourse {
  seed: number;
  obstacles: Obstacle[];                          // what the physics collides with, barriers included
  meshes: Map<Obstacle, THREE.Object3D>;          // what to hide when an obstacle is busted
  cans: FuelCan[];
}

/** Striped texture: diagonal bands of `stripe` on `base`. */
const stripes = (base: string, stripe: string) => canvasTexture(256, 64, (ctx, w, h) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); ctx.fillStyle = stripe;
  for (let i = -2; i < 10; i++) { ctx.beginPath(); ctx.moveTo(i * 32, h); ctx.lineTo(i * 32 + 16, h); ctx.lineTo(i * 32 + 48, 0); ctx.lineTo(i * 32 + 32, 0); ctx.fill(); }
});

const crateTexture = canvasTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = "#b9803f"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#6e4519"; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(w - 8, h - 8); ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 24; y < h; y += 24) ctx.fillRect(10, y, w - 20, 2);
});
const wallTexture = stripes("#e9ebee", "#d42a1f");
wallTexture.wrapS = THREE.RepeatWrapping; wallTexture.repeat.set(4, 1);
const rampTexture = stripes("#1d2128", "#f2c230");
rampTexture.wrapS = rampTexture.wrapT = THREE.RepeatWrapping; rampTexture.repeat.set(1, 3);

export const crateMaterial = new THREE.MeshStandardMaterial({ map: crateTexture, roughness: 0.85 });
export const crateGeometry = new THREE.BoxGeometry(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE);
const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.7 });
const rampTopMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.8 });
const rampSideMaterial = new THREE.MeshStandardMaterial({ map: rampTexture, roughness: 0.7 });
const canMaterial = new THREE.MeshStandardMaterial({ color: 0x0b2a33, emissive: 0x57d9ff, emissiveIntensity: 2.4, metalness: 0.4, roughness: 0.3 });
const canRingMaterial = new THREE.MeshStandardMaterial({ color: 0xdde4ee, metalness: 1, roughness: 0.2 });

function shadowed<T extends THREE.Mesh>(mesh: T): T { mesh.castShadow = mesh.receiveShadow = true; return mesh; }

/** The mesh for one course item, placed in the world. */
function buildItem(item: CourseItem): THREE.Object3D {
  switch (item.kind) {
    case "crates": {   // two rows of crates, each slightly turned
      const stack = new THREE.Group(); stack.position.set(item.x, 0, 0);
      for (let row = 0; row < 2; row++) for (let k = 0; k < item.columns; k++) {
        const crate = shadowed(new THREE.Mesh(crateGeometry, crateMaterial));
        crate.position.set(CRATE_SIZE / 2, CRATE_SIZE / 2 + row * CRATE_SIZE, item.minZ + CRATE_SIZE / 2 + k * CRATE_SIZE);
        crate.rotation.y = item.wobble[row * item.columns + k];
        stack.add(crate);
      }
      return stack;
    }
    case "wall": {
      const wall = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, WALL_HEIGHT, 2 * WALL_HALF_WIDTH), wallMaterial));
      wall.position.set(item.x + 0.5, WALL_HEIGHT / 2, 0);
      return wall;
    }
    case "ramp": {   // a wedge: sloped top, striped sides, open back
      const profile = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(item.length, 0), new THREE.Vector2(item.length, item.height)]);
      const wedge = new THREE.ExtrudeGeometry(profile, { depth: item.halfWidth * 2, bevelEnabled: false }).translate(0, 0, -item.halfWidth);
      const ramp = shadowed(new THREE.Mesh(wedge, [rampSideMaterial, rampTopMaterial]));
      ramp.position.set(item.x, 0, 0);
      return ramp;
    }
    case "can": {
      const can = new THREE.Group(); can.position.set(item.x, item.y, item.z);
      can.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.72, 20), canMaterial));
      for (const y of [-0.3, 0.3]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 8, 24), canRingMaterial);
        ring.rotation.x = Math.PI / 2; ring.position.y = y; can.add(ring);
      }
      return can;
    }
  }
}

/** Replace the obstacles and canisters with the layout for `seed`. */
export function buildCourse(seed: number): BuiltCourse {
  for (const old of [...obstacleGroup.children]) {
    obstacleGroup.remove(old);
    old.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && mesh.geometry !== crateGeometry) mesh.geometry.dispose(); });
  }
  const built: BuiltCourse = { seed, obstacles: [], meshes: new Map(), cans: [] };
  for (const item of generateLayout(seed)) {
    const mesh = buildItem(item);
    obstacleGroup.add(mesh);
    const obstacle = obstacleFor(item);
    if (obstacle) { built.obstacles.push(obstacle); built.meshes.set(obstacle, mesh); }
    else if (item.kind === "can") built.cans.push({ mesh: mesh as THREE.Group, x: item.x, y: item.y, z: item.z, collected: false });
  }
  built.obstacles.push(...BARRIERS.map(b => ({ ...b })));
  return built;
}

// ---------- the boundary: concrete barriers down both sides and walls across both ends ----------
// (the physics extends them upward, unseen, so the car cannot fly out over them: see BARRIERS in config.ts)
{
  const length = END_WALL_X - START_WALL_X, midX = START_WALL_X + length / 2, BARRIER_HEIGHT = 1.05, sideZ = TRACK_HALF_WIDTH + 0.4;
  const concrete = canvasTexture(512, 64, (ctx, w, h) => {
    ctx.fillStyle = "#b9bdc4"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { const v = 150 + Math.random() * 60 | 0; ctx.fillStyle = `rgba(${v},${v},${v + 4},.5)`; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#e9ebee" : "#d42a1f"; ctx.fillRect(i * 64, 0, 64, 12); }
    ctx.fillStyle = "rgba(0,0,0,.25)"; for (let i = 0; i <= 8; i++) ctx.fillRect(i * 64, 0, 2, h);
  });
  concrete.wrapS = THREE.RepeatWrapping;
  const led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2414, emissiveIntensity: 2.2 });
  for (const side of [-1, 1]) {
    const texture = concrete.clone(); texture.needsUpdate = true; texture.repeat.set(length / 8, 1);
    const barrier = shadowed(new THREE.Mesh(new THREE.BoxGeometry(length, BARRIER_HEIGHT, 0.8), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 })));
    barrier.position.set(midX, BARRIER_HEIGHT / 2, side * sideZ); course.add(barrier);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, 0.05), led);
    strip.position.set(midX, 0.86, side * (TRACK_HALF_WIDTH - 0.02)); course.add(strip);
  }
  const endWallXs = [START_WALL_X - 0.5, END_WALL_X + 0.5];
  for (const x of endWallXs) {
    const wall = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 2 * TRACK_HALF_WIDTH + 1.6), wallMaterial));
    wall.position.set(x, 1.1, 0); course.add(wall);
  }

  const matrix = new THREE.Matrix4();

  // grandstands with crowd lights beyond the barriers, so the view never runs into empty dark
  const standMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.9 }), crowdMaterial = new THREE.MeshBasicMaterial({ color: 0xffe7b8 });
  const head = new THREE.SphereGeometry(0.07, 6, 4), STEPS = 5, STEP_DEPTH = 1.6, PEOPLE = 60;
  for (let x = -20; x < END_WALL_X; x += 48) for (const side of [-1, 1]) {
    const stand = new THREE.Group(); stand.position.set(x, 0, side * 20);
    for (let k = 0; k < STEPS; k++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(30, 1, STEP_DEPTH), standMaterial);
      step.position.set(0, 0.5 + k, side * k * STEP_DEPTH); step.receiveShadow = true; stand.add(step);
    }
    const crowd = new THREE.InstancedMesh(head, crowdMaterial, PEOPLE);
    for (let i = 0; i < PEOPLE; i++) {
      const k = i % STEPS;
      matrix.makeTranslation((Math.random() - 0.5) * 28, 1.25 + k, side * k * STEP_DEPTH + (Math.random() - 0.5) * 0.6);
      crowd.setMatrixAt(i, matrix);
    }
    stand.add(crowd); course.add(stand);
  }
}

// ---------- finish arch, lane markings, cones, lamp posts ----------
{
  const checker = canvasTexture(256, 32, (ctx, w) => {
    for (let a = 0; a < w / 16; a++) for (let b = 0; b < 2; b++) { ctx.fillStyle = (a + b) % 2 ? "#111" : "#f2f2f2"; ctx.fillRect(a * 16, b * 16, 16, 16); }
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.7, roughness: 0.4 });
  for (const z of [-8.5, 8.5]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.6, 0.35), metal); post.position.set(FINISH_X, 2.8, z); course.add(post); addOccluder([post], FINISH_X, z, 0.3); }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(17, 1.4), new THREE.MeshStandardMaterial({ map: checker, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: checker, emissiveIntensity: 0.6 }));
  banner.position.set(FINISH_X, 5, 0); banner.rotation.y = Math.PI / 2; course.add(banner);
  const finishLine = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.8 }));
  finishLine.position.set(FINISH_X, 0.01, 0); course.add(finishLine);

  const matrix = new THREE.Matrix4();
  /** Up to `max` instances every `spacing` m from x = 0 to `toX`, at both z offsets. */
  const rows = (geometry: THREE.BufferGeometry, material: THREE.Material, max: number, toX: number, spacing: number, z: number, y: number) => {
    const mesh = new THREE.InstancedMesh(geometry, material, max);
    let n = 0;
    for (let x = 0; x < toX && n < max; x += spacing) for (const s of [-1, 1]) if (n < max) { matrix.makeTranslation(x, y, s * z); mesh.setMatrixAt(n++, matrix); }
    mesh.count = n;
    course.add(mesh);
  };
  rows(new THREE.PlaneGeometry(1.8, 0.14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9dde4, roughness: 0.7 }), 220, FINISH_X + 20, 3.4, 3.6, 0.006);
  rows(new THREE.ConeGeometry(0.16, 0.5, 14).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: 0xff5a14, roughness: 0.55 }), 80, FINISH_X + 10, 9, 8.6, 0);

  const lamp = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xeef4ff, emissiveIntensity: 5 });
  for (let x = 40; x < FINISH_X; x += 55) for (const z of [-13, 13]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9, 8), metal); pole.position.set(x, 4.5, z); course.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.5), lamp); head.position.set(x, 9.1, z * 0.94); course.add(head);
    addOccluder([pole, head], x, z, 0.6);
  }
}

// ---------- lights: a key light that follows the car, and the car's own headlights ----------
export const followLight = new THREE.DirectionalLight(0xdfe8ff, 1.3);
followLight.visible = false;
followLight.castShadow = true;
followLight.shadow.mapSize.set(2048, 2048);
Object.assign(followLight.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 });
followLight.shadow.bias = -0.0004;
scene.add(followLight, followLight.target);

export const headlight = new THREE.SpotLight(0xf4f8ff, 420, 0, 0.5, 0.55, 2);
headlight.visible = false;
headlight.position.set(2.2, 0.5, 0);
headlight.target.position.set(14, -0.4, 0);
body.add(headlight, headlight.target);
