import { CatmullRomCurve3, Mesh } from 'three';
import type { Group, Vector3 } from 'three';
import type { Morphology } from '../core/model';
import { mix } from '../core/random';
import type { Surface } from './creature';
import { filament, fin, patch, pearl, vector } from './mesh';

const tau = Math.PI * 2;

function segments(curve: CatmullRomCurve3, radius: (u: number) => number, ribbed: boolean) {
  return (u: number, v: number): Vector3 => {
    const angle = v * tau;
    const tangent = curve.getTangent(u);
    const lateral = vector(-tangent.y, tangent.x, 0).normalize();
    const ribs = ribbed ? 1 + .10 * Math.max(0, Math.cos(u * 95)) ** 5 : 1;
    const width = radius(u) * ribs;
    return curve.getPoint(u).addScaledVector(lateral, Math.cos(angle) * width)
      .add(vector(0, 0, Math.sin(angle) * width * .69));
  };
}

export function buildSeahorse(group: Group, m: Morphology, s: Surface, low: boolean) {
  const height = .90 + m.length * .16;
  const girth = .87 + m.girth * .15;
  const path = new CatmullRomCurve3([
    vector(-.34, -.88, 0), vector(-.24, -.41, 0), vector(.07, -.03, 0),
    vector(.04, .49, 0), vector(-.22, .89, 0), vector(-.14, 1.29, 0), vector(.11, 1.41, 0),
  ]);
  const coil = new CatmullRomCurve3([
    vector(-.34, -.88, 0), vector(-.46, -1.32, 0), vector(-.23, -1.74, 0),
    vector(.22, -1.90, 0), vector(.55, -1.69, 0), vector(.51, -1.37, 0),
    vector(.24, -1.30, 0), vector(.09, -1.47, 0), vector(.25, -1.57, 0),
  ]);
  const body = segments(path, u => girth * (.09 + .33 * Math.sin(Math.PI * u) ** 1.33 + .11 * Math.exp(-((u - .86) ** 2) / .015)), true);
  const tail = segments(coil, u => girth * (.14 * (1 - u) ** .93 + .012), true);
  for (const shape of [body, tail]) {
    group.add(new Mesh(patch(low ? 55 : 82, low ? 20 : 29, shape, (u, v) => {
      const band = Math.max(0, Math.cos(u * 95)) ** 7;
      return s.skin(u * .7, v).lerp(s.light, band * .30);
    }, true), s.bodyMat));
  }
  const snoutPath = new CatmullRomCurve3([vector(.01, 1.26, 0), vector(.24, 1.22, 0), vector(.58, 1.06, 0), vector(.79, 1.08, 0)]);
  const snout = segments(snoutPath, u => mix(.23, .057, u) * girth, false);
  group.add(new Mesh(patch(22, 20, snout, s.skin), s.bodyMat));
  for (const side of [-1, 1]) {
    const eye = vector(.034, 1.25, side * .231 * girth);
    const r = .123 + m.eye * .039;
    pearl(group, eye, r * 1.14, s.jewel, vector(1, 1.05, .61));
    pearl(group, eye.clone().add(vector(.022, .008, side * .071)), r * .78, s.black, vector(.94, 1.08, .71));
    pearl(group, eye.clone().add(vector(.053, .047, side * .125)), r * .23, s.jewel);
    fin(group, (u, v) => body(.62 + .15 * v, side === 1 ? .26 : .74).add(vector(
      -.20 * u, Math.sin(Math.PI * v) * .12 * u, side * .29 * m.fin * u,
    )), s, 7, low);
  }
  fin(group, (u, v) => body(.21 + .31 * v, .49).add(vector(
    -.43 * m.fin * u * Math.sin(Math.PI * v) ** .64,
    .12 * u * v, Math.sin(v * 14 + u * 8) * .047 * u,
  )), s, 11, low);
  for (let i = 0; i < 6; i++) {
    filament(group, u => body(.20 + i * .059, u), s.seam, s.vein, 25, false);
  }
  const horn = (u: number, v: number) => vector(
    -.10 + .34 * (v - .48) - u * .20,
    1.42 + u * (.42 + .10 * Math.sin(v * 15)) * Math.sin(Math.PI * v) ** .71,
    .11 * Math.cos(v * Math.PI) * (1 - u),
  );
  fin(group, horn, s, 5, low);

  const transform = vector(1 + m.curvature * .50, height, 1);
  for (const child of group.children) {
    if (child instanceof Mesh) {
      if (child.geometry.type === 'SphereGeometry') child.position.multiply(transform);
      else child.geometry.scale(transform.x, transform.y, transform.z);
    } else if ('geometry' in child) {
      (child.geometry as import('three').BufferGeometry).scale(transform.x, transform.y, transform.z);
    }
  }
}
