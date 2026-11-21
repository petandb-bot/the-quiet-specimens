import type { Finish, ObjectKind, WorldDocument, WorldObject } from '../world/document';
import { newObject, objectLimit, transformObject } from '../world/document';
import type { GroundPoint } from '../motion';
import { worldBounds } from '../terrain';

export const brushSeed = (kind: ObjectKind) => 'MAKE/' + kind;

export const swatches: Record<Finish, string> = {
  Original: '#d3c4a4', Chalk: '#e7e2d1', Oxide: '#b26d4b', Mineral: '#748690', Jade: '#698879',
};

export function stampObject(document: WorldDocument, brush: WorldObject, point: GroundPoint) {
  if (document.objects.length >= objectLimit || !onLand(point)) return undefined;
  return transformObject(newObject(brush.kind, brush.seed), { x: point[0], z: point[1] });
}

export function onLand(point: GroundPoint) {
  return Math.abs(point[0]) <= worldBounds.x && Math.abs(point[1]) <= worldBounds.z;
}
