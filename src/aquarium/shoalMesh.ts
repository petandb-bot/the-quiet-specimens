import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mix, random } from '../core/random';
import { patch, vector } from '../morphology/mesh';
import { shoalMembers, shoalPose } from './motion';
import type { Pose, Shoal } from './motion';

const tau = Math.PI * 2;

function bodyGeometry(kind: Shoal) {
  const isGuppy = kind === 'guppies';
  const length = isGuppy ? 1.36 : 1.16;
  const low = new T.Color(isGuppy ? '#2c7599' : '#a53427');
  const high = new T.Color(isGuppy ? '#c4ffeb' : '#ffdf8a');
  const fin = new T.Color(isGuppy ? '#7ca1fb' : '#f56734');
  const trim = new T.Color(isGuppy ? '#e4a1ef' : '#ffc269');
  const shadow = new T.Color('#111821');
  const parts: T.BufferGeometry[] = [];
  const frame = (u: number, v: number) => {
    const a = v * tau;
    const b = .018 + Math.sin(Math.PI * u ** (isGuppy ? 1.10 : 1.32)) ** .65;
    return vector((u - .5) * length, Math.cos(a) * b * (isGuppy ? .18 : .37),
      Math.sin(a) * b * (isGuppy ? .14 : .25));
  };
  parts.push(patch(22, 16, frame, (u, v) => {
    const belly = .38 + Math.cos(v * tau) ** 2 * .31;
    const bar = Math.max(0, Math.sin(u * 37 + v * 9)) ** 5;
    return low.clone().lerp(high, belly + bar * .24);
  }));
  const tail = (u: number, v: number) => {
    const root = frame(.04, .5).multiplyScalar(.94);
    const lateral = (v * 2 - 1);
    const fan = isGuppy ? Math.sin(v * Math.PI) ** .29 : .48 + .52 * Math.abs(lateral);
    return root.add(vector(
      -u * (isGuppy ? .66 : .41) * fan - .057,
      u * lateral * (isGuppy ? .52 : .44) * (.75 + .25 * fan),
      Math.sin(v * tau) * .10 * u ** 2,
    ));
  };
  parts.push(patch(13, 20, tail, (u, v) => {
    const stripes = Math.max(0, Math.cos(v * 44 + u * 3)) ** 4;
    return fin.clone().lerp(trim, .23 + stripes * .48 + u * .19);
  }));
  parts.push(patch(9, 12, (u, v) => frame(mix(.64, .23, v), 0).add(vector(
    -.24 * u, (isGuppy ? .25 : .32) * Math.sin(Math.PI * v) ** .77 * u, Math.sin(v * 7 + u * 4) * .056 * u,
  )), (_u, v) => fin.clone().lerp(high, .20 + Math.sin(Math.PI * v) * .44)));
  for (const side of [-1, 1]) {
    const axis = side === 1 ? .24 : .76;
    parts.push(patch(8, 9, (u, v) => frame(.63 - .24 * v, axis).add(vector(
      -.19 * u, -.20 * u * Math.sin(Math.PI * v), side * .24 * u,
    )), (u, v) => fin.clone().lerp(high, u * .36 + Math.sin(Math.PI * v) * .33)));
    const eye = frame(.83, axis).add(vector(.012, .026, side * .024));
    const ball = new T.SphereGeometry(isGuppy ? .053 : .066, 8, 5);
    ball.scale(1, 1, .57).translate(eye.x, eye.y, eye.z);
    const color = new Float32Array(ball.getAttribute('position').count * 3);
    for (let i = 0; i < color.length; i += 3) shadow.toArray(color, i);
    ball.setAttribute('color', new T.BufferAttribute(color, 3));
    parts.push(ball);
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  return geometry;
}

export function buildShoal(kind: Shoal) {
  const traits = shoalMembers(kind);
  const geometry = bodyGeometry(kind);
  geometry.setAttribute('fishPhase', new T.InstancedBufferAttribute(Float32Array.from(traits, member => member.phase), 1));
  const time = { value: 0 };
  const material = new T.MeshStandardMaterial({
    vertexColors: true, side: T.DoubleSide, roughness: .46, metalness: kind === 'guppies' ? .27 : .08,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.shoalTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute float fishPhase;
      uniform float shoalTime;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float fin = smoothstep(-0.04, 1.23, -position.x);
      transformed.z += fin * fin * sin(shoalTime * 6.8 + fishPhase + fin * 3.0) * 0.38;
      transformed.y += fin * sin(shoalTime * 3.9 + fishPhase + fin * 4.0) * 0.055;`);
  };
  const mesh = new T.InstancedMesh(geometry, material, traits.length);
  mesh.name = kind;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  // Fish move around the full chamber, so the origin mesh bounds cannot cull a formation.
  mesh.frustumCulled = false;
  const rng = random(kind + '/hue');
  for (let i = 0; i < traits.length; i++) {
    const tint = new T.Color('#ffffff');
    if (kind === 'guppies') tint.setRGB(rng.range(.68, 1), rng.range(.74, 1), rng.range(.81, 1));
    else tint.setRGB(1, rng.range(.70, 1), rng.range(.60, .95));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const transform = new T.Object3D();
  const pose: Pose = { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0 };
  return {
    mesh,
    update(elapsed: number, count: number) {
      time.value = elapsed;
      mesh.count = count;
      mesh.visible = count > 0;
      for (let i = 0; i < count; i++) {
        const member = traits[i];
        shoalPose(kind, member, elapsed, pose);
        transform.position.set(...pose.position);
        transform.rotation.set(pose.roll, pose.yaw, pose.pitch, 'YXZ');
        transform.scale.setScalar(member.size);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
