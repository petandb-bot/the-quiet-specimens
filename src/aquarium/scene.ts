import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch, vector } from '../morphology/mesh';
import { buildCreature } from '../morphology/creature';
import { random } from '../core/random';
import type { Specimen } from '../core/model';
import { featured, floorManager } from '../presets/reference';
import { buildShoal } from './shoalMesh';
import { shoalCounts, tankFloor, tankPose } from './motion';
import type { AquariumPreset, Pose, TankSubject } from './motion';

function sediment() {
  const floor = new T.PlaneGeometry(42, 30, 44, 34).rotateX(-Math.PI / 2);
  const xyz = floor.getAttribute('position');
  const color = new Float32Array(xyz.count * 3);
  const base = new T.Color('#183537');
  const sand = new T.Color('#41615a');
  for (let i = 0; i < xyz.count; i++) {
    const x = xyz.getX(i), z = xyz.getZ(i);
    const ripple = Math.sin(z * 1.95 + Math.sin(x * .72) * 1.75) * .5 + .5;
    const dimple = Math.sin(x * 1.23 + z * .34) * Math.cos(z * .62);
    xyz.setY(i, tankFloor - .075 + .038 * ripple + .023 * dimple);
    base.clone().lerp(sand, .30 * ripple + .12 * (1 + dimple)).toArray(color, i * 3);
  }
  floor.setAttribute('color', new T.BufferAttribute(color, 3));
  floor.computeVertexNormals();
  const ground = new T.Mesh(floor, new T.MeshStandardMaterial({ vertexColors: true, roughness: .89, metalness: .07 }));
  const stones = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshStandardMaterial({
    color: '#57665d', roughness: .9,
  }), 48);
  const rng = random('tank shelf');
  const t = new T.Object3D();
  for (let i = 0; i < stones.count; i++) {
    const near = i < 18;
    const scale = rng.range(.07, near ? .38 : .23);
    t.position.set((i % 2 ? -1 : 1) * rng.range(near ? 3.8 : 1, 7.9), tankFloor + .01, rng.range(-4.5, 3.4));
    t.scale.set(scale * rng.range(1.2, 1.9), scale * .54, scale);
    t.rotation.y = rng.range(0, Math.PI * 2);
    t.updateMatrix();
    stones.setMatrixAt(i, t.matrix);
    stones.setColorAt(i, new T.Color(i % 3 ? '#939f85' : '#6e8777'));
  }
  return [ground, stones];
}

function reeds() {
  const rng = random('tank fern');
  const dark = new T.Color('#163b39');
  const tip = new T.Color('#497867');
  const surfaces: T.BufferGeometry[] = [];
  for (const [cx, cz, height] of [[-6.5, -1.32, 1.8], [6.6, -2.8, 2.3], [-5.12, -3.8, .87], [6, 1.1, .65]]) {
    for (let leaf = 0; leaf < 9; leaf++) {
      const x = cx + rng.range(-.42, .42), z = cz + rng.range(-.50, .50);
      const reach = height * rng.range(.35, 1.08);
      const curl = rng.range(-.65, .65);
      const skew = rng.range(-.51, .51);
      const width = rng.range(.07, .15);
      surfaces.push(patch(16, 4, (u, v) => {
        const cross = Math.sin(Math.PI * u) ** .73 * (v * 2 - 1) * width;
        return vector(x + curl * u ** 1.5 + cross,
          tankFloor + u * reach - .12 * Math.sin(u * 6.3) * u,
          z + skew * u ** 1.55 + cross * Math.sin(u * 6 + leaf));
      }, (u, v) => dark.clone().lerp(tip, u * .71 + (1 - Math.abs(v * 2 - 1)) * .24)));
    }
  }
  const geometry = mergeGeometries(surfaces);
  surfaces.forEach(surface => surface.dispose());
  return new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: .73 }));
}

function motes() {
  const rng = random('window motes');
  const positions: number[] = [], colors: number[] = [];
  for (let i = 0; i < 160; i++) {
    positions.push(rng.range(-10, 10), rng.range(-2.27, 4.5), rng.range(-5, 3));
    const shade = rng.range(.19, .52);
    colors.push(shade * .77, shade, shade * .95);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  return new T.Points(geometry, new T.PointsMaterial({
    size: .031, vertexColors: true, transparent: true, opacity: .58, depthWrite: false,
  }));
}

function resident(specimen: Specimen, width: number, height: number) {
  const model = buildCreature(specimen, true);
  const bounds = new T.Box3().setFromObject(model.group);
  const size = bounds.getSize(new T.Vector3());
  const scale = Math.min(width / Math.max(size.x, size.z), height / size.y);
  model.group.scale.setScalar(scale);
  model.group.position.copy(bounds.getCenter(new T.Vector3()).multiplyScalar(-scale));
  const anchor = new T.Group();
  anchor.add(model.group);
  return { anchor, model };
}

const arowana = featured.find(item => item.genome.morphology.fishForm === 'arowana')!;
const seahorse = featured.find(item => item.genome.morphology.fishForm === 'seahorse')!;

export class Aquarium {
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(35, 1, .1, 70);
  private schooling = { guppies: buildShoal('guppies'), goldfish: buildShoal('goldfish') };
  private subjects = {
    arowana: resident(arowana, 5.17, 1.36),
    seahorse: resident(seahorse, 1.28, 1.87),
    floor: resident(floorManager, 4.26, .43),
  };
  private particles = motes();
  private pose: Pose = { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0 };
  private elapsed = 0;
  private preset: AquariumPreset = 'mixed';
  paused = false;

  constructor(environment: T.Texture) {
    this.scene.environment = environment;
    this.scene.environmentIntensity = .68;
    this.scene.fog = new T.FogExp2('#134750', .064);
    this.scene.add(new T.HemisphereLight('#b5f7f2', '#254247', 1.48));
    const key = new T.DirectionalLight('#ffe0ab', 2.6);
    key.position.set(-3.2, 7.1, 3.6);
    const rim = new T.DirectionalLight('#75deed', 2.12);
    rim.position.set(6, 5, -6.0);
    const fill = new T.DirectionalLight('#b3f0de', .7);
    fill.position.set(3.2, 1.2, 8.0);
    this.scene.add(key, rim, fill, ...sediment(), reeds(), this.particles);
    for (const { anchor } of Object.values(this.subjects)) this.scene.add(anchor);
    for (const { mesh } of Object.values(this.schooling)) this.scene.add(mesh);
    this.update(0);
  }

  resize(aspect: number) {
    const distance = Math.max(12.6, 24.0 / aspect);
    this.camera.aspect = aspect;
    this.camera.position.set(.32, 2.10 + distance * .049, distance);
    this.camera.lookAt(0, -.15, 0);
    this.camera.updateProjectionMatrix();
  }

  setPreset(preset: AquariumPreset) {
    if (preset === this.preset) return;
    this.preset = preset;
    this.update(0);
  }

  update(dt: number) {
    if (!this.paused) this.elapsed += dt;
    const t = this.elapsed;
    const counts = shoalCounts[this.preset];
    this.schooling.guppies.update(t, counts.guppies);
    this.schooling.goldfish.update(t, counts.goldfish);
    for (const subject of Object.keys(this.subjects) as TankSubject[]) {
      const { anchor, model } = this.subjects[subject];
      anchor.visible = subject === 'floor' || this.preset === 'mixed';
      if (!anchor.visible) continue;
      tankPose(subject, t, this.pose);
      anchor.position.set(...this.pose.position);
      anchor.rotation.set(this.pose.roll, this.pose.yaw, this.pose.pitch, 'YXZ');
      model.motion.time.value = t;
      model.motion.effort.value = subject === 'floor' ? .04 : subject === 'seahorse' ? .36 : .41;
      model.motion.display.value = .05 * Math.sin(t * 1.17);
    }
    this.particles.position.x = Math.sin(t * .14) * .28;
    this.particles.position.y = Math.sin(t * .11) * .16;
  }
}
