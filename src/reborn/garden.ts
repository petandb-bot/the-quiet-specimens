import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { random } from '../core/random';
import type { GroundPoint, Obstacle } from './motion';

const ivory = '#e7deca';
const warm = '#c7b799';
const moss = '#6d7860';
const black = '#2c3732';
const rust = '#a44630';
const blue = '#3c5472';
const ochre = '#bc9340';
const tau = Math.PI * 2;

function material(color: string, roughness = .82) {
  return new T.MeshStandardMaterial({ color, roughness, metalness: .03 });
}

function mount(parent: T.Group | T.Scene, geometry: T.BufferGeometry, surface: T.Material, x: number, y: number, z: number) {
  const mesh = new T.Mesh(geometry, surface);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function slab(parent: T.Group, surface: T.Material, width: number, height: number, depth: number, x: number, y: number, z: number, bevel = .045) {
  return mount(parent, new RoundedBoxGeometry(width, height, depth, 2, bevel), surface, x, y, z);
}

function screen(group: T.Group, surfaces: Record<string, T.Material>) {
  slab(group, surfaces.warm, 2.65, .16, .87, 0, .075, 0);
  const face = new T.Shape();
  face.moveTo(-1.17, 0);
  face.lineTo(1.16, 0);
  face.lineTo(1.16, 1.94);
  face.lineTo(.79, 2.57);
  face.lineTo(-1.17, 2.57);
  face.closePath();
  const cut = new T.Path();
  cut.absarc(.01, 1.53, .77, 0, tau, true);
  face.holes.push(cut);
  mount(group, new T.ExtrudeGeometry(face, { depth: .23, bevelSegments: 2, bevelSize: .035, bevelThickness: .022, curveSegments: 48 }),
    surfaces.rust, 0, .15, -.14);
  slab(group, surfaces.warm, .16, 2.40, .18, -1.10, 1.35, .155);
}

function armature(group: T.Group, surfaces: Record<string, T.Material>) {
  slab(group, surfaces.moss, 1.96, .18, 1.42, 0, .09, 0);
  const ring = mount(group, new T.TorusGeometry(.70, .104, 14, 64, tau * .85), surfaces.blue, 0, .945, 0);
  ring.rotation.set(.14, -.46, -1.13);
  slab(group, surfaces.black, .275, 1.01, .28, .56, .65, -.10);
  const pole = mount(group, new T.CylinderGeometry(.038, .038, 1.28, 12), surfaces.ochre, -.65, .80, .12);
  pole.rotation.z = -.21;
  mount(group, new T.DodecahedronGeometry(.146, 0), surfaces.ochre, -.52, 1.44, .12);
}

function spire(group: T.Group, surfaces: Record<string, T.Material>) {
  slab(group, surfaces.warm, 1.36, .14, .94, 0, .065, 0);
  slab(group, surfaces.black, .34, 1.95, .34, .32, 1.10, -.12);
  slab(group, surfaces.moss, .52, 1.08, .40, -.26, .67, .12);
  const cube = mount(group, new T.TetrahedronGeometry(.41), surfaces.ochre, -.13, 1.86, .18);
  cube.rotation.set(.19, .67, -.16);
  return (time: number) => {
    cube.position.y = 1.89 + Math.sin(time * .69) * .13;
    cube.rotation.y = .67 + time * .19;
  };
}

function terraces(group: T.Group, surfaces: Record<string, T.Material>) {
  for (let i = 0; i < 4; i++) {
    const height = .13 + i * .09;
    slab(group, i > 2 ? surfaces.moss : surfaces.warm, .43, height, 1.07, i * .43 - .64, height / 2, 0);
  }
}

const objects = [
  { build: screen, x: -3.02, z: -2.72, yaw: -.13, radius: 1.04 },
  { build: armature, x: 1.26, z: -2.69, yaw: .13, radius: .91 },
  { build: spire, x: 3.91, z: .52, yaw: .15, radius: .70 },
  { build: terraces, x: -3.23, z: 2.13, yaw: -.34, radius: .75 },
] as const;

export const anchors: GroundPoint[] = [[-2.66, -.57], [.68, -.56], [1.8, 1.82], [-.6, 2.09], [3.05, -1.31], [-.2, .75]];
export const gardenObstacles: Obstacle[] = objects.map(({ x, z, radius }) => ({ x, z, radius }));

export function buildGarden(scene: T.Scene) {
  const root = new T.Group();
  const surfaces = {
    ivory: material(ivory), warm: material(warm), rust: material(rust), moss: material(moss),
    black: material(black), blue: material(blue), ochre: material(ochre),
  };
  const backdrop = mount(scene, new T.PlaneGeometry(200, 200), material('#e7e3d6'), 0, -.69, 0);
  backdrop.rotation.x = -Math.PI / 2;
  backdrop.castShadow = false;
  scene.add(root);

  slab(root, surfaces.black, 10.47, .42, 7.52, 0, -.389, 0, .07);
  slab(root, surfaces.rust, 10.60, .078, 7.60, 0, -.207, 0, .022);
  slab(root, surfaces.ivory, 10.62, .235, 7.65, 0, -.112, 0, .057);
  const panelTone = material('#d3caac');
  const sage = material('#aab197');
  slab(root, panelTone, 3.23, .019, 3.98, -3.3, .006, -.46, .007);
  slab(root, sage, 4.28, .019, 1.68, 2.89, .006, -2.50, .006);
  slab(root, material('#d5bb9c'), 2.40, .016, .59, 2.42, .006, 2.48, .005);

  const path = material('#ae9e82');
  for (let i = 0; i < 4; i++) {
    slab(root, path, .047, .012, 1.0, -.72 + i * .24, .011, .50, .004);
  }
  const gravel = random('garden/perimeter');
  for (let i = 0; i < 11; i++) {
    const x = gravel.range(2.58, 4.59);
    const z = gravel.range(1.86, 2.97);
    const stone = mount(root, new T.DodecahedronGeometry(gravel.range(.061, .14)), i % 3 ? surfaces.warm : surfaces.moss, x, .068, z);
    stone.scale.set(1, .65, .88);
    stone.rotation.y = gravel.range(0, tau);
  }
  const kinetics: Array<(time: number) => void> = [];
  for (const item of objects) {
    const plinth = new T.Group();
    plinth.position.set(item.x, 0, item.z);
    plinth.rotation.y = item.yaw;
    root.add(plinth);
    const animate = item.build(plinth, surfaces);
    if (animate) kinetics.push(animate);
  }

  return { root, animate: (time: number) => kinetics.forEach(animate => animate(time)) };
}

export function inspectionPlinth() {
  const root = new T.Group();
  slab(root, material('#a49a80'), 3.55, .29, 3.55, 0, -.19, 0, .062);
  slab(root, material('#d7cdb8'), 3.63, .10, 3.63, 0, -.054, 0, .044);
  root.visible = false;
  return root;
}
