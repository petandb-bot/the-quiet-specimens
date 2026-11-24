import { clamp, random } from '../../core/random';
import type { GroundPoint } from '../motion';
import { newObject, objectLimit, transformObject } from '../world/document';
import type { WorldDocument, WorldObject } from '../world/document';
import type { LayerRecipe } from './settings';
import { styles } from './styles';
import type { Composition } from './styles';

type Random = ReturnType<typeof random>;

function sample(pattern: Composition, rng: Random, index: number, groupCount: number): GroundPoint {
  const offset = (amount: number) => rng.range(-amount, amount);
  const angle = index / groupCount * Math.PI * 2 + offset(.26);
  const radius = rng.range(15, 25);
  switch (pattern) {
    case 'Sparse': return [Math.cos(angle) * radius, Math.sin(angle) * radius - 3];
    case 'Cluster': {
      const group = index % 3;
      const center = [[-13, -5], [11, -13], [13, 11]][group];
      return [center[0] + offset(6.5), center[1] + offset(6.5)];
    }
    case 'Axis': {
      const station = (index - (groupCount - 1) / 2) * 4.4;
      return [station * .85 + offset(3), station * -.53 + (index % 2 ? 8 : -8) + offset(3)];
    }
    case 'Perimeter': return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    case 'Asymmetric': return [rng.range(index < 3 ? 2 : -23, index < 3 ? 22 : -7), rng.range(-24, 15)];
    case 'Monumental': {
      if (index === 0) return [-11 + offset(2), -9 + offset(3)];
      if (index === 1) return [13 + offset(3), -25 + offset(3)];
      return [Math.cos(angle) * radius, Math.sin(angle) * radius - 6];
    }
    case 'Distributed': return [offset(23), offset(23) - 3];
  }
}

export function keepAuthoredStructures(world: WorldDocument) {
  const links = new Set(world.places.map(place => place.linkedObjectId));
  return world.objects.filter(item => item.layoutIndex === undefined || item.edited || links.has(item.id));
}

export function generateStructures(world: WorldDocument, recipe: LayerRecipe, density = .5): readonly WorldObject[] {
  const retained = keepAuthoredStructures(world);
  const excluded = new Set([...retained.map(item => item.id), ...world.suppressed]);
  const { pattern, count: baseCount, scale, kinds, finishes } = styles[recipe.style].structures;
  const count = Math.min(13, Math.round(baseCount * (.58 + density * .84)));
  const rng = random('world/structures/1/' + recipe.style + '/' + recipe.seed);
  const placed: WorldObject[] = [];
  for (let index = 0; index < count && placed.length + retained.length < objectLimit; index++) {
    const id = 'playground/' + index;
    if (excluded.has(id)) continue;
    const kind = index === 0 && pattern === 'Monumental' ? 'monolith' : rng.pick(kinds);
    const shape = newObject(kind, ('world/' + recipe.seed).slice(0, 145) + '/' + index, id);
    const size = clamp(scale * (pattern === 'Monumental' && index < 2 ? 1.53 : rng.range(.68, 1.36)), .45, 4);
    const finish = rng.pick(finishes);
    const yaw = pattern === 'Axis' ? rng.range(.24, .62) : rng.range(-1.1, 1.1);
    for (let attempt = 0; attempt < 28; attempt++) {
      const [x, z] = attempt < 18 ? sample(pattern, rng, index, count) : sample('Distributed', rng, index, count);
      const candidate = transformObject(shape, { x, z, scale: size, finish, yaw });
      if (Math.max(Math.abs(x), Math.abs(z)) + candidate.radius > 29
        || Math.hypot(x, z + 2) < 5.1 + candidate.radius
        || [...retained, ...placed].some(item => Math.hypot(x - item.x, z - item.z) < item.radius + candidate.radius + .7)) continue;
      placed.push({ ...candidate, layoutIndex: index, edited: undefined });
      break;
    }
  }
  return [...placed, ...retained];
}
