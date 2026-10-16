// Bloom post-processing (for the light bars and floodlights) and resizing.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { app } from "./state";
import { stage } from "../ui/dom";
import { camera, renderer, scene } from "./renderer";
import { setPlumePointScale } from "../effects/plumes";

const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
export const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.4, 1.1));
composer.addPass(new OutputPass());

export function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  renderer.setSize(width, height, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.fov = width / height < 1.2 ? 42 : 32;   // portrait screens get a wider lens
  camera.updateProjectionMatrix();
  // gas particles are sized in metres: pixels per metre at 1 m from the camera
  setPlumePointScale((height * renderer.getPixelRatio()) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  app.needsRender = true;
}
new ResizeObserver(resize).observe(stage);
new IntersectionObserver(entries => { app.visible = entries[0].isIntersecting; }).observe(stage);
