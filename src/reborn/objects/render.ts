import * as T from 'three';
import { random } from '../../core/random';
import type { WorldObject } from '../world/document';
import { artifactColors } from './appearance';

type Height = (x: number, z: number) => number;

function mesh(parent: T.Group, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) {
  const part = new T.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.castShadow = !material.transparent;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

export function makeArtifact(object: WorldObject) {
  const group = new T.Group();
  group.userData.objectId = object.id;
  const rng = random('artifact/1/' + object.seed);
  const legacy = object.sourceForm !== undefined && object.appearance === undefined;
  const i = legacy ? object.sourceForm! : Math.floor(rng.range(0, 20));
  const { colors, identity } = artifactColors(object);
  const materials = colors.map(color => new T.MeshStandardMaterial({
    color, roughness: object.finish === 'Mineral' ? .46 : .72, metalness: object.finish === 'Mineral' ? .34 : 0,
  }));
  const shell = materials[identity], pale = materials[4];
  const kinetics: Array<(time: number) => void> = [];
  const vary = (amount: number) => legacy ? 0 : rng.range(-amount, amount);
  switch (object.kind) {
    case 'arch': {
      const w = 1.2 + vary(.21), top = 3 + vary(.38);
      const shape = new T.Shape();
      const hole = new T.Path();
      shape.moveTo(-w, 0);
      shape.lineTo(w, 0);
      if (object.appearance === 2) {
        const profile = random('artifact/arch/2/' + object.seed).pick(['vault', 'cut', 'gate'] as const);
        if (profile === 'vault') {
          shape.lineTo(w, top * .55);
          shape.bezierCurveTo(w, top * 1.15, -w, top * 1.15, -w, top * .55);
          hole.absellipse(0, top * .43, w * .60, top * .28, 0, Math.PI * 2, true);
        } else if (profile === 'cut') {
          shape.lineTo(w, top * .73);
          shape.lineTo(w * .32, top);
          shape.lineTo(-w, top * .88);
          hole.absellipse(w * -.10, top * .46, w * .60, top * .20, 0, Math.PI * 2, true, -.27);
        } else {
          shape.lineTo(w, top);
          shape.lineTo(-w, top);
          hole.moveTo(-w * .52, top * .18);
          hole.lineTo(-w * .52, top * .62);
          hole.lineTo(0, top * .79);
          hole.lineTo(w * .52, top * .62);
          hole.lineTo(w * .52, top * .18);
          hole.closePath();
        }
      } else {
        shape.lineTo(w, top - .4);
        shape.lineTo(.5 + vary(.25), top);
        shape.lineTo(-w, top);
        hole.absellipse(vary(.18), 1.75 + vary(.21), .72 + vary(.09), .72 + vary(.15), 0, Math.PI * 2, true);
      }
      shape.closePath();
      shape.holes.push(hole);
      mesh(group, new T.ExtrudeGeometry(shape, { depth: .25 + vary(.12), bevelEnabled: true,
        bevelSize: .035, bevelThickness: .025, bevelSegments: 2, curveSegments: 32 }), shell);
      break;
    }
    case 'ring': {
      const ring = mesh(group, new T.TorusGeometry(1.12 + vary(.15), .16 + vary(.05), 12, 48, Math.PI * 2 - (legacy ? 0 : rng.range(0, .6))), shell, 0, 1.48);
      mesh(group, new T.BoxGeometry(.36, .7, .4), pale, 0, .25);
      const tilt = vary(.32);
      kinetics.push(t => { ring.rotation.y = .22 + Math.sin(t * .14 + i) * .16; ring.rotation.z = tilt; });
      break;
    }
    case 'monolith': {
      const scale = 1 + vary(.22);
      mesh(group, new T.BoxGeometry(.75, 3.6 * scale, .68), shell, 0, 1.8 * scale);
      mesh(group, new T.BoxGeometry(.50, 2.45, .5), pale, .7, 1.225, .22);
      const cap = mesh(group, new T.OctahedronGeometry(.45 + vary(.12)), materials[2], -.3, 4.1 * scale);
      kinetics.push(t => { cap.position.y = 4.1 * scale + .15 * Math.sin(t * .75 + i); cap.rotation.y = t * .14; });
      break;
    }
    case 'stones':
      for (let j = 0; j < 4; j++) {
        const stone = mesh(group, new T.DodecahedronGeometry(.38 + j * .08 + vary(.11), 0), materials[(i + j) % 5],
          (j - 1.5) * .48, .18 + j * .05, Math.sin(j) * .38 + vary(.22));
        stone.scale.y = .65 + vary(.17);
      }
      break;
    case 'flora': {
      mesh(group, new T.CylinderGeometry(.28, .39, .19, 7), materials[3], 0, .1);
      const count = Math.floor(rng.range(3, 6));
      for (let stem = 0; stem < count; stem++) {
        const arm = new T.Group();
        const angle = 2 * Math.PI * stem / count + vary(.28);
        arm.rotation.y = angle;
        group.add(arm);
        const tube = new T.QuadraticBezierCurve3(new T.Vector3(0, .1, 0), new T.Vector3(.15, .95, 0), new T.Vector3(.68, 1.75 + vary(.42), 0));
        mesh(arm, new T.TubeGeometry(tube, 11, .046, 6), materials[3]);
        const tip = tube.getPoint(1);
        const leaf = mesh(arm, new T.IcosahedronGeometry(.43, 1), stem % 2 ? shell : materials[2], tip.x, tip.y, 0);
        leaf.scale.set(.56, 1.46 + vary(.35), .14);
        leaf.rotation.z = -.47;
        kinetics.push(t => { arm.rotation.z = Math.sin(t * .55 + angle) * .072; leaf.rotation.y = Math.sin(t * .66 + angle) * .22; });
      }
      break;
    }
    case 'kinetic': {
      mesh(group, new T.CylinderGeometry(.39, .55, .22, 6), pale, 0, .11);
      mesh(group, new T.CylinderGeometry(.05, .12, 2.25, 8), shell, 0, 1.15);
      const pivot = new T.Group();
      pivot.position.y = 2.24;
      group.add(pivot);
      const length = 1.15 + vary(.27);
      mesh(pivot, new T.BoxGeometry(length * 2, .07, .078), pale);
      mesh(pivot, new T.OctahedronGeometry(.32), materials[2], length, -.27);
      mesh(pivot, new T.CylinderGeometry(.22, .27, .17, 9), shell, -length, -.12);
      const velocity = .29 + rng.range(0, .24);
      kinetics.push(t => {
        pivot.rotation.z = Math.sin(t * velocity) * .37 + .063 * Math.sin(t * 1.41);
        pivot.rotation.y = t * .13 + Math.sin(t * .39) * .6;
      });
      break;
    }
  }
  const used = new Set<T.Material>();
  group.traverse(node => {
    if (node instanceof T.Mesh) {
      used.add(node.material as T.Material);
      if (object.distant) node.castShadow = false;
    }
  });
  for (const material of materials) if (!used.has(material)) material.dispose();
  const animate = (time: number) => { for (const apply of kinetics) apply(time); };
  animate(0);
  return { group, animate, dispose() {
    group.removeFromParent();
    group.traverse(child => { if (child instanceof T.Mesh) child.geometry.dispose(); });
    for (const material of used) material.dispose();
  } };
}

function place(group: T.Group, item: WorldObject, land: Height) {
  group.position.set(item.x, land(item.x, item.z) + item.height - (item.layoutIndex === undefined ? 0 : .15), item.z);
  group.rotation.y = item.yaw;
  group.scale.setScalar(item.scale);
}

export class LandscapeObjects {
  private active = new Map<string, ReturnType<typeof makeArtifact> & { item: WorldObject }>();
  private preview?: ReturnType<typeof makeArtifact> & { item: WorldObject };

  constructor(private parent: T.Group, private height: Height) {}

  update(objects: readonly WorldObject[]) {
    const ids = new Set(objects.map(item => item.id));
    for (const [id, record] of this.active) if (!ids.has(id)) {
      record.dispose();
      this.active.delete(id);
    }
    for (const item of objects) {
      let record = this.active.get(item.id);
      if (record && record.item === item) continue;
      if (!record || record.item.seed !== item.seed || record.item.kind !== item.kind || record.item.finish !== item.finish || record.item.appearance !== item.appearance || record.item.distant !== item.distant) {
        record?.dispose();
        record = { ...makeArtifact(item), item };
        this.active.set(item.id, record);
        this.parent.add(record.group);
      }
      record.item = item;
      place(record.group, item, this.height);
    }
  }

  groups() { return Array.from(this.active.values(), record => record.group); }

  drag(item?: WorldObject) {
    if (!item) {
      for (const record of this.active.values()) place(record.group, record.item, this.height);
      return;
    }
    const current = this.active.get(item.id);
    if (current) place(current.group, item, this.height);
  }

  hideDraft() { if (this.preview) this.preview.group.visible = false; }

  draft(item?: WorldObject) {
    if (this.preview && (!item || item.seed !== this.preview.item.seed || item.kind !== this.preview.item.kind || item.finish !== this.preview.item.finish || item.appearance !== this.preview.item.appearance)) {
      this.preview.dispose();
      this.preview = undefined;
    }
    if (!item) return;
    if (!this.preview) {
      const ghost = makeArtifact(item);
      const materials = new Set<T.Material>();
      ghost.group.traverse(child => {
        if (!(child instanceof T.Mesh)) return;
        child.castShadow = false;
        child.receiveShadow = false;
        materials.add(child.material as T.Material);
      });
      for (const material of materials) {
        material.transparent = true;
        material.opacity = .46;
        material.depthWrite = false;
      }
      this.parent.add(ghost.group);
      this.preview = { ...ghost, item };
    }
    this.preview.group.visible = true;
    place(this.preview.group, item, this.height);
  }

  animate(time: number) {
    for (const item of this.active.values()) item.animate(time);
    this.preview?.animate(time);
  }
}
