import type { ObjectKind, WorldDocument, WorldObject } from '../world/document';
import { newObject, objectLimit, transformObject } from '../world/document';
import type { GroundPoint } from '../motion';
import { worldBounds } from '../terrain';

export const brushSeed = (kind: ObjectKind) => 'MAKE/' + kind;

export const objectSizes = { Small: .65, Medium: 1.2, Large: 2.3 } as const;

export function makeBrush(kind: ObjectKind) {
  return transformObject(newObject(kind, brushSeed(kind), 'placement-preview'), { scale: objectSizes.Medium });
}

export function stampObject(document: WorldDocument, brush: WorldObject, point: GroundPoint) {
  if (document.objects.length >= objectLimit || !onLand(point)) return undefined;
  return transformObject({ ...brush, id: crypto.randomUUID() }, { x: point[0], z: point[1] });
}

export function onLand(point: GroundPoint) {
  return Math.abs(point[0]) <= worldBounds.x && Math.abs(point[1]) <= worldBounds.z;
}
