// The curved ramp for the ramp hang: running surface, steel back and side plates, LED edges, truss and its own
// floodlight. The physics uses the same shape (RAMP in config.ts).
import * as THREE from "three";
import { RAMP } from "../config";
import { canvasTexture, enableShadows, scene } from "../core/renderer";

export const rampGroup = new THREE.Group();
rampGroup.visible = false;
scene.add(rampGroup);

const { startX, radius, endAngle } = RAMP, WIDTH = RAMP.halfWidth * 2 + 0.2, STEPS = 120, ACROSS = 6, THICKNESS = 0.22;

/** A point on the curve at angle `angle`, `offset` metres behind the running surface: [x, y]. */
const onCurve = (angle: number, offset: number): [number, number] =>
  [startX + (radius + offset) * Math.sin(angle), radius - (radius + offset) * Math.cos(angle)];

/** The curved sheet `offset` behind the running surface; `inward` faces the car. */
function curvedSheet(offset: number, inward: boolean) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const [x, y] = onCurve(endAngle * i / STEPS, offset);
    for (let j = 0; j <= ACROSS; j++) { positions.push(x, y, -WIDTH / 2 + WIDTH * j / ACROSS); uvs.push(j / ACROSS, i / STEPS); }
  }
  for (let i = 0; i < STEPS; i++) for (let j = 0; j < ACROSS; j++) {
    const a = i * (ACROSS + 1) + j, b = a + 1, c = a + ACROSS + 1, d = c + 1;
    if (inward) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const surface = canvasTexture(256, 512, (ctx, w, h) => {
  ctx.fillStyle = "#d9dbde"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { const v = 190 + Math.random() * 50 | 0; ctx.fillStyle = `rgba(${v},${v},${v + 3},0.5)`; ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  ctx.fillStyle = "#8d9299"; ctx.fillRect(120, 0, 16, h);                                 // centre stripe, as in the video
  ctx.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 0; y < h; y += 128) ctx.fillRect(0, y, w, 2);   // panel seams
});
surface.wrapS = surface.wrapT = THREE.RepeatWrapping;
surface.repeat.set(1, radius * endAngle / 8);

const steel = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.7, roughness: 0.45 });
rampGroup.add(new THREE.Mesh(curvedSheet(0, true), new THREE.MeshStandardMaterial({ map: surface, roughness: 0.62 })));
rampGroup.add(new THREE.Mesh(curvedSheet(THICKNESS, false), steel));

const ledMaterial = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a10, emissiveIntensity: 2.6 });
for (const side of [-1, 1]) {
  // side plate between the running surface and the back
  const positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= STEPS; i++) for (const offset of [0, THICKNESS]) { const [x, y] = onCurve(endAngle * i / STEPS, offset); positions.push(x, y, side * WIDTH / 2); }
  for (let i = 0; i < STEPS; i++) {
    const a = i * 2;
    if (side > 0) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const plate = new THREE.BufferGeometry();
  plate.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  plate.setIndex(indices);
  plate.computeVertexNormals();
  rampGroup.add(new THREE.Mesh(plate, steel));
  // red LED strip along the edge of the running surface
  const edge: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) { const [x, y] = onCurve(endAngle * i / 80, -0.03); edge.push(new THREE.Vector3(x, y, side * (WIDTH / 2 - 0.03))); }
  rampGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 160, 0.035, 8, false), ledMaterial));
}

// steel truss: a tower behind the wall, posts under the lower curve, braces holding up the overhang
{
  const beam = (from: THREE.Vector3, to: THREE.Vector3, thickness: number) => {
    const span = new THREE.Vector3().subVectors(to, from), member = new THREE.Mesh(new THREE.BoxGeometry(thickness, span.length(), thickness), steel);
    member.position.copy(from).addScaledVector(span, 0.5);
    member.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.normalize());
    rampGroup.add(member);
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const TOWER_X = startX + radius + 1.4, TOWER_TOP = 2 * radius + 0.9;
  for (const z of [-2.6, 2.6]) {
    beam(v(TOWER_X, 0, z), v(TOWER_X, TOWER_TOP, z), 0.28);
    beam(v(TOWER_X + 1.6, 0, z), v(TOWER_X + 1.6, TOWER_TOP - 1.5, z), 0.24);
    for (let y = 1.5; y < TOWER_TOP - 1; y += 1.8) { beam(v(TOWER_X, y, z), v(TOWER_X + 1.6, y, z), 0.12); beam(v(TOWER_X, y, z), v(TOWER_X + 1.6, y + 1.8, z), 0.08); }
    for (let a = 0.2 * Math.PI; a <= 0.5 * Math.PI + 1e-6; a += 0.1 * Math.PI) {
      const [x, y] = onCurve(a, 0.24);
      beam(v(x, 0, z), v(x, y, z), 0.14); beam(v(x, y, z), v(TOWER_X, Math.min(TOWER_TOP, y + 1.2), z), 0.1);
    }
    for (let a = 0.6 * Math.PI; a <= endAngle + 1e-6; a += 0.1 * Math.PI) { const [x, y] = onCurve(a, 0.24); beam(v(x, y, z), v(TOWER_X, TOWER_TOP, z), 0.12); }
  }
  for (let y = 2; y < TOWER_TOP; y += 2.4) beam(v(TOWER_X, y, -2.6), v(TOWER_X, y, 2.6), 0.12);
  beam(v(TOWER_X, TOWER_TOP, -2.6), v(TOWER_X, TOWER_TOP, 2.6), 0.2);
}

// red light lines on the ground in front of the ramp, as in the footage
{
  const led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2414, emissiveIntensity: 2 });
  for (const z of [-3.4, 3.4]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(16, 0.04, 0.07), led); strip.position.set(startX - 8, 0.03, z); rampGroup.add(strip); }
}
enableShadows(rampGroup);

const spot = new THREE.SpotLight(0xf1f5ff, 1700, 0, 0.55, 0.6, 2);
spot.position.set(startX - 10, 19, 17);
spot.target.position.set(startX + 2.5, 6.5, 0);
spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
spot.shadow.camera.near = 4; spot.shadow.camera.far = 60; spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.03;
rampGroup.add(spot, spot.target);
