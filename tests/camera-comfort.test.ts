import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { captureView, residentFrame, showView, SoftFollow } from '../src/reborn/camera';
import { defaultLand, makeTerrain } from '../src/reborn/terrain';

const flat = makeTerrain({ ...defaultLand, elevation: 0, density: 0 });

it('keeps the camera and lens exact while a resident is in the dead zone', () => {
  const camera = new PerspectiveCamera(40, 1.5, .15, 170), target = new Vector3();
  residentFrame(flat, [0, 0], camera, target);
  const engine = new SoftFollow();
  const original = captureView(camera, target);
  for (let i = 0; i < 180; i++) {
    engine.advance(1 / 60, camera, target, new Vector3(Math.sin(i) * 1.3, 1.05, 0), flat, false);
  }
  expect(captureView(camera, target)).toEqual(original);
});

it('translates without rotation, keeps the lens fixed and caps automatic speed', () => {
  const camera = new PerspectiveCamera(40, 1.55, .15, 170), target = new Vector3();
  residentFrame(flat, [0, 0], camera, target);
  const engine = new SoftFollow();
  const dir = camera.quaternion.clone();
  const original = camera.position.clone(), before = camera.position.clone();
  const offset = camera.position.clone().sub(target);
  const subject = new Vector3(22, 1.08, 8);
  let maxStep = 0;
  for (let i = 0; i < 180; i++) {
    before.copy(camera.position);
    engine.advance(1 / 60, camera, target, subject, flat, true);
    maxStep = Math.max(maxStep, before.distanceTo(camera.position));
  }
  expect(maxStep).toBeLessThan(.47 / 60 + .00001);
  expect(camera.position.distanceTo(original)).toBeGreaterThan(.15);
  expect(camera.position.clone().sub(target).distanceTo(offset)).toBeLessThan(1e-9);
  expect(camera.quaternion.toArray()).toEqual(dir.toArray());
  expect(camera.zoom).toBe(1);
  expect(camera.fov).toBe(40);
});

it('restores a user framing across editor and inspection camera changes', () => {
  const camera = new PerspectiveCamera(44, 1.75, .15, 170), target = new Vector3(1, 2, 3);
  camera.position.set(14, 13, 28);
  camera.zoom = 1.4;
  const view = captureView(camera, target);
  residentFrame(flat, [-5, 2], camera, target);
  camera.zoom = .7;
  showView(camera, target, view);
  expect(captureView(camera, target)).toEqual(view);
});
