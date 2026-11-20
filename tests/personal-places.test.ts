import { expect, it } from 'vitest';
import { Mesh, Scene } from 'three';
import { gardenReferences } from '../src/reborn/genome';
import { buildLandscape } from '../src/reborn/landscape';
import { GardenMotion } from '../src/reborn/motion';
import { makeArtifact } from '../src/reborn/objects/render';
import { defaultLand, makeTerrain } from '../src/reborn/terrain';
import { changeLand, createWorld, layoutPoints, newObject, placeCenter, removeObject, transformObject } from '../src/reborn/world/document';
import type { Place } from '../src/reborn/world/document';
import { WorldHistory } from '../src/reborn/world/history';
import { safePosition, worldField } from '../src/reborn/world/runtime';
import { isWorldDocument } from '../src/reborn/world/validation';

it('round-trips the original world as data and validates references, version and finite values', () => {
  const terrain = makeTerrain(defaultLand);
  const world = createWorld(terrain, [{ specimen: gardenReferences[0] }], 'example');
  const restored = JSON.parse(JSON.stringify(world));
  expect(isWorldDocument(restored)).toBe(true);
  expect(restored).toEqual(world);
  expect(isWorldDocument({ ...world, schemaVersion: 8 })).toBe(false);
  expect(isWorldDocument({ ...world, objects: [...world.objects, world.objects[0]] })).toBe(false);
  expect(isWorldDocument({ ...world, land: { ...world.land, elevation: Infinity } })).toBe(false);
  expect(layoutPoints(restored, terrain)).toEqual(terrain.points);
});

it('preserves edits and removals to generated landmarks across regeneration and bounded undo', () => {
  const world = createWorld(makeTerrain(defaultLand));
  const history = new WorldHistory(world);
  const [arch, monolith] = world.objects;
  const far = world.objects.find(item => item.distant)!;
  const broughtNear = transformObject(far, { x: 16, z: 18 });
  expect(broughtNear.distant).toBe(false);
  const moved = transformObject(arch, { x: 19, scale: 2, height: .55, yaw: 1.5 });
  const next = removeObject(removeObject({ ...world, objects: [moved, ...world.objects.slice(1)] }, monolith), far);
  expect(history.commit(next)).toBe(true);
  const regenerated = changeLand(history.value, { ...defaultLand, seed: 'NEW-LAND', density: 1 });
  expect(regenerated.objects.find(item => item.id === arch.id)).toBe(moved);
  expect(regenerated.objects.some(item => item.id === monolith.id)).toBe(false);
  expect(regenerated.objects.some(item => item.id === far.id)).toBe(false);
  expect(history.commit(regenerated)).toBe(true);
  expect(history.undo()).toBe(true);
  expect(history.value.land.seed).toBe(defaultLand.seed);
  expect(history.undo()).toBe(true);
  expect(history.value.objects[0]).toBe(arch);
  expect(history.changed).toBe(false);
  expect(history.redo()).toBe(true);
  for (let i = 0; i < 60; i++) history.commit({ ...history.value, name: 'Revision ' + i });
  expect(history.canRedo).toBe(false);
  let undone = 0;
  while (history.undo()) undone++;
  expect(undone).toBe(48);
});

it('generates finite seeded forms and moves the same mesh on the live ground', () => {
  for (const kind of ['arch', 'flora', 'kinetic'] as const) {
    const original = makeArtifact(newObject(kind, 'object-alpha'));
    const repeated = makeArtifact(newObject(kind, 'object-alpha'));
    const changed = makeArtifact(newObject(kind, 'object-beta'));
    const vertices = (group: typeof original.group) => {
      const values: number[] = [];
      group.traverse(node => { if (node instanceof Mesh) values.push(...node.geometry.attributes.position.array); });
      return values;
    };
    const shape = vertices(original.group);
    expect(shape.every(Number.isFinite)).toBe(true);
    expect(shape).toEqual(vertices(repeated.group));
    expect(shape).not.toEqual(vertices(changed.group));
    original.dispose(); repeated.dispose(); changed.dispose();
  }
  const scene = new Scene();
  const landscape = buildLandscape(scene, defaultLand);
  const world = createWorld(landscape.terrain);
  const item = newObject('kinetic', 'orbit');
  const next = transformObject(item, { x: 6, z: -6, scale: 3, height: .8 });
  landscape.objects.update([item]);
  const [group] = landscape.objects.groups();
  landscape.objects.update([next]);
  expect(landscape.objects.groups()[0]).toBe(group);
  expect(group.position.y).toBeCloseTo(landscape.terrain.height(6, -6) + .8);
  expect(next.radius / item.radius).toBeCloseTo(next.scale / item.scale);
  landscape.dispose();
});

it('links places to moving forms, prunes only invalidated visits and retains living poses', () => {
  const terrain = makeTerrain({ ...defaultLand, elevation: 0 });
  const formed = transformObject(newObject('flora', 'branch'), { x: 5, z: 4 });
  const shelter: Place = { id: 'quiet-shelter', name: 'Flora shelter', role: 'Shelter', enabled: true,
    radius: 6, influence: .8, x: 2, z: 1, linkedObjectId: formed.id };
  const active = { ...createWorld(terrain), objects: [formed], places: [shelter] };
  const { obstacles, field } = worldField(active, terrain);
  expect(field.points.find(item => item.id === shelter.id)?.center).toEqual([5, 4]);
  const specimen = gardenReferences[6];
  const creature = new GardenMotion(specimen.genome, [1, 1], obstacles, 1, field);
  const habitat = creature.territory!;
  expect(habitat.choose([1, 1], 100).interest).toBe(shelter.id);
  habitat.arrived({ intent: 'Inspect Object', point: [4, 4], interest: shelter.id }, 1);
  habitat.arrived({ intent: 'Explore', point: [-5, -3] }, 2);
  const moved = transformObject(formed, { x: 9 });
  const movedWorld = { ...active, objects: [moved] };
  const updated = worldField(movedWorld, terrain);
  const oldPose = [creature.pose.x, creature.pose.z];
  creature.updateEnvironment(updated.obstacles, updated.field);
  expect([creature.pose.x, creature.pose.z]).toEqual(oldPose);
  expect(habitat.recentVisits(2).some(visit => visit.interest === shelter.id)).toBe(false);
  expect(habitat.recentVisits(2).some(visit => visit.point[0] === -5)).toBe(true);
  expect(placeCenter(shelter, [moved])).toEqual([9, 4]);
  const without = removeObject(movedWorld, moved);
  expect(without.places[0].linkedObjectId).toBeUndefined();
  expect(placeCenter(without.places[0], without.objects)).toEqual([9, 4]);
  const safe = safePosition([9, 4], specimen, terrain, movedWorld)!;
  expect(Math.hypot(safe[0] - 9, safe[1] - 4)).toBeGreaterThan(moved.radius);
  expect(worldField({ ...active, places: [{ ...shelter, role: 'Neutral' }] }, terrain).points).toHaveLength(1);
});
