import type { Vector3 } from 'three';
import { clamp, mix } from '../core/random';
import type { MotionPose } from './motion';
import { worldBounds } from './terrain';
import type { Terrain } from './terrain';

export type CameraMode = 'Landscape' | 'Wander' | 'Follow';

export function landscapeFrame(terrain: Terrain, portrait: boolean, position: Vector3, target: Vector3) {
  target.set(0, terrain.height(0, -6) + 1.25, -6);
  position.set(portrait ? 12 : 15, terrain.height(10, 24) + (portrait ? 11.8 : 9.5), portrait ? 30 : 25);
}

export function wanderFrame(time: number, terrain: Terrain, position: Vector3, target: Vector3) {
  const journey = time / 26;
  const i = Math.floor(journey);
  const path = terrain.points;
  const a = path[i % path.length].position, b = path[(i + 1) % path.length].position;
  const f = journey - i, blend = f * f * (3 - 2 * f);
  const x = mix(a[0], b[0], blend), z = mix(a[1], b[1], blend);
  const swing = Math.sin(journey * .61) * 9;
  target.set(x, terrain.height(x, z) + 1.4, z);
  position.set(x + 13 + swing, target.y + 10.0 + Math.cos(journey * .45) * 1.1, z + 24 - swing * .25);
}

export function followFrame(pose: MotionPose, heading: number, terrain: Terrain, position: Vector3, target: Vector3) {
  const dx = Math.cos(heading), dz = -Math.sin(heading);
  const x = pose.x, z = pose.z;
  const h = terrain.height(x, z);
  target.set(x + dx * 1.15, h + 1.1, z + dz * 1.15);
  position.set(x - dx * 7.1 + dz * 3.7, h + 4.1, z - dz * 7.1 - dx * 3.7);
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
