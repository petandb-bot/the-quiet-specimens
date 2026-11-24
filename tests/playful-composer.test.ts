import { expect, it } from 'vitest';
import { MakeCamera } from '../src/reborn/composer/camera';
import { brushSeed, makeBrush, objectSizes, stampObject } from '../src/reborn/composer/palette';
import { defaultLand, makeTerrain } from '../src/reborn/terrain';
import { createWorld, newObject, objectLimit, transformObject } from '../src/reborn/world/document';
import { WorldHistory } from '../src/reborn/world/history';
import { isWorkingDraft } from '../src/reborn/world/recovery';
import { primaryColor, rollAppearance } from '../src/reborn/objects/appearance';
import { makeArtifact } from '../src/reborn/objects/render';
import { Mesh } from 'three';

const terrain = makeTerrain(defaultLand);

it('stamps a repeatable shape with a distinct identity for each placement and respects the edit bounds', () => {
  const world = createWorld(terrain);
  const brush = newObject('flora', brushSeed('flora'));
  const first = stampObject(world, brush, [-5, 9])!;
  const second = stampObject(world, brush, [6, -2])!;
  expect(first.id).not.toBe(second.id);
  expect(first).toMatchObject({ x: -5, z: 9, height: 0, seed: second.seed, yaw: second.yaw, scale: second.scale });
  expect(stampObject(world, brush, [30.1, 0])).toBeUndefined();
  expect(stampObject({ ...world, objects: Array(objectLimit).fill(first) }, brush, [0, 0])).toBeUndefined();
});

it('validates a stored draft and gives the reloaded layout its own undo history', () => {
  const world = createWorld(terrain);
  const history = new WorldHistory(world);
  const edited = { ...world, objects: [...world.objects, newObject('ring', 'ring')] };
  const draft = { version: 1, world: edited, photo: new Blob(['bytes'], { type: 'image/jpeg' }) };
  expect(isWorkingDraft(draft)).toBe(true);
  expect(isWorkingDraft({ ...draft, world: { ...edited, objects: [null] } })).toBe(false);
  expect(isWorkingDraft({ ...draft, photo: new Blob(['svg'], { type: 'image/svg+xml' }) })).toBe(false);
  expect(isWorkingDraft({ ...draft, version: 2 })).toBe(false);
  expect(history.commit(edited)).toBe(true);
  expect(history.canUndo).toBe(true);
  expect(history.restore(edited)).toBe(true);
  expect(history.value).toBe(edited);
  expect(history.canUndo).toBe(false);
  expect(history.canRedo).toBe(false);
});

it('keeps perspective and plan framing independent and bounds plan navigation', () => {
  const camera = new MakeCamera();
  camera.resize(390 / 844);
  camera.reset(terrain);
  const original = camera.perspective.position.clone();
  camera.orbit('Plan', 9000, 9000, 844, terrain);
  camera.zoom('Plan', 50);
  expect(camera.plan.position.toArray()).toEqual([-30, 78, -30]);
  expect(camera.plan.zoom).toBe(3.8);
  expect(camera.perspective.position.equals(original)).toBe(true);
  camera.orbit('Perspective', 90, 40, 844, terrain);
  expect(camera.perspective.position.equals(original)).toBe(false);
  expect(camera.plan.position.toArray()).toEqual([-30, 78, -30]);
  expect(camera.perspective.zoom).toBe(1);
});

it('places the chosen size and finish with a matching collision footprint', () => {
  const world = createWorld(terrain);
  const original = makeBrush('arch');
  const brush = transformObject(original, { scale: objectSizes.Large, finish: 'Jade' });
  const stamp = stampObject(world, brush, [4, -6])!;
  expect(stamp).toMatchObject({ x: 4, z: -6, scale: objectSizes.Large, finish: 'Jade', appearance: 2 });
  expect(stamp.radius / original.radius).toBeCloseTo(objectSizes.Large / objectSizes.Medium);
});

it('keeps old Arch colors and gives repeated seeded rolls distinct, reproducible looks', () => {
  const historical = { ...makeBrush('arch'), appearance: undefined };
  expect(primaryColor(historical)).toBe('#ad5b40');
  expect(primaryColor({ ...historical, seed: 'OLD-ARCH' })).toBe('#ad5b40');
  let arch = transformObject(historical, { x: 8, z: -9, scale: objectSizes.Small, finish: 'Chalk' });
  const palette = new Set<string>();
  const contours = new Set<string>();
  for (let i = 0; i < 18; i++) {
    const roll = rollAppearance(arch, 'TEST-' + i);
    expect(roll).toEqual(rollAppearance(arch, 'TEST-' + i));
    const variant = transformObject(arch, roll);
    expect(primaryColor(variant)).not.toBe(primaryColor(arch));
    expect(variant).toMatchObject({ x: 8, z: -9, scale: objectSizes.Small, radius: arch.radius, appearance: 2 });
    const artifact = makeArtifact(variant);
    const mesh = artifact.group.children[0] as Mesh;
    const positions = mesh.geometry.attributes.position.array;
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every(Number.isFinite)).toBe(true);
    contours.add(String(positions.length));
    palette.add(primaryColor(variant));
    artifact.dispose();
    arch = variant;
  }
  expect(palette.size).toBeGreaterThanOrEqual(4);
  expect(contours.size).toBeGreaterThanOrEqual(3);
});
