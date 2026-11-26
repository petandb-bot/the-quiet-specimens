import * as T from 'three';
import { random } from '../../core/random';
import type { WorldObject } from '../world/document';

export function buildPersonalFamily(root: T.Group, object: WorldObject, materials: T.MeshStandardMaterial[]) {
  const rng = random('object/family/1/' + object.kind + '/' + object.seed);
  const [shell, cool, warm, stem, pale] = materials;
  const add = (geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const rod = (from: T.Vector3, to: T.Vector3, thickness: number, material = stem) => {
    const direction = new T.Vector3().subVectors(to, from);
    const mesh = add(new T.CylinderGeometry(thickness * .68, thickness, direction.length(), 6), material);
    mesh.position.copy(from).lerp(to, .5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
  };

  switch (object.kind) {
    case 'hollow': {
      const edges = rng.pick([5, 6, 8]);
      const radii = [0, .5, 1, 1.5, 2].map((height, i) => new T.Vector2(
        i === 4 ? rng.range(.55, .91) : rng.range(.83, 1.28), height * rng.range(.94, 1.08)));
      const profile = [...radii, ...radii.slice().reverse().map(point => new T.Vector2(point.x * .78, point.y + .05))];
      add(new T.LatheGeometry(profile, edges, rng.range(-.6, .4), rng.range(4.5, 5.8)), shell);
      add(new T.CylinderGeometry(.72, .85, .12, edges), pale, 0, .06);
      break;
    }
    case 'fragment': {
      const count = rng.pick([3, 4, 5]), step = rng.range(.27, .43);
      for (let i = 0; i < count; i++) {
        const height = .29 + i * rng.range(.28, .49);
        const strip = add(new T.BoxGeometry(rng.range(.90, 1.85), height, step), i % 3 ? shell : pale,
          rng.range(-.25, .25), height * .5, (i - (count - 1) / 2) * step);
        strip.rotation.y = rng.range(-.21, .21);
      }
      const beam = add(new T.BoxGeometry(.22, rng.range(1.2, 2.35), .26), cool, -.72, .84, .35);
      beam.rotation.z = rng.range(-.48, -.14);
      break;
    }
    case 'aggregate': {
      const nuggets = rng.pick([6, 7, 9]);
      for (let i = 0; i < nuggets; i++) {
        const angle = i * 2.39996, radius = i ? rng.range(.32, 1.05) : 0;
        const shard = add(new T.IcosahedronGeometry(rng.range(.34, .60), rng.pick([0, 1])), materials[i % materials.length],
          Math.cos(angle) * radius, rng.range(.3, .7), Math.sin(angle) * radius);
        shard.scale.set(rng.range(.7, 1.3), rng.range(.7, 2), rng.range(.7, 1.2));
        shard.rotation.set(rng.range(-.6, .6), angle, rng.range(-.4, .4));
      }
      break;
    }
    case 'membrane': {
      const width = rng.range(1.35, 2.15), height = rng.range(1.6, 2.65), curve = rng.range(.23, .52);
      const geometry = new T.PlaneGeometry(width, height, 14, 12);
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i);
        positions.setXYZ(i, x * (.7 + .3 * Math.cos(y / height * Math.PI)),
          y + height * .52 + x * .22, curve * Math.cos(x * 1.8) * Math.sin(y * 1.7));
      }
      geometry.computeVertexNormals();
      const film = shell.clone();
      film.side = T.DoubleSide; film.transparent = true; film.opacity = .66; film.depthWrite = false; film.roughness = .31;
      add(geometry, film);
      const foot = new T.Vector3(0, 0, 0);
      rod(foot, new T.Vector3(-width * .35, height * .86, .21), .07, pale);
      rod(foot, new T.Vector3(width * .39, height * .68, -.08), .055, stem);
      break;
    }
    case 'canopy': {
      const branchCount = rng.pick([3, 4, 5]), trunk = new T.Vector3(rng.range(-.22, .22), rng.range(1.34, 1.9), 0);
      rod(new T.Vector3(), trunk, .15);
      for (let i = 0; i < branchCount; i++) {
        const theta = i * Math.PI * 2 / branchCount + rng.range(-.43, .43);
        const radius = rng.range(.88, 1.48);
        const end = new T.Vector3(Math.cos(theta) * radius, trunk.y + rng.range(.38, .94), Math.sin(theta) * radius);
        rod(trunk, end, rng.range(.042, .075));
        const leaf = add(new T.IcosahedronGeometry(rng.range(.33, .58), 1), i % 2 ? shell : warm, end.x, end.y, end.z);
        leaf.scale.set(rng.range(1.1, 1.6), .33, rng.range(.8, 1.35));
        leaf.rotation.y = theta;
      }
      break;
    }
    case 'suspension': {
      const y = rng.range(1.86, 2.62), reach = rng.range(.65, 1.12);
      const mast = new T.Vector3(-.69, y, -.14), tip = new T.Vector3(reach, y + .23, .12);
      rod(new T.Vector3(-.78, 0, -.18), mast, .11, shell);
      rod(mast, tip, .075, pale);
      for (let i = 0; i < 2; i++) {
        const hook = mast.clone().lerp(tip, i ? .94 : .55);
        const hanging = hook.clone(); hanging.y -= rng.range(.38, .94);
        rod(hook, hanging, .02, stem);
        add(i ? new T.OctahedronGeometry(.34) : new T.DodecahedronGeometry(.28), i ? warm : cool,
          hanging.x, hanging.y - .20, hanging.z);
      }
      add(new T.BoxGeometry(1.12, .14, .62), pale, -.57, .07, 0);
      break;
    }
  }
}
