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
  const points = layoutPoints(world, terrain);
  return { obstacles, points, field: { bounds: worldBounds, height: terrain.height, slope: terrain.slope, points } };
}

export function safePosition(point: GroundPoint, specimen: GardenSpecimen, terrain: Terrain, world: WorldDocument): GroundPoint | undefined {
  const plan = specimen.genome.plan;
  const radius = bodyPlans[plan].radius(specimen.genome);
  const inset = Math.max(0, radius - .75);
  const limit = worldBounds.x - inset - .35;
  const x = clamp(point[0], -limit, limit), z = clamp(point[1], -limit, limit);
  const obstacles = world.objects.filter(item => !item.distant && item.height < 2.4);
  const viable = (x: number, z: number) => (plan === 'VESSEL' || terrain.slope(x, z) < (plan === 'HINGE' ? .56 : .73))
    && !obstacles.some(item => Math.hypot(x - item.x, z - item.z) < item.radius + radius * .75);
  if (viable(x, z)) return [x, z];
  for (let ring = 1; ring <= 7; ring++) {
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const a = x + Math.cos(angle) * ring, b = z + Math.sin(angle) * ring;
      if (Math.abs(a) <= limit && Math.abs(b) <= limit && viable(a, b)) return [a, b];
    }
  }
  return undefined;
}
