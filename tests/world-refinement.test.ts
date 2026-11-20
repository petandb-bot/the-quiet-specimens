import { describe, expect, it } from 'vitest';
import { Mesh, Raycaster, Scene, Vector3 } from 'three';
import { followFrame, keptAboveLand, landscapeFrame, wanderFrame } from '../src/reborn/camera';
import { gardenReferences } from '../src/reborn/genome';
import { buildLandscape } from '../src/reborn/landscape';
import { canTraverse, GardenMotion } from '../src/reborn/motion';
import { defaultImage, imageFrame } from '../src/reborn/photo';
import { defaultLand, makeTerrain, terrainKinds, worldBounds } from '../src/reborn/terrain';

describe('World Refinement', () => {
  it('uses the visible ground triangles for height and frees the rebuilt meshes', () => {
    const scene = new Scene();
    for (const kind of terrainKinds) {
      const landscape = buildLandscape(scene, { ...defaultLand, kind, elevation: .88 });
      landscape.root.updateMatrixWorld(true);
      const ground = landscape.root.children[0] as Mesh;
      for (const [x, z] of [[2.18, 6.19], [2.81, 6.83], [-19.63, 17.1], [-54.21, -68.64]]) {
        const ray = new Raycaster(new Vector3(x, 50, z), new Vector3(0, -1, 0));
        const [hit] = ray.intersectObject(ground, false);
        expect(hit.point.y).toBeCloseTo(landscape.terrain.height(x, z), 6);
      }
      const geometries = new Set<Mesh['geometry']>();
      const materials = new Set<Mesh['material']>();
      landscape.root.traverse(child => {
        if (child instanceof Mesh) {
          geometries.add(child.geometry);
          materials.add(child.material);
        }
      });
      let disposed = 0;
      for (const resource of [...geometries, ...materials].flat()) {
        resource.addEventListener('dispose', () => disposed++);
      }
      landscape.dispose();
      expect(disposed).toBe(geometries.size + materials.size);
      expect(scene.children).toHaveLength(0);
    }
  });

  it('keeps a clear region and separated low-slope starts over multiple seeds', () => {
    for (let i = 0; i < 24; i++) {
      const land = makeTerrain({ ...defaultLand, seed: 'REFINEMENT-' + i, kind: terrainKinds[i % 3], elevation: i / 23 });
      expect(land.landmarks.filter(item => item.distant)).toHaveLength(2);
      expect(land.anchors).toHaveLength(9);
      for (const [x, z] of land.anchors) {
        expect(Math.abs(x)).toBeLessThan(30);
        expect(Math.abs(z)).toBeLessThan(30);
        expect(land.slope(x, z)).toBeLessThan(.69);
        for (const item of land.landmarks) expect(Math.hypot(x - item.x, z - item.z)).toBeGreaterThan(item.radius + .7);
      }
    }
    const sparse = makeTerrain({ ...defaultLand, density: 0 });
    const dense = makeTerrain({ ...defaultLand, density: 1 });
    expect(dense.landmarks.length).toBeGreaterThan(sparse.landmarks.length);
    expect(makeTerrain({ ...defaultLand, openness: 1 }).height(1, 3)).not.toBe(makeTerrain({ ...defaultLand, openness: 0 }).height(1, 3));
  });

  it('blocks steep steps and closer obstacle contact while allowing retreat', () => {
    const terrain = { bounds: worldBounds, height: (x: number) => x < 0 ? 0 : 1, slope: (x: number) => Math.abs(x) < .5 ? 1 : 0 };
    expect(canTraverse(terrain, 'HINGE', .7, [], -.15, 0, .14, 0)).toBe(false);
    expect(canTraverse(terrain, 'RELAY', .7, [], -.15, 0, .14, 0)).toBe(false);
    expect(canTraverse(terrain, 'VESSEL', .7, [], -.15, 0, .14, 0)).toBe(true);
    const obstacle = [{ x: 3, z: 0, radius: 1 }];
    expect(canTraverse(terrain, 'VESSEL', .7, obstacle, 4.1, 0, 4, 0)).toBe(false);
    expect(canTraverse(terrain, 'VESSEL', .7, obstacle, 4.1, 0, 4.2, 0)).toBe(true);
  });

  it('frames terrain and follows subject heading while keeping the lens clear', () => {
    const terrain = makeTerrain({ ...defaultLand, kind: 'Terraces', elevation: 1 });
    const position = new Vector3(), target = new Vector3();
    landscapeFrame(terrain, false, position, target);
    const horizontal = position.clone();
    landscapeFrame(terrain, true, position, target);
    expect(position.distanceTo(horizontal)).toBeGreaterThan(1);
    const poses = new Set<string>();
    for (let time = 0; time < 320; time += 2) {
      wanderFrame(time, terrain, position, target);
      expect(keptAboveLand(position, terrain, target)).toBeGreaterThanOrEqual(terrain.height(position.x, position.z) + 1.75);
      poses.add(position.toArray().join());
    }
    expect(poses.size).toBe(160);
    const specimen = new GardenMotion(gardenReferences[0].genome, [0, 0]);
    followFrame(specimen.pose, 0, terrain, position, target);
    expect(position.x).toBeLessThan(0);
    expect(target.x).toBeGreaterThan(0);
    followFrame(specimen.pose, Math.PI, terrain, position, target);
    expect(position.x).toBeGreaterThan(0);
    const landmark = terrain.landmarks[0];
    position.set(landmark.x, 0, landmark.z);
    expect(keptAboveLand(position, terrain)).toBeGreaterThan(terrain.height(landmark.x, landmark.z) + landmark.scale * 3);
  });

  it('covers both viewport shapes and keeps photo adjustments within texture bounds', () => {
    const desktop = imageFrame(16 / 9, 1, defaultImage);
    const portrait = imageFrame(9 / 16, 1, defaultImage);
    expect(desktop.x).toBe(1);
    expect(portrait.y).toBe(1);
    const center = imageFrame(9 / 16, 1, { ...defaultImage, scale: 2 });
    const offset = imageFrame(9 / 16, 1, { ...defaultImage, scale: 2, x: 1, y: -.2, horizon: .1 });
    expect(offset.offsetX).toBeGreaterThan(center.offsetX);
    expect(offset.offsetY).toBeLessThan(center.offsetY);
    expect(offset.x + offset.offsetX).toBeLessThanOrEqual(1);
    expect(offset.y + offset.offsetY).toBeLessThanOrEqual(1);
  });
});
