import { clamp, random } from '../../core/random';
import type { GroundPoint } from '../motion';
import type { Terrain } from '../terrain';
import { newObject, objectLimit, transformObject } from '../world/document';
import type { WorldObject } from '../world/document';

export const colonyPatterns = ['Cluster', 'Ring', 'Growth', 'Gradient', 'Debris'] as const;
export type ColonyPattern = typeof colonyPatterns[number];
export type ColonySettings = { mode: 'Scatter' | 'Colony'; area: number; density: number; variation: number; pattern: ColonyPattern };

export function placeColony(brush: WorldObject, center: GroundPoint, settings: ColonySettings,
  occupied: readonly WorldObject[], terrain: Terrain, identity: () => string = () => crypto.randomUUID()) {
  const rng = random('colony/1/' + brush.seed + '/' + settings.mode + '/' + settings.pattern);
  const count = Math.min(objectLimit - occupied.length, Math.round(3 + settings.density * 11));
  const results: WorldObject[] = [];
  const axis = rng.range(0, 2 * Math.PI);
  for (let i = 0; i < count * 10 && results.length < count; i++) {
    const t = (i % count) / Math.max(1, count - 1);
    let angle = rng.range(0, 2 * Math.PI), ratio = Math.sqrt(rng.next()), scale = rng.range(.65, 1.22);
    if (settings.mode === 'Colony') {
      switch (settings.pattern) {
        case 'Cluster': angle = axis + (i % 3) * 2.1 + rng.range(-.48, .48); ratio = rng.range(.26, .82); break;
        case 'Ring': angle = axis + t * 5.65 + rng.range(-.21, .21); ratio = rng.range(.66, .86); break;
        case 'Growth': angle = axis + (i % 2 ? .94 : -.83) * t + rng.range(-.43, .43); ratio = clamp(.13 + t * .82 + rng.range(-.13, .13)); scale = 1.21 - t * .64; break;
        case 'Gradient': angle = axis + (t - .5) * 3.2 + rng.range(-.36, .36); ratio = clamp(t * .52 + rng.range(.22, .50)); scale = 1.32 - t * .83; break;
        case 'Debris': angle = axis + rng.range(-.94, .94); ratio = rng.range(.18, .92); scale = rng.range(.40, 1.14); break;
      }
    }
    const seed = brush.seed.slice(0, 100) + '/' + i;
    const shape = newObject(brush.kind, settings.variation > .05 ? seed : brush.seed, 'candidate');
    const size = clamp(brush.scale * (1 + (scale - 1) * settings.variation), .3, 4);
    const reach = settings.area - shape.radius / shape.scale * size;
    if (reach <= 0) continue;
    const x = center[0] + Math.cos(angle) * ratio * reach, z = center[1] + Math.sin(angle) * ratio * reach;
    const object = transformObject(shape, { scale: size, x, z, finish: brush.finish, yaw: angle });
    if (Math.max(Math.abs(x), Math.abs(z)) + object.radius > 30 || terrain.slope(x, z) > .95
      || [...occupied, ...results].some(other => !other.distant && Math.hypot(x - other.x, z - other.z) < other.radius + object.radius + .32)) continue;
    results.push({ ...object, id: identity() });
  }
  return results;
}
