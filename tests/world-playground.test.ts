import { describe, expect, it } from 'vitest';
import { activityFrame } from '../src/reborn/composer/activity';
import { environmentOf, generateWorld, lockLayer, randomizeLayer, setStructureDensity } from '../src/reborn/environment/generator';
import { layerNames, worldStyles } from '../src/reborn/environment/settings';
import { gardenReferences } from '../src/reborn/genome';
import { GardenMotion, stepSeconds } from '../src/reborn/motion';
import { defaultLand, makeTerrain } from '../src/reborn/terrain';
import { createWorld, layoutPoints, newObject, objectLimit, transformObject } from '../src/reborn/world/document';
import type { Place } from '../src/reborn/world/document';
import { WorldHistory } from '../src/reborn/world/history';
import { migrateWorld } from '../src/reborn/world/migration';
import { isWorkingDraft } from '../src/reborn/world/recovery';
import { safePosition, worldField } from '../src/reborn/world/runtime';
import { isWorldDocument } from '../src/reborn/world/validation';

const terrain = makeTerrain(defaultLand);
const initial = createWorld(terrain, [0, 3, 6, 1, 7].map(index => ({ specimen: gardenReferences[index] })));
const readLayer = (world: typeof initial, layer: typeof layerNames[number]) => {
  const settings = environmentOf(world);
  switch (layer) {
    case 'terrain': return world.land;
    case 'residents': return world.residents;
    case 'structures': return world.objects;
    default: return settings[layer];
  }
};

describe('World Playground', () => {
  it('migrates a schema 1 draft without regenerating user data or touching the photo', () => {
    const arch = transformObject(newObject('arch','HAND'), { x: 12, z: -8 });
    const legacy = { ...initial, environment: undefined, objects: [...initial.objects, arch],
      places: [{ id: 'linked', name: 'Shelter', role: 'Shelter', x: 12, z: -8, linkedObjectId: arch.id,
        radius: 4, influence: .7, enabled: true } satisfies Place] };
    const photo = new Blob(['photo bytes'], { type: 'image/jpeg' });
    expect(isWorkingDraft({ version: 1, world: legacy, photo })).toBe(true);
    const migrated = migrateWorld(legacy);
    expect(migrated).toMatchObject({ environment: { style: 'Elsewhere', seed: defaultLand.seed } });
    expect(migrated.land).toBe(legacy.land);
    expect(migrated.image).toBe(legacy.image);
    expect(migrated.objects).toBe(legacy.objects);
    expect(migrated.places).toBe(legacy.places);
    expect(migrated.residents).toBe(legacy.residents);
    expect(isWorkingDraft({ version: 1, world: migrated, photo })).toBe(true);
    expect(isWorldDocument({ ...migrated, environment: { ...migrated.environment, lighting: { intensity: Infinity } } })).toBe(false);
  });

  it('reproduces eight different compositions from the same seed without generated overlap', () => {
    const footprints = new Set<string>();
    for (const style of worldStyles) {
      const world = generateWorld(initial, style, 'STUDY-2026');
      expect(world).toEqual(generateWorld(initial, style, 'STUDY-2026'));
      expect(isWorldDocument(world)).toBe(true);
      expect(world.objects.length).toBeGreaterThan(2);
      expect(world.objects.length).toBeLessThanOrEqual(objectLimit);
      for (const [i, item] of world.objects.entries()) {
        expect(world.objects.slice(i + 1).every(other => Math.hypot(item.x - other.x, item.z - other.z) >= item.radius + other.radius)).toBe(true);
      }
      const surface = makeTerrain(world.land);
      for (const resident of world.residents) expect(safePosition(resident.start!, resident.specimen, surface, world)).toBeDefined();
      footprints.add(JSON.stringify(world.objects.map(({ x, z, scale }) => [x, z, scale])));
    }
    expect(footprints.size).toBe(8);
    const restored = generateWorld(initial, 'Elsewhere', defaultLand.seed, true);
    expect(restored.objects).toEqual(initial.objects);
    expect(restored.land).toEqual(initial.land);
    expect(restored.residents).toEqual(initial.residents);
  });

  it('isolates every layer and respects locked recipes as well as edited objects across style changes', () => {
    const arch = transformObject(newObject('arch', 'PLACED'), { x: 9, z: -7 });
    const first = generateWorld({ ...initial, objects: [...initial.objects, arch] }, 'Pale Colony', 'FIRST');
    for (const layer of layerNames) {
      const next = randomizeLayer(first, layer, 'SECOND');
      for (const other of layerNames.filter(other => other !== layer)) {
        expect(readLayer(next, other)).toBe(readLayer(first, other));
        expect(environmentOf(next).layers[other]).toBe(environmentOf(first).layers[other]);
      }
      expect(next.objects.find(item => item.id === arch.id)).toBe(arch);
      const locked = lockLayer(first, layer, true);
      expect(randomizeLayer(locked, layer, 'SECOND')).toBe(locked);
      const styled = generateWorld(locked, 'Black Mineral', 'THIRD');
      expect(readLayer(styled, layer)).toBe(readLayer(locked, layer));
      expect(environmentOf(styled).layers[layer]).toBe(environmentOf(locked).layers[layer]);
    }
    const dense = setStructureDensity(first, .9);
    expect(dense.land).toBe(first.land);
    expect(dense.objects).not.toBe(first.objects);
    expect(dense.objects.find(item => item.id === arch.id)).toBe(arch);
  });

  it('keeps a full authored layout at the object limit during a world roll', () => {
    const objects = Array.from({ length: objectLimit }, (_, i) =>
      transformObject(newObject('stones', 'FULL-' + i), { x: i % 8 * 6 - 23, z: Math.floor(i / 8) * 6 - 16 }));
    const world = generateWorld({ ...initial, objects }, 'Uncertain Garden', 'FULL');
    expect(world.objects).toEqual(objects);
    expect(world.objects).toHaveLength(objectLimit);
    expect(isWorldDocument(world)).toBe(true);
  });

  it('undoes and redoes each generation or lock atomically and keeps linked or manually modified forms', () => {
    const [landmark, edited, ...other] = initial.objects;
    const place: Place = { id: 'look', name: 'Look', role: 'Curiosity', radius: 3, influence: .8,
      enabled: true, linkedObjectId: landmark.id, x: landmark.x, z: landmark.z };
    const prior = { ...initial, objects: [landmark, transformObject(edited, { scale: 2 }), ...other], places: [place] };
    const history = new WorldHistory(prior);
    const locked = lockLayer(prior, 'terrain', true);
    expect(history.commit(locked)).toBe(true);
    const style = generateWorld(locked, 'Uncertain Garden', 'STUDY');
    expect(style.objects.find(item => item.id === landmark.id)).toBe(landmark);
    expect(style.objects.find(item => item.id === edited.id)).toBe(prior.objects[1]);
    expect(history.commit(style)).toBe(true);
    const partial = randomizeLayer(style, 'surface', 'STUDY-II');
    expect(history.commit(partial)).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.value.environment).toBe(style.environment);
    expect(history.undo()).toBe(true);
    expect(history.value.environment).toBe(locked.environment);
    expect(history.undo()).toBe(true);
    expect(history.value).toBe(prior);
    expect(history.redo() && history.redo() && history.redo()).toBe(true);
    expect(history.value.environment).toBe(partial.environment);
  });

  it('assigns authored forms an interest and gives linked or surrounding Neutral places priority', () => {
    const arch = transformObject(newObject('arch', 'INTEREST'), { x: 8, z: 4 });
    const world = { ...initial, objects: [arch] };
    expect(layoutPoints(world, terrain)).toContainEqual(expect.objectContaining({ id: arch.id, role: 'Shelter' }));
    const neutral: Place = { id: 'quiet-here', name: 'Quiet place', role: 'Neutral', radius: 4,
      influence: .8, enabled: true, x: arch.x, z: arch.z };
    for (const place of [neutral, { ...neutral, linkedObjectId: arch.id }]) {
      expect(layoutPoints({ ...world, places: [place] }, terrain).map(point => point.id)).not.toContain(arch.id);
    }
    const linked = { ...neutral, role: 'Curiosity' as const, linkedObjectId: arch.id };
    expect(layoutPoints({ ...world, places: [linked] }, terrain)).toContainEqual(expect.objectContaining({ id: linked.id, role: 'Curiosity' }));
  });

  it('keeps the fixed step clock and resident state across activity and obstacle updates', () => {
    const specimen = gardenReferences[0];
    const field = worldField(initial, terrain);
    const motion = new GardenMotion(specimen.genome, terrain.anchors[0], field.obstacles, .75, field.field);
    let carry = 0;
    function advance(mode: Parameters<typeof activityFrame>[2]) {
      for (let frame = 0; frame < 120; frame++) {
        const tick = activityFrame(stepSeconds, carry, mode);
        carry = tick.remainder;
        for (let i = 0; i < tick.steps; i++) motion.step(stepSeconds);
      }
    }
    advance('Paused');
    expect(motion.pose.time).toBe(0);
    advance('Slow');
    expect(motion.pose.time).toBeCloseTo(.6, 1);
    advance('Live');
    expect(motion.pose.time).toBeCloseTo(2.6, 1);
    const { x, z, time } = motion.pose;
    const obstacle = transformObject(newObject('arch', 'BLOCKER'), { x, z });
    const scene = { ...initial, objects: [obstacle] };
    const changed = worldField(scene, terrain);
    motion.updateEnvironment(changed.obstacles, changed.field);
    expect(motion.pose.x).toBe(x);
    expect(motion.pose.z).toBe(z);
    const safe = safePosition([x, z], specimen, terrain, scene)!;
    motion.reposition(safe);
    expect(motion.pose.time).toBe(time);
    expect(Math.hypot(motion.pose.x - x, motion.pose.z - z)).toBeGreaterThan(obstacle.radius);
  });
});
