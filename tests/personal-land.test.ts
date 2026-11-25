import { expect, it } from 'vitest';
import { Box3, Group, Raycaster, Scene, Vector3 } from 'three';
import { openWebGL2 } from '../src/reborn/graphics/context';
import { BrushPath, cellKey, emptyLand, isPersonalLand, paintSurface, sculpt, waterHeight } from '../src/reborn/environment/land-edits';
import type { PersonalLand, WaterRegion } from '../src/reborn/environment/land-edits';
import { environmentOf, generateWorld, lockLayer, randomizeLayer, setMorphology } from '../src/reborn/environment/generator';
import { gardenReferences } from '../src/reborn/genome';
import { buildLandscape } from '../src/reborn/landscape';
import { buildSpecimen } from '../src/reborn/morphology';
import { GardenMotion, canTraverse, stepSeconds } from '../src/reborn/motion';
import { colonyPatterns, placeColony } from '../src/reborn/objects/colonies';
import { makeArtifact } from '../src/reborn/objects/render';
import { personalSpecimen, mutateSpecimen, replayPersonalSpecimen } from '../src/reborn/specimens/generator';
import { sizes, specimenProfile } from '../src/reborn/specimens/profiles';
import { defaultLand, makeTerrain, worldBounds } from '../src/reborn/terrain';
import { createWorld, newObject, objectLimit } from '../src/reborn/world/document';
import type { ObjectKind, WorldDocument } from '../src/reborn/world/document';
import { WorldHistory } from '../src/reborn/world/history';
import { migrateWorld } from '../src/reborn/world/migration';
import { isWorkingDraft } from '../src/reborn/world/recovery';
import { safePosition, worldField } from '../src/reborn/world/runtime';
import { isWorldDocument } from '../src/reborn/world/validation';

const peak = cellKey(0, 0);
const initial = () => createWorld(makeTerrain(defaultLand), [{ specimen: gardenReferences[0], home: [3, -9] }]);
const flat = () => makeTerrain({ ...defaultLand, elevation: 0, roughness: 0 });
const pool: WaterRegion = { id: 'pool', x: 0, z: 0, radius: 9, level: 1.75, color: '#758a8b', clarity: .5 };

it('samples a brush stroke by distance and keeps all four sculpt operations finite', () => {
  const base = () => 0;
  const follow = (breaks: number) => {
    let relief: PersonalLand['relief'] = {};
    const stroke = new BrushPath(1, point => { relief = sculpt(relief, point, 'Raise', 4, .7, base, 0); });
    for (let i = 0; i <= breaks; i++) stroke.add([-6 + 12 * i / breaks, 0]);
    return relief;
  };
  const relief = follow(1);
  expect(follow(24)).toEqual(relief);
  expect(relief[peak]).toBeGreaterThan(0);
  for (const mode of ['Lower', 'Smooth', 'Flatten'] as const) {
    const edited = sculpt(relief, [0, 0], mode, 6, 1, base, -.3);
    expect(edited[peak] ?? 0).toBeLessThan(relief[peak]);
  }
  let bounded = relief;
  for (let i = 0; i < 30; i++) bounded = sculpt(bounded, [29, 0], 'Raise', 12, 1, base, 0);
  expect(Math.max(...Object.values(bounded))).toBe(5);
  expect(bounded[cellKey(30, 0)]).toBeUndefined();
});

it('uses the same edited triangles for slope, raycasting, placement and the water shoreline', () => {
  const scene = new Scene();
  const landscape = buildLandscape(scene, defaultLand, undefined, [], { ...emptyLand, water: [pool] });
  const previous = landscape.terrain.height(0, 0);
  const edits = { ...emptyLand, water: [pool], relief: { [peak]: 2.5, [cellKey(1, 0)]: 1.5 } };
  landscape.setEdits(edits);
  landscape.root.updateMatrixWorld(true);
  expect(landscape.terrain.height(0, 0) - previous).toBeCloseTo(2.5);
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  for (const [x, z] of [[.13,.63], [.69,.83], [-.1,-.9], [.11,-.7], [1.4,.3]]) {
    ray.ray.origin.set(x, 25, z);
    const hit = ray.intersectObject(landscape.ground)[0];
    expect(hit.point.y).toBeCloseTo(landscape.terrain.height(x, z), 5);
    expect(hit.face).toBeTruthy();
    expect(landscape.terrain.slope(x, z)).toBeCloseTo(Math.hypot(hit.face!.normal.x, hit.face!.normal.z) / hit.face!.normal.y, 5);
    const expectedDepth = Math.hypot(x, z) <= pool.radius ? Math.max(0, pool.level - hit.point.y) : 0;
    expect(waterHeight([pool], landscape.terrain.height, x, z) - hit.point.y).toBeCloseTo(expectedDepth, 5);
  }
  landscape.setEdits(emptyLand);
  expect(landscape.terrain.height(0, 0)).toBe(previous);
  landscape.dispose();
});

it('migrates old worlds in place and persists all authored layers as a single history entry', () => {
  const old = initial();
  expect(isWorldDocument(old)).toBe(true);
  expect(migrateWorld(JSON.parse(JSON.stringify(old)))).toEqual(old);
  const previousSchema = { ...old, environment: undefined };
  expect(isWorldDocument(previousSchema)).toBe(true);
  expect(migrateWorld(previousSchema)).toEqual(old);
  const history = new WorldHistory(old);
  const painted = paintSurface({}, [0, 0], 'Glass', 4);
  const draft = { ...old, personalLand: { relief: { [peak]: .7 }, paint: painted, water: [pool] } };
  expect(history.canUndo).toBe(false);
  expect(old.personalLand).toBeUndefined();
  expect(history.commit(draft)).toBe(true);
  expect(history.undo()).toBe(true);
  expect(history.value).toBe(old);
  expect(history.redo()).toBe(true);
  const recovered = structuredClone({ version: 1, world: history.value, photo: new Blob(['image'], { type: 'image/jpeg' }) });
  expect(isWorkingDraft(recovered)).toBe(true);
  expect(migrateWorld(recovered.world).personalLand).toEqual(draft.personalLand);
  expect(paintSurface(painted, [0, 0], undefined, 4)[peak]).toBeUndefined();
  for (const bad of [{ ...emptyLand, relief: { [peak]: Infinity } }, { ...emptyLand, relief: { 4000: 1 } },
    { ...emptyLand, paint: { [peak]: ['Obsidian', .7] } }, { ...emptyLand, water: Array(5).fill(pool) },
    { ...emptyLand, water: [{ ...pool, level: NaN }] }, { ...emptyLand, water: [pool, pool] }]) {
    expect(isPersonalLand(bad)).toBe(false);
    expect(history.commit({ ...old, personalLand: bad as PersonalLand })).toBe(false);
  }
});

it('swaps world morphology independently of surface style and protects locked layers and authored edits', () => {
  const edits = { ...emptyLand, relief: { [peak]: 1 }, paint: paintSurface({}, [0, 0], 'Dust', 3), water: [pool] };
  const old = initial();
  const world = { ...old, personalLand: edits };
  const styled = generateWorld(world, 'Oxide Field', 'style-12');
  expect(styled.personalLand).toBe(edits);
  const basin = setMorphology(styled, 'Basin');
  expect(basin.land.kind).toBe('Hollow Land');
  expect(basin.environment!.surface).toBe(styled.environment!.surface);
  expect(basin.residents).toBe(styled.residents);
  expect(basin.personalLand).toBe(edits);
  const thicket = setMorphology(basin, 'Thicket');
  expect(thicket.objects.some(item => item.kind === 'canopy')).toBe(true);
  const locked = lockLayer(lockLayer(lockLayer(basin, 'terrain', true), 'surface', true), 'residents', true);
  const reroll = generateWorld(locked, 'Black Mineral', 'style-31');
  expect(reroll.land).toBe(locked.land);
  expect(reroll.residents).toBe(locked.residents);
  expect(reroll.environment!.surface).toBe(locked.environment!.surface);
  expect(reroll.personalLand).toBe(edits);
  expect(randomizeLayer(reroll, 'surface', 'no')).toBe(reroll);
  expect(setMorphology(reroll, 'Expanse').land).toBe(reroll.land);
});

it('generates distinct family geometry and seed-stable colonies within editable terrain and collision bounds', () => {
  const kinds: ObjectKind[] = ['hollow', 'fragment', 'aggregate', 'membrane', 'canopy', 'suspension'];
  const signature = (kind: ObjectKind, seed: string) => {
    const artifact = makeArtifact(newObject(kind, seed, 'sample'));
    const { group } = artifact;
    const size = new Box3().setFromObject(group).getSize(new Vector3());
    const count = group.children.length;
    artifact.dispose();
    return [count, ...size.toArray().map(n => Math.round(n * 1000))];
  };
  expect(new Set(kinds.map(kind => JSON.stringify(signature(kind, 'test-17')))).size).toBe(6);
  for (const kind of kinds) {
    expect(signature(kind, 'test-17')).toEqual(signature(kind, 'test-17'));
    expect(signature(kind, 'test-17')).not.toEqual(signature(kind, 'test-36'));
  }
  expect(signature('arch', 'legacy-seed')).toEqual(signature('arch', 'legacy-seed'));
  const brush = newObject('canopy', 'test-36', 'brush');
  const terrain = flat();
  const produced = [];
  for (const pattern of colonyPatterns) {
    const generate = () => {
      let id = 0;
      return placeColony(brush, [18, 18], { mode: 'Colony', area: 10, density: 1, variation: .8, pattern }, [], terrain, () => 'form-' + id++);
    };
    const colony = generate();
    expect(colony).toEqual(generate());
    expect(colony.length).toBeGreaterThan(1);
    for (const item of colony) {
      expect(Math.hypot(item.x - 18, item.z - 18) + item.radius).toBeLessThanOrEqual(10.001);
      expect(Math.max(Math.abs(item.x), Math.abs(item.z)) + item.radius).toBeLessThanOrEqual(30);
      expect(colony.every(other => other === item || Math.hypot(item.x - other.x, item.z - other.z) >= item.radius + other.radius)).toBe(true);
    }
    produced.push(JSON.stringify(colony));
  }
  expect(new Set(produced).size).toBe(colonyPatterns.length);
  expect(placeColony(brush, [0, 0], { mode: 'Scatter', area: 10, density: 1, variation: 1, pattern: 'Ring' },
    Array(objectLimit).fill(brush), terrain)).toEqual([]);
});

it('supports Reference, Mixed and Wild rosters with reproducible genomes, distinct identity and non-destructive mutation', () => {
  const world = initial();
  for (const [residentPolicy, generated] of [['Reference', 0], ['Mixed', 2], ['Wild', 5]] as const) {
    const input = { ...world, environment: { ...environmentOf(world), residentPolicy } };
    const next = generateWorld(input, 'Elsewhere', 'different-seed');
    expect(next.residents.filter(item => item.specimen.recipe)).toHaveLength(generated);
    expect(next.residents).toEqual(generateWorld(input, 'Elsewhere', 'different-seed').residents);
    expect(isWorldDocument(next)).toBe(true);
    expect(new Set(next.residents.map(item => item.specimen.genome.seed)).size).toBe(5);
    for (const item of next.residents.filter(item => item.specimen.recipe)) {
      expect(replayPersonalSpecimen(item.specimen.genome.seed)).toEqual(item.specimen);
    }
  }
  const source = personalSpecimen({ seed: 'study-14', body: 'HINGE', material: 'CERAMIC', size: 'Small', temperament: 'Quiet' });
  const mutation = mutateSpecimen(source, 'Material', 'study-15');
  expect(mutation.genome.material).not.toBe(source.genome.material);
  expect(mutation.genome.plan).toBe('HINGE');
  expect(mutation.genome.proportion).toBe(source.genome.proportion);
  expect(mutation.genome.sound).toEqual(source.genome.sound);
  expect(replayPersonalSpecimen(mutation.genome.seed)).toEqual(mutation);
  expect(mutation.size).toBe('Small');
  expect(source.genome.material).toBe('CERAMIC');
  expect(isWorldDocument({ ...world, residents: [{ specimen: source }, { specimen: source }] })).toBe(false);
  expect(isWorldDocument({ ...world, residents: [{ specimen: { ...source, genome: { ...source.genome, plan: 'FUTURE' } } }] })).toBe(false);
});

it('updates navigable ground for water and keeps HINGE and RELAY contacts correct across resident scales', () => {
  const terrain = flat();
  const world: WorldDocument = { ...initial(), objects: [], personalLand: { ...emptyLand, water: [pool] } };
  const { field } = worldField(world, terrain);
  expect(field.water!(0, 0)).toBeGreaterThan(.58);
  expect(safePosition([0, 0], gardenReferences[0], terrain, world, true)).not.toEqual([0, 0]);
  expect(safePosition([0, 0], gardenReferences[3], terrain, world, true)).toEqual([0, 0]);
  expect(canTraverse(field, 'VESSEL', 1, [], 9, 0, 0, 0)).toBe(true);
  const height = (x: number, z: number) => .18 * x - .16 * z;
  for (const size of sizes) {
    const profile = specimenProfile(size);
    const hinge = buildSpecimen(gardenReferences[0].genome);
    const relay = buildSpecimen(gardenReferences[6].genome);
    for (const [rig, specimen] of [[hinge, gardenReferences[0]], [relay, gardenReferences[6]]] as const) {
      const motion = new GardenMotion(specimen.genome, [0, 0], [], .9 * profile.scale, { bounds: worldBounds, height, slope: () => .24, points: [] }, profile);
      rig.root.scale.setScalar(profile.scale);
      rig.root.position.y = .035;
      motion.pose.yaw = .45;
      rig.root.rotation.y = .45;
      rig.animate(motion.pose, { height, floor: 0, scale: profile.scale });
      if (rig === relay) for (const segment of rig.root.children.filter(child => child instanceof Group)) {
        const point = segment.getWorldPosition(new Vector3());
        expect(point.y - height(point.x, point.z)).toBeCloseTo(.035 + .135 * profile.scale);
      }
      if (rig === hinge) {
        const frame = rig.root.children[0];
        const feet = frame.children.filter(node => node instanceof Group).slice(0, 2)
          .map(knee => knee.children.find(node => node instanceof Group)!);
        const clearance = feet.map(foot => {
          const toe = foot.localToWorld(new Vector3(0, -.11, 0));
          return toe.y - height(toe.x, toe.z);
        });
        expect(Math.min(...clearance)).toBeGreaterThan(-.015);
        expect(Math.min(...clearance)).toBeLessThan(.1);
      }
      for (let i = 0; i < 700; i++) motion.step(stepSeconds);
      expect(Number.isFinite(motion.pose.x) && Number.isFinite(motion.pose.z)).toBe(true);
      rig.dispose();
    }
  }
  const small = personalSpecimen({ seed: 'size-5', body: 'HINGE', material: 'CERAMIC', size: 'Small', temperament: 'Quiet' });
  const large = personalSpecimen({ ...small.recipe!, size: 'Large' });
  expect(safePosition([30, 30], large, terrain, world)![0]).toBeLessThan(safePosition([30, 30], small, terrain, world)![0]);
});

it('negotiates WebGL 2 with separate canvases and stops after the third attempt', () => {
  const settings: WebGLContextAttributes[] = [];
  const factory = () => ({ getContext(_kind: string, options: WebGLContextAttributes) {
    settings.push(options);
    if (settings.length === 1) throw new Error('high-performance');
    return settings.length === 3 ? {} : null;
  } } as HTMLCanvasElement);
  expect(openWebGL2(factory).antialias).toBe(false);
  expect(settings.map(setting => [setting.powerPreference, setting.antialias])).toEqual([['high-performance', true], [undefined, true], [undefined, false]]);
  let attempts = 0;
  expect(() => openWebGL2(() => ({ getContext() { attempts++; return null; } } as unknown as HTMLCanvasElement))).toThrow('WebGL 2 could not start');
  expect(attempts).toBe(3);
});
