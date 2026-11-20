import * as T from 'three';
import { random } from '../core/random';
import type { GardenGenome, GardenPlan } from './genome';
import { specimenMaterials } from './materials';
import { gestures } from './motion';
import type { MotionPose } from './motion';

type Surfaces = ReturnType<typeof specimenMaterials>;
export interface RigGround { height: (x: number, z: number) => number; floor: number }
type Rig = (pose: MotionPose, ground?: RigGround) => void;
type Builder = (root: T.Group, genome: GardenGenome, materials: Surfaces) => Rig;

const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const tau = Math.PI * 2;

function model(parent: T.Group, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = !material.transparent;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function plate(points: readonly (readonly [number, number])[], depth: number, hole?: [number, number, number]) {
  const outline = new T.Shape();
  outline.moveTo(...points[0]);
  for (const point of points.slice(1)) outline.lineTo(...point);
  outline.closePath();
  if (hole) {
    const cut = new T.Path();
    cut.absarc(...hole, 0, tau, true);
    outline.holes.push(cut);
  }
  const geometry = new T.ExtrudeGeometry(outline, {
    depth, bevelEnabled: true, bevelSegments: 2, bevelSize: .033, bevelThickness: .029, curveSegments: 22,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function pin(group: T.Group, radius: number, depth: number, material: T.Material, x: number, y: number, z = 0) {
  return model(group, new T.CylinderGeometry(radius, radius, depth, 16).rotateX(Math.PI / 2), material, x, y, z);
}

function tether(group: T.Group, a: T.Vector3, b: T.Vector3, radius: number, material: T.Material) {
  const vector = b.clone().sub(a);
  const rod = model(group, new T.CylinderGeometry(radius, radius, vector.length(), 7), material);
  rod.position.copy(a).lerp(b, .5);
  rod.quaternion.setFromUnitVectors(v(0, 1, 0), vector.normalize());
  return rod;
}

const hinge: Builder = (root, g, m) => {
  const frame = new T.Group();
  root.add(frame);
  const width = .64 * g.proportion;
  const rise = .72 + g.curvature * .5;
  model(frame, plate([
    [-width, -.11], [width * .45, -.11], [width * 1.10, .23],
    [width * .85, rise * .59], [width * .18, rise], [-width * .44, rise * .80], [-width * .78, .37],
  ], .31, [-width * .03, .37, .12 + g.aperture * .17]), m.shell, 0, .60);
  model(frame, plate([[-.32, 0], [.28, 0], [.42, .11], [.18, .22], [-.41, .16]], .22), m.accent, .08, .64, .22);
  const swing: T.Group[] = [];
  const feet: T.Group[] = [];
  for (const side of [-1, 1]) {
    const knee = new T.Group();
    knee.position.set(side * width * .65, .59, side * .22);
    frame.add(knee);
    model(knee, plate([[-.11, .08], [.14, .08], [.19, -.07], [.01, -.41], [-.27, -.49], [-.33, -.32]], .15), m.dark);
    pin(knee, .124, .28, m.accent, 0, 0);
    pin(knee, .052, .32, m.inner, 0, 0);
    const foot = new T.Group();
    foot.position.set(-.18, -.43, 0);
    knee.add(foot);
    model(foot, plate([[-.27, -.09], [.22, -.09], [.28, -.01], [.09, .09], [-.18, .09]], .26), m.shell);
    swing.push(knee);
    feet.push(foot);
  }
  const lever = new T.Group();
  const leverSize = .56 + g.asymmetry * .47;
  lever.position.set(width * .60, .98 + g.curvature * .25, .19);
  frame.add(lever);
  model(lever, plate([[-.16, -.12], [.17, -.12], [.21, leverSize * .69], [-.05, leverSize], [-.20, leverSize * .78]], .18, [0, leverSize * .63, .085]), m.shell);
  pin(lever, .118, .24, m.dark, 0, .015);
  pin(lever, .054, .26, m.accent, 0, .015);
  tether(frame, v(-width * .41, 1.1, -.20), v(-width * .70, 1.43 + g.asymmetry * .29, -.18), .038, m.accent);

  const toe = new T.Vector3();
  return (p, ground) => {
    const gait = Math.min(1, p.speed * 1.45);
    const fold = p.preparation * .61 + (p.gesture === 'Fold' ? p.action : 0) * .83;
    const stumble = p.gesture === 'Stumble' ? p.action * .48 - p.recovery * .27 : 0;
    lever.rotation.z = -.35 + fold + .19 * Math.sin(p.stride) * gait - stumble;
    frame.position.y = (p.gesture === 'Hop' ? p.action ** 1.75 * .63 : 0) - .085 * fold + Math.abs(Math.sin(p.stride)) * gait * .07;
    frame.rotation.z = .085 * Math.sin(p.stride) * gait - fold * .14 + stumble + p.recovery * Math.sin(p.time * 16) * .055;
    swing.forEach((joint, index) => {
      const step = Math.sin(p.stride + index * Math.PI);
      joint.rotation.z = step * gait * .45 - fold * .26 + p.recovery * .11 * (index - .5);
      feet[index].rotation.z = -.48 * joint.rotation.z;
    });
    if (ground) {
      let correction = 0;
      for (const foot of feet) {
        foot.localToWorld(toe.set(0, -.11, 0));
        correction = Math.max(correction, ground.height(toe.x, toe.z) - toe.y);
      }
      frame.position.y += Math.min(.48, correction);
    }
  };
};

function membraneShape(g: GardenGenome) {
  const positions: number[] = [], indices: number[] = [];
  const rows = 36, columns = 56;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const r = .04 + Math.sin(Math.PI * t) ** .72;
    for (let j = 0; j <= columns; j++) {
      const a = .69 + g.aperture * .78 + j / columns * (tau - g.aperture * 1.32);
      const twist = a + .48 * t * (g.curvature - .25);
      const pulse = 1 + Math.cos(a * (g.modules % 3 + 2) + t * 4.8) * (.05 + g.asymmetry * .15);
      positions.push(
        Math.cos(twist) * r * pulse * .71 * g.proportion,
        (t - .5) * (1.18 + g.curvature * .65) + r * Math.sin(a * 2 + t * 6.1) * .14 * g.asymmetry,
        Math.sin(twist) * r * pulse * .66,
      );
      if (i < rows && j < columns) {
        const a = i * (columns + 1) + j;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const vessel: Builder = (root, g, m) => {
  const pod = new T.Group();
  const inside = new T.Group();
  const envelope = new T.Group();
  root.add(pod);
  pod.add(envelope, inside);
  m.shell.side = T.DoubleSide;
  const hull = model(envelope, membraneShape(g), m.shell);
  if (m.shell.transparent) hull.renderOrder = 3;
  const rails: T.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, y = (t - .5) * (1.18 + g.curvature * .65);
    const r = Math.sin(t * Math.PI) ** .76 * .65 + .025;
    rails.push(v(r * .25, y, r));
  }
  const curve = new T.CatmullRomCurve3(rails);
  model(envelope, new T.TubeGeometry(curve, 28, .034, 7, false), m.accent);
  const rim = model(envelope, new T.TorusGeometry(.37 * g.proportion, .038, 8, 42, Math.PI * (1.25 + g.curvature * .5)), m.dark, 0, -.11);
  rim.rotation.y = -.32;
  rim.rotation.x = -.27;
  const kernel = model(inside, new T.IcosahedronGeometry(.28 + g.aperture * .11, g.modules % 2), m.inner, 0, -.04, .10);
  kernel.scale.set(.76, 1.32, 1);
  for (let i = 0; i < 3; i++) {
    const blade = model(inside, new T.TorusGeometry(.23 + i * .075, .022, 7, 30, Math.PI * 1.55), i === 2 ? m.dark : m.accent, 0, 0, .04);
    blade.rotation.set(.8 + i * .71, .4 - i * .28, i * 1.24);
  }
  let drift = 0, previous = 0;
  return p => {
    const swell = Math.sin(p.time * (1.5 + g.gait)) * .048;
    const squeeze = p.gesture === 'Contract' ? p.action * .21 : .03 * p.action;
    const pulse = p.gesture === 'Pulse' ? p.action * .093 * Math.sin(p.time * 15) : 0;
    pod.position.y = 1.17 + swell + .13 * Math.sin(p.time * .57) * Math.min(1, p.speed * 1.4) - squeeze * .68 - p.preparation * .10;
    const inclination = .13 * Math.sin(p.time * 1.14) + (p.gesture === 'Tilt' ? p.action * .47 : 0) - p.recovery * .12;
    pod.rotation.z = inclination;
    envelope.scale.set(1 + swell + pulse - squeeze, 1 - swell + pulse + squeeze * .32, 1 + swell + pulse - squeeze);
    drift += (inclination - drift) * (1 - Math.exp(-(p.time - previous) * 3.9));
    previous = p.time;
    inside.rotation.z = -drift * 1.62 + p.attention * .21 * Math.sin(p.time * 4.1);
    inside.rotation.x = p.time * .63 * g.gait;
    inside.rotation.y = p.time * .44 + p.action * .56;
    inside.position.y = -.07 + Math.sin(p.time * 1.83 - .70) * .11 + p.attention * .12;
  };
};

const relay: Builder = (root, g, m) => {
  const rng = random(g.seed + '/segment');
  const nodes: T.Group[] = [];
  const links: T.Mesh[] = [];
  const spacing = .31 * g.proportion;
  for (let i = 0; i < g.modules; i++) {
    const cell = new T.Group();
    const width = rng.range(.18, .29) * (i === 0 ? 1.17 : 1);
    const high = (.36 + rng.range(0, .30)) * (i === 0 ? 1.28 : 1.0);
    const angle = rng.range(-.28, .28) * g.asymmetry;
    const rib = model(cell, plate([
      [-width, -.08], [width, -.08], [width * 1.27, high * .37],
      [width * .78, high], [-width * .38, high * .92], [-width * 1.02, high * .43],
    ], .12, [0, high * .53, .092 + g.aperture * .035]), i % 3 === 1 ? m.accent : m.shell);
    rib.rotation.set(angle, Math.PI / 2, .14 - angle);
    model(cell, new T.BoxGeometry(.19, .08, .29 + g.asymmetry * .12), m.dark, 0, -.076);
    pin(cell, .069, .14, m.inner, .02, .10, .15);
    root.add(cell);
    nodes.push(cell);
    if (i) links.push(model(root, new T.CylinderGeometry(.046, .046, 1, 7), m.dark));
  }
  const axis = v(0, 1, 0), boundary = v(0, 0, 0);
  return (p, ground) => {
    const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
    const coil = (p.gesture === 'Coil' ? p.action : 0) * .68 + p.preparation * .38;
    const stretch = p.gesture === 'Stretch' ? p.action * .46 : 0;
    const ripple = p.gesture === 'Ripple' ? p.action * .52 : 0;
    const step = spacing * (1 - p.compression * .24);
    let x = step * (nodes.length - 1) * .51, z = 0;
    nodes.forEach((node, i) => {
      const delay = p.stride - i * .88;
      const bend = (g.curvature - .48) * .51 + coil * (i / nodes.length * 1.75) + .24 * Math.sin(delay) * Math.min(1, p.speed * 2);
      if (i) { x -= step * (1 + stretch) * Math.cos(bend); z += spacing * Math.sin(bend); }
      const land = ground ? ground.height(p.x + x * cos + z * sin, p.z - x * sin + z * cos) - ground.floor : 0;
      node.position.set(x, land + .135 + .055 * Math.sin(delay) * Math.min(1, p.speed * 1.6) + .15 * ripple * Math.sin(p.time * 15 - i * 1.25), z);
      node.rotation.y = bend;
      node.rotation.x = .14 * Math.sin(delay * 1.13) * Math.min(1, p.speed + ripple) + p.recovery * .05;
      if (i) {
        const link = links[i - 1], previous = nodes[i - 1].position;
        link.position.copy(previous).lerp(node.position, .5);
        boundary.subVectors(node.position, previous);
        link.scale.y = boundary.length();
        link.quaternion.setFromUnitVectors(axis, boundary.normalize());
      }
    });
  };
};

export const bodyPlans = {
  HINGE: { build: hinge, actions: gestures.HINGE, radius: g => .68 * g.proportion },
  VESSEL: { build: vessel, actions: gestures.VESSEL, radius: g => .61 * g.proportion + .13 },
  RELAY: { build: relay, actions: gestures.RELAY, radius: g => .226 * (g.modules - 1) * g.proportion + .29 },
} satisfies Record<GardenPlan, { build: Builder; actions: readonly string[]; radius: (genome: GardenGenome) => number }>;

export function buildSpecimen(g: GardenGenome) {
  const root = new T.Group();
  const mats = specimenMaterials(g);
  const animate = bodyPlans[g.plan].build(root, g, mats);
  return {
    root, animate,
    dispose() {
      root.removeFromParent();
      root.traverse(child => { if (child instanceof T.Mesh) child.geometry.dispose(); });
      Object.values(mats).forEach(material => material.dispose());
    },
  };
}
