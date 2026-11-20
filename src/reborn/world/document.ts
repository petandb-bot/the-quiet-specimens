import { clamp, random } from '../../core/random';
import type { GardenSpecimen } from '../genome';
import type { GroundPoint } from '../motion';
import { defaultImage } from './image-settings';
import type { ImageSettings } from './image-settings';
import { defaultLand, makeTerrain, worldBounds } from '../terrain';
import type { LandSettings, Terrain } from '../terrain';
import type { Landmark, PointOfInterest } from '../composition';

export const objectKinds = ['arch', 'monolith', 'ring', 'stones', 'flora', 'kinetic'] as const;
export const placeRoles = ['Neutral', 'Shelter', 'Curiosity', 'Gathering', 'Quiet'] as const;
export const objectLimit = 40;
export const placeLimit = 24;
export type ObjectKind = typeof objectKinds[number];
export type PlaceRole = typeof placeRoles[number];
export type Finish = 'Original' | 'Chalk' | 'Oxide' | 'Mineral' | 'Jade';
export const finishes: Finish[] = ['Original', 'Chalk', 'Oxide', 'Mineral', 'Jade'];
export interface WorldObject extends Omit<Landmark, 'kind'> {
  kind: ObjectKind;
  seed: string;
  height: number;
  finish: Finish;
  layoutIndex?: number;
  sourceForm?: number;
  edited?: true;
}
export interface Place {
  id: string;
  name: string;
  role: PlaceRole;
  x: number;
  z: number;
  radius: number;
  influence: number;
  linkedObjectId?: string;
  enabled: boolean;
}
export interface WorldResident {
  specimen: GardenSpecimen;
  home?: GroundPoint;
  preferred?: GroundPoint;
  start?: GroundPoint;
}
export interface WorldDocument {
  schemaVersion: 1;
  generatorVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  land: Terrain['settings'];
  objects: readonly WorldObject[];
  suppressed: readonly string[];
  places: readonly Place[];
  residents: readonly WorldResident[];
  image: ImageSettings;
}

export const objectTitle = (kind: ObjectKind) => ({ arch: 'Arch', monolith: 'Monolith', ring: 'Ring', stones: 'Stones', flora: 'Flora', kinetic: 'Kinetic' })[kind];

export function landmarksFor(terrain: Terrain): WorldObject[] {
  return terrain.landmarks.map((item, index) => ({
    ...item, seed: terrain.settings.seed + '/' + item.id, finish: 'Original', height: 0, layoutIndex: index, sourceForm: index,
  }));
}

export function createWorld(terrain: Terrain, residents: readonly WorldResident[] = [], id: string = crypto.randomUUID()): WorldDocument {
  const time = new Date().toISOString();
  return { schemaVersion: 1, generatorVersion: 1, id, name: 'Elsewhere', createdAt: time, updatedAt: time,
    land: terrain.settings, objects: landmarksFor(terrain), suppressed: [], places: [], residents, image: { ...defaultImage } };
}

export function changeLand(world: WorldDocument, settings: LandSettings) {
  const terrain = makeTerrain(settings);
  const preserved = world.objects.filter(item => item.layoutIndex === undefined || item.edited);
  const kept = new Set([...world.suppressed, ...preserved.map(item => item.id)]);
  const generated = landmarksFor(terrain).filter(item => !kept.has(item.id));
  return { ...world, land: terrain.settings, objects: [...generated.slice(0, objectLimit - preserved.length), ...preserved] };
}

export function newObject(kind: ObjectKind, seed: string, id: string = crypto.randomUUID()): WorldObject {
  const rng = random('place-object/1/' + seed);
  const scale = rng.range(.85, 1.65);
  return { id, kind, seed, x: 0, z: 0, yaw: rng.range(-.45, .45), scale, height: 0, distant: false,
    radius: scale * footprint(kind), finish: 'Original' };
}

const footprint = (kind: ObjectKind) => ({ arch: 1.4, monolith: 1.27, ring: 1.32, stones: 1.67, flora: .95, kinetic: 1.28 })[kind];

export function transformObject(item: WorldObject, delta: Partial<Pick<WorldObject, 'x' | 'z' | 'yaw' | 'scale' | 'height' | 'finish' | 'seed'>>): WorldObject {
  const next = { ...item, ...delta, edited: true as const };
  const limit = item.distant ? 112 : worldBounds.x;
  next.x = clamp(Number.isFinite(next.x) ? next.x : item.x, -limit, limit);
  next.z = clamp(Number.isFinite(next.z) ? next.z : item.z, -limit, limit);
  next.distant = item.distant && (Math.abs(next.x) > worldBounds.x || Math.abs(next.z) > worldBounds.z);
  next.scale = clamp(Number.isFinite(next.scale) ? next.scale : item.scale, .25, 4);
  next.height = clamp(Number.isFinite(next.height) ? next.height : item.height, 0, 9);
  next.yaw = Number.isFinite(next.yaw) ? Math.atan2(Math.sin(next.yaw), Math.cos(next.yaw)) : item.yaw;
  next.radius = item.radius * next.scale / item.scale;
  return next;
}

export function removeObject(world: WorldDocument, item: WorldObject): WorldDocument {
  return { ...world, objects: world.objects.filter(object => object.id !== item.id),
    suppressed: item.layoutIndex === undefined ? world.suppressed : [...world.suppressed, item.id],
    places: world.places.map(place => place.linkedObjectId === item.id
      ? { ...place, x: item.x, z: item.z, linkedObjectId: undefined } : place),
  };
}

export function placeCenter(place: Place, objects: readonly WorldObject[]): GroundPoint {
  const parent = place.linkedObjectId && objects.find(item => item.id === place.linkedObjectId);
  return parent ? [parent.x, parent.z] : [place.x, place.z];
}

export function layoutPoints(world: WorldDocument, terrain: Terrain) {
  const points: PointOfInterest[] = [];
  for (const item of world.objects) {
    if (item.layoutIndex === undefined || item.distant || world.places.some(place => place.linkedObjectId === item.id && place.enabled)) continue;
    const bearing = item.yaw + 1.2;
    const distance = item.radius + 2.25;
    points.push({ id: item.id, shelter: item.kind === 'arch' || item.kind === 'stones' ? .9 : .36, position: [
      clamp(item.x + Math.cos(bearing) * distance, -25, 25), clamp(item.z + Math.sin(bearing) * distance, -25, 25),
    ] });
  }
  points.push({ id: 'open-reach', shelter: .16, position: [2, -10] });
  for (const place of world.places) {
    if (!place.enabled || place.role === 'Neutral' || place.influence <= 0) continue;
    const center = placeCenter(place, world.objects);
    const linked = world.objects.find(item => item.id === place.linkedObjectId);
    const minDistance = linked ? linked.radius + 1.4 : 0;
    let position = center;
    if (minDistance > 0) {
      let best = Infinity;
      for (let i = 0; i < 12; i++) {
        const bearing = i * Math.PI / 6 + (linked?.yaw ?? 0);
        const x = center[0] + Math.cos(bearing) * minDistance;
        const z = center[1] + Math.sin(bearing) * minDistance;
        if (Math.abs(x) > 29 || Math.abs(z) > 29) continue;
        const score = terrain.slope(x, z) + world.objects.reduce((cost, item) => cost +
          Math.max(0, item.radius + .7 - Math.hypot(item.x - x, item.z - z)) * 5, 0);
        if (score < best) { position = [x, z]; best = score; }
      }
    }
    points.push({ id: place.id, position, center, radius: place.radius, weight: place.influence, role: place.role,
      shelter: place.role === 'Shelter' ? .98 : place.role === 'Quiet' ? .72 : .38 });
  }
  return points;
}
