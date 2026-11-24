import { finishes, objectKinds, objectLimit, placeLimit, placeRoles } from './document';
import type { WorldDocument } from './document';
import { gardenMaterials, gardenPlans } from '../genome';
import { terrainKinds } from '../terrain';

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
const within = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const unit = (value: unknown) => within(value, 0, 1);
const member = (value: unknown, choices: readonly string[]) => typeof value === 'string' && choices.includes(value);
const point = (value: unknown) => value === undefined || (Array.isArray(value) && value.length === 2 && value.every(n => within(n, -30, 30)));
const iso = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
function dateRecord(value: Record<string, unknown>) {
  return iso(value.createdAt) && iso(value.updatedAt);
}

export function isWorldDocument(value: unknown): value is WorldDocument {
  if (!record(value) || value.schemaVersion !== 1 || value.generatorVersion !== 1 || !text(value.id)
    || !text(value.name) || !dateRecord(value)) return false;
  const { land, image, objects, places, residents, suppressed } = value;
  if (!record(land) || !text(land.seed) || !member(land.kind, terrainKinds)
    || ![land.elevation, land.roughness, land.openness, land.density].every(unit)) return false;
  if (!record(image) || !member(image.mode, ['Atmosphere', 'Backdrop']) || !within(image.scale, 1, 2.5)
    || !within(image.x, -1, 1) || !within(image.y, -1, 1)
    || ![image.horizon, image.blur, image.color, image.ground].every(unit)) return false;
  if (!Array.isArray(objects) || objects.length > objectLimit || !Array.isArray(places) || places.length > placeLimit
    || !Array.isArray(residents) || residents.length > 9 || !Array.isArray(suppressed) || suppressed.length > 16 || !suppressed.every(text)) return false;

  const ids = new Set<string>();
  for (const item of objects) {
    if (!record(item) || !text(item.id) || ids.has(item.id) || !text(item.seed) || !member(item.kind, objectKinds)
      || !member(item.finish, finishes) || typeof item.distant !== 'boolean'
      || !within(item.x, item.distant ? -112 : -30, item.distant ? 112 : 30)
      || !within(item.z, item.distant ? -112 : -30, item.distant ? 112 : 30)
      || !within(item.scale, .25, 4.1) || !within(item.height, 0, 9) || !within(item.radius, .15, 9) || !within(item.yaw, -Math.PI, Math.PI)
      || (item.layoutIndex !== undefined && !within(item.layoutIndex, 0, 12))
      || (item.sourceForm !== undefined && !within(item.sourceForm, 0, 12))
      || (item.appearance !== undefined && item.appearance !== 2)
      || (item.edited !== undefined && item.edited !== true)) return false;
    ids.add(item.id);
  }
  const placeIds = new Set<string>();
  for (const item of places) {
    if (!record(item) || !text(item.id) || placeIds.has(item.id) || !text(item.name)
      || !within(item.x, -112, 112) || !within(item.z, -112, 112) || !member(item.role, placeRoles)
      || !within(item.radius, 1, 15) || !unit(item.influence) || typeof item.enabled !== 'boolean'
      || (item.linkedObjectId !== undefined && (!text(item.linkedObjectId) || !ids.has(item.linkedObjectId)))) return false;
    placeIds.add(item.id);
  }
  const seeds = new Set<string>();
  for (const item of residents) {
    if (!record(item) || !point(item.home) || !point(item.preferred) || !point(item.start)
      || !record(item.specimen) || !text(item.specimen.name) || !record(item.specimen.genome)) return false;
    const g = item.specimen.genome;
    if (!text(g.seed) || seeds.has(g.seed) || !member(g.plan, gardenPlans) || !member(g.material, gardenMaterials)
      || !Array.isArray(g.palette) || g.palette.length !== 3 || !g.palette.every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
      || !within(g.modules, 3, 8) || !within(g.proportion, .68, 1.35) || !within(g.gait, .45, 1.4)
      || ![g.curvature, g.asymmetry, g.aperture, g.curiosity, g.caution, g.patience].every(unit) || !record(g.sound)) return false;
    const sound = g.sound;
    if (!member(sound.engine, ['Hollow Pulse', 'Thin Membrane', 'Metallic Residue', 'Soft Debris'])
      || !Array.isArray(sound.pitches) || sound.pitches.length < 1 || sound.pitches.length > 16
      || !sound.pitches.every(pitch => within(pitch, -48, 48)) || !within(sound.register, 45, 1_000)
      || !within(sound.envelope, .15, 5) || !within(sound.interval, .3, 20) || !within(sound.spatial, -1, 1)
      || ![sound.harmonics, sound.modulation, sound.noise, sound.probability, sound.resonance, sound.response].every(unit)) return false;
    seeds.add(g.seed);
  }
  return true;
}
