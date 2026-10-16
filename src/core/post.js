// Bloom post-processing and resizing.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { state } from "./state.js";
import { stage } from "../ui/dom.js";
import { camera, renderer, scene } from "./renderer.js";
import { pMat } from "../effects/plumes.js";

/* ---------- post: bloom for the light bars and floodlights ---------- */
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.4, 1.1);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w / h < 1.2 ? 42 : 32; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = (h * renderer.getPixelRatio()) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  state.dirty = true;
}
new ResizeObserver(resize).observe(stage);
new IntersectionObserver(es => { state.visible = es[0].isIntersecting; }).observe(stage);

export { composer, resize };
