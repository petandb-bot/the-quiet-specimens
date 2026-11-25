import { specimenProfile } from '../specimens/profiles';
import { waterHeight } from '../environment/land-edits';
import { toleratesWater } from '../motion';
import { clamp } from '../../core/random';
import type { GardenSpecimen } from '../genome';
import { bodyPlans } from '../morphology';
import type { GroundPoint } from '../motion';
import type { Terrain } from '../terrain';
import { worldBounds } from '../terrain';
import { layoutPoints } from './document';
import type { WorldDocument } from './document';

export function worldField(world: WorldDocument, terrain: Terrain) {
  const obstacles = world.objects.filter(item => !item.distant && item.height < 2.4);
  const water = waterDepth(world, terrain);
  const points = layoutPoints(world, terrain);
  return { obstacles, points, field: { bounds: worldBounds, height: terrain.height, slope: terrain.slope, points, water } };
}

function waterDepth(world: WorldDocument, terrain: Terrain) {
  const regions = world.personalLand?.water;
  return regions?.length ? (x: number, z: number) => waterHeight(regions, terrain.height, x, z) - terrain.height(x, z) : undefined;
}

export function safePosition(point: GroundPoint, specimen: GardenSpecimen, terrain: Terrain, world: WorldDocument, searchField = false): GroundPoint | undefined {
  const plan = specimen.genome.plan;
  const radius = bodyPlans[plan].radius(specimen.genome) * specimenProfile(specimen.size).scale;
  const inset = Math.max(0, radius - .75);
  const limit = worldBounds.x - inset - .35;
  const x = clamp(point[0], -limit, limit), z = clamp(point[1], -limit, limit);
  const obstacles = world.objects.filter(item => !item.distant && item.height < 2.4);
  const water = waterDepth(world, terrain);
  const viable = (x: number, z: number) => toleratesWater(plan, water?.(x, z) ?? 0) && (plan === 'VESSEL' || terrain.slope(x, z) < (plan === 'HINGE' ? .56 : .73))
    && !obstacles.some(item => Math.hypot(x - item.x, z - item.z) < item.radius + radius * .75);
  if (viable(x, z)) return [x, z];
  for (let ring = 1; ring <= 7; ring++) {
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const a = x + Math.cos(angle) * ring, b = z + Math.sin(angle) * ring;
      if (Math.abs(a) <= limit && Math.abs(b) <= limit && viable(a, b)) return [a, b];
    }
  }
  if (searchField) {
    let nearest: GroundPoint | undefined, distance = Infinity;
    for (let a = -Math.floor(limit); a <= limit; a++) for (let b = -Math.floor(limit); b <= limit; b++) {
      const gap = (a - x) ** 2 + (b - z) ** 2;
      if (gap < distance && viable(a, b)) { nearest = [a, b]; distance = gap; }
    }
    return nearest;
  }
  return undefined;
}
