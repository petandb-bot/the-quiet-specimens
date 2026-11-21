import * as T from 'three';
import type { GardenSpecimen } from '../genome';
import { buildSpecimen } from '../morphology';
import { GardenMotion } from '../motion';
import { makeArtifact } from '../objects/render';
import type { WorldObject } from '../world/document';

const width = 104, height = 74;

function renderThumbnail(renderer: T.WebGLRenderer, environment: T.Texture, root: T.Group, camera: T.PerspectiveCamera) {
  const scene = new T.Scene();
  scene.background = new T.Color('#dedacd');
  scene.environment = environment;
  scene.environmentIntensity = .45;
  const key = new T.DirectionalLight('#fff0d7', 2.3);
  key.position.set(-3, 7, 4);
  scene.add(new T.HemisphereLight('#fff8eb', '#86765a', 1.5), key, root);
  const target = new T.WebGLRenderTarget(width, height);
  target.texture.colorSpace = T.SRGBColorSpace;
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return '';
    const output = context.createImageData(width, height);
    for (let line = 0; line < height; line++) {
      const from = (height - line - 1) * width * 4;
      output.data.set(pixels.subarray(from, from + width * 4), line * width * 4);
    }
    context.putImageData(output, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    renderer.setRenderTarget(previous);
    target.dispose();
  }
}

export function thumbnail(renderer: T.WebGLRenderer, specimen: GardenSpecimen, environment: T.Texture) {
  const rig = buildSpecimen(specimen.genome);
  try {
    rig.animate(new GardenMotion(specimen.genome, [0, 0]).pose);
    const camera = new T.PerspectiveCamera(33, width / height, .1, 20);
    camera.position.set(3.7, 2.5, 4.8);
    camera.lookAt(0, .85, 0);
    return renderThumbnail(renderer, environment, rig.root, camera);
  } finally { rig.dispose(); }
}

export function artifactThumbnail(renderer: T.WebGLRenderer, object: WorldObject, environment: T.Texture) {
  const artifact = makeArtifact(object);
  try {
    artifact.animate(1.8);
    const bounds = new T.Box3().setFromObject(artifact.group);
    const center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
    const distance = Math.max(size.length() * 1.5, .9);
    const camera = new T.PerspectiveCamera(38, width / height, .1, 28);
    camera.position.set(.37, .31, .87).normalize().multiplyScalar(distance).add(center);
    camera.lookAt(center);
    return renderThumbnail(renderer, environment, artifact.group, camera);
  } finally { artifact.dispose(); }
}
