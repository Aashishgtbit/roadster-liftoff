// Sky, stars, asphalt, track markings and cones.
import * as THREE from "three";
import { canvasTexture, scene } from "../core/renderer";

// sky: a gradient dome from the horizon glow up to near-black, and a field of stars
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x03050b) }, mid: { value: new THREE.Color(0x0b1226) }, horizon: { value: new THREE.Color(0x1f2a4a) } },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: "uniform vec3 top, mid, horizon; varying vec3 vDir; void main(){ float h = vDir.y; vec3 c = mix(horizon, mid, smoothstep(0.0, 0.12, h)); c = mix(c, top, smoothstep(0.12, 0.6, h)); gl_FragColor = vec4(c, 1.); }",
  }));
  scene.add(sky);
  const count = 1600, radius = 560, positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const azimuth = Math.random() * Math.PI * 2, elevation = 0.08 + Math.random() * 0.9, ring = Math.sqrt(1 - elevation * elevation) * radius;
    positions[i * 3] = Math.cos(azimuth) * ring; positions[i * 3 + 1] = elevation * radius; positions[i * 3 + 2] = Math.sin(azimuth) * ring;
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
}

// ground
{
  const asphalt = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#2a2c31"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {   // grit
      const v = 30 + Math.random() * 40 | 0;
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 6},${0.35 + Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
    }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(140, 140);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: asphalt, color: 0x9aa1ad, roughness: 0.93 }));
  ground.receiveShadow = true;
  scene.add(ground);
}

// the stunt area: launch pad, start line, lane dashes and cones
{
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(7, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.85 }));
  pad.position.set(-9.5, 0.004, 0); pad.receiveShadow = true; scene.add(pad);
  const paint = new THREE.MeshStandardMaterial({ color: 0xd9dde4, roughness: 0.7 });
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 6).rotateX(-Math.PI / 2), paint);
  startLine.position.set(-6.2, 0.008, 0); scene.add(startLine);

  const matrix = new THREE.Matrix4();
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.8, 0.14).rotateX(-Math.PI / 2), paint, 60);
  let n = 0;
  for (let x = -40; x < 56 && n < 60; x += 3.4) for (const z of [-3.6, 3.6]) { if (n >= 60) break; matrix.makeTranslation(x, 0.006, z); dashes.setMatrixAt(n++, matrix); }
  dashes.count = n; dashes.receiveShadow = true; scene.add(dashes);

  const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.5, 18).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: 0xff5a14, roughness: 0.55 }), 40);
  n = 0;
  for (let x = -22; x <= 36 && n < 40; x += 3) for (const z of [-4.6, 4.6]) { if (n >= 40) break; matrix.makeTranslation(x, 0, z); cones.setMatrixAt(n++, matrix); }
  cones.count = n; cones.castShadow = true; scene.add(cones);
}
