import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { clamp, mix } from '../core/random';
import type { GroundPoint } from './motion';
import { worldBounds } from './terrain';
import type { Terrain } from './terrain';

export type CameraMode = 'Fixed' | 'Landscape' | 'Soft Follow' | 'Observatory' | 'Atlas';
export type ObservationView = { position: [number, number, number]; target: [number, number, number]; zoom: number; fov: number };

export function captureView(camera: PerspectiveCamera, target: Vector3): ObservationView {
  return { position: camera.position.toArray(), target: target.toArray(), fov: camera.fov, zoom: camera.zoom };
}

export function showView(camera: PerspectiveCamera, target: Vector3, frame: ObservationView) {
  camera.position.fromArray(frame.position);
  target.fromArray(frame.target);
  camera.fov = frame.fov;
  camera.zoom = frame.zoom;
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

export function landscapeFrame(terrain: Terrain, portrait: boolean, position: Vector3, target: Vector3) {
  target.set(0, terrain.height(0, -6) + 1.25, -6);
  position.set(portrait ? 12 : 15, terrain.height(10, 24) + (portrait ? 11.8 : 9.5), portrait ? 30 : 25);
}

export function residentFrame(terrain: Terrain, point: GroundPoint, camera: PerspectiveCamera, target: Vector3) {
  const [x, z] = point;
  const h = terrain.height(x, z);
  target.set(x, h + 1.08, z);
  camera.position.set(x + 6.2, h + 4.5, z + 10.8);
  const rise = keptAboveLand(camera.position, terrain) - camera.position.y;
  camera.position.y += rise;
  target.y += rise;
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

export class SoftFollow {
  private velocity = new Vector3();
  private projected = new Vector3();
  private push = new Vector3();
  private edge = new Vector3();
  private step = new Vector3();

  reset() { this.velocity.set(0, 0, 0); }

  advance(dt: number, camera: PerspectiveCamera, target: Vector3, subject: Vector3, terrain: Terrain, reduce: boolean) {
    const elapsed = clamp(dt, 0, .12);
    if (!elapsed) return;
    const boxX = reduce ? .68 : .48, boxY = reduce ? .61 : .38;
    const p = this.projected.copy(subject).project(camera);
    if (Math.abs(p.x) <= boxX && Math.abs(p.y) <= boxY && p.z >= -1 && p.z <= 1) {
      this.reset();
      return;
    }

    if (p.z > 1 || p.z < -1 || !Number.isFinite(p.x)) this.push.copy(subject).sub(target);
    else {
      this.edge.set(clamp(p.x, -boxX, boxX), clamp(p.y, -boxY, boxY), p.z).unproject(camera);
      this.push.copy(subject).sub(this.edge);
    }
    this.push.y = 0;
    const speed = reduce ? .47 : .90;
    this.push.multiplyScalar(1.8).clampLength(0, speed);
    // Limit acceleration separately from speed. A tiny overflow cannot build momentum.
    this.step.copy(this.push).sub(this.velocity).clampLength(0, elapsed * (reduce ? .55 : .94));
    this.velocity.add(this.step).clampLength(0, Math.min(speed, this.push.length()));
    this.step.copy(this.velocity).multiplyScalar(elapsed);
    this.edge.copy(camera.position).add(this.step);
    const clearance = keptAboveLand(this.edge, terrain) - camera.position.y;
    if (clearance > .001) {
      this.step.set(0, Math.min(clearance, elapsed * .56), 0);
      this.reset();
    }
    camera.position.add(this.step);
    target.add(this.step);
    // The orientation and lens are constant. Only the whole frame can translate.
    camera.updateMatrixWorld();
  }
}

export function boundLandscapePan(position: Vector3, target: Vector3, terrain: Terrain) {
  const x = clamp(target.x, -worldBounds.x, worldBounds.x);
  const z = clamp(target.z, -worldBounds.z, worldBounds.z);
  position.x += x - target.x;
  position.z += z - target.z;

  const floor = terrain.height(x, z);
  const offsetY = position.y - target.y;
  const lowest = Math.max(floor + .42, landClearance(position, terrain) - offsetY);
  const y = clamp(target.y, lowest, Math.max(lowest, floor + 14));

  // Translate both endpoints so clipping the pan cannot turn or dolly the camera.
  position.y += y - target.y;
  target.set(x, y, z);
}

export function keptAboveLand(position: Vector3, terrain: Terrain, target?: Vector3) {
  return Math.max(position.y, landClearance(position, terrain, target));
}

function landClearance(position: Vector3, terrain: Terrain, target?: Vector3) {
  let y = terrain.height(position.x, position.z) + 1.75;
  for (const item of terrain.landmarks) {
    const reach = item.radius + 2.6;
    const distance = Math.hypot(position.x - item.x, position.z - item.z);
    if (distance >= reach) continue;
    const fade = 1 - clamp((distance - item.radius) / (reach - item.radius));
    const top = terrain.height(item.x, item.z) + (item.height ?? 0) + item.scale * (item.kind === 'stones' ? 1.25 : 4.65);
    y = Math.max(y, mix(y, top + 1.1, fade * fade));
  }
  if (target) {
    for (let i = 2; i < 6; i++) {
      const fraction = i / 6;
      const x = mix(target.x, position.x, fraction), z = mix(target.z, position.z, fraction);
      const ridge = terrain.height(x, z) + .65;
      y = Math.max(y, target.y + (ridge - target.y) / fraction);
    }
  }
  return y;
}
