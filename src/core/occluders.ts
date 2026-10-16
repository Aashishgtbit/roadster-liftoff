// Tall, thin things (floodlight towers, lamp posts, arch posts) that hide themselves while they stand between the
// camera and the car, so a pole never blocks the view. Their lights keep shining; only the meshes hide.
import type { Object3D, Vector3 } from "three";

interface Occluder { objects: Object3D[]; x: number; z: number; radius: number }

const occluders: Occluder[] = [];

/** Register meshes standing at (x, z) with the given footprint radius (m). */
export function addOccluder(objects: Object3D[], x: number, z: number, radius = 0.5) {
  occluders.push({ objects, x, z, radius });
}

/** Hide every occluder near the line from the camera to the car (on the ground plane), show the rest. */
export function hideOccluders(camera: Vector3, target: Vector3) {
  const dx = target.x - camera.x, dz = target.z - camera.z, lengthSq = dx * dx + dz * dz || 1;
  for (const o of occluders) {
    // closest point on the camera→car segment to the pole, and how far along it is
    const t = ((o.x - camera.x) * dx + (o.z - camera.z) * dz) / lengthSq;
    const px = camera.x + dx * t - o.x, pz = camera.z + dz * t - o.z;
    const inTheWay = t > -0.05 && t < 0.97 && px * px + pz * pz < (o.radius + 1.2) ** 2;
    for (const object of o.objects) if (object.visible === inTheWay) object.visible = !inTheWay;
  }
}
