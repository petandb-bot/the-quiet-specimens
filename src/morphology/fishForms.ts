import { Mesh, Vector3 } from 'three';
import type { FishForm, Morphology } from '../core/model';
import { mix, random } from '../core/random';
import type { Surface } from './creature';
import { filament, fin, patch, pearl, vector } from './mesh';

const tau = Math.PI * 2;

interface Profile {
  length: number;
  depth: number;
  width: number;
  shoulder: number;
  taper: number;
  tailReach: number;
  tailSpread: number;
  dorsal: number;
  rearSweep: number;
  paddle: number;
  eye: number;
}

const profiles: Record<FishForm, Profile> = {
  lagoon:  { length: 3.72, depth: .64, width: .45, shoulder: 1.15, taper: .87, tailReach: 1.08, tailSpread: .70, dorsal: .50, rearSweep: .48, paddle: .42, eye: .088 },
  halo:    { length: 3.47, depth: .67, width: .43, shoulder: 1.31, taper: .78, tailReach: 1.83, tailSpread: 1.18, dorsal: .69, rearSweep: .76, paddle: .77, eye: .071 },
  machine: { length: 3.64, depth: .67, width: .60, shoulder: 1.06, taper: .50, tailReach: 1.20, tailSpread: .71, dorsal: .42, rearSweep: .72, paddle: .69, eye: .092 },
  cosmic:  { length: 3.41, depth: .56, width: .42, shoulder: 1.38, taper: .72, tailReach: 1.91, tailSpread: 1.20, dorsal: .93, rearSweep: .94, paddle: .58, eye: .075 },
  round:   { length: 2.53, depth: 1.07, width: .83, shoulder: 1.37, taper: .44, tailReach: .62, tailSpread: .46, dorsal: .27, rearSweep: .18, paddle: .34, eye: .224 },
  blade:   { length: 4.34, depth: .45, width: .37, shoulder: .91, taper: 1.19, tailReach: 1.43, tailSpread: 1.10, dorsal: .86, rearSweep: 1.28, paddle: .92, eye: .061 },
};

type Trunk = (u: number, v: number, radial?: number) => Vector3;
type Figure = { group: import('three').Group; m: Morphology; s: Surface; trunk: Trunk; low: boolean };

function signedPower(x: number, power: number) {
  return Math.sign(x) * Math.abs(x) ** power;
}

function makeTrunk(profile: Profile, m: Morphology, form: FishForm): Trunk {
  return (u, v, radial = 1) => {
    const a = tau * v;
    const radius = (.027 + Math.sin(Math.PI * u ** profile.shoulder) ** profile.taper) * m.girth * radial;
    const face = 1 + Math.cos(a * 3 + u * 16) * .021;
    const cross = form === 'machine' ? .65 : 1;
    const x = (u - .49) * profile.length * m.length;
    const spine = m.curvature * (Math.sin(u * 5.5) - .42) + (form === 'blade' ? u ** 4 * .11 : 0);
    return vector(x, spine + signedPower(Math.cos(a), cross) * radius * profile.depth * face,
      signedPower(Math.sin(a), cross) * radius * profile.width * face * (1 + .19 * m.asymmetry * Math.sin(a)));
  };
}

function body({ group, m, s, trunk, low }: Figure, form: FishForm) {
  if (form !== 'machine') {
    group.add(new Mesh(patch(low ? 63 : 108, low ? 29 : 46, trunk, (u, v) => {
      const tint = s.skin(u, v);
      if (form === 'lagoon') {
        const lateral = Math.exp(-((Math.cos(tau * v) - .05) ** 2) / .014) * Math.sin(Math.PI * u);
        tint.lerp(s.light, lateral * .46);
      } else if (form === 'round') {
        tint.lerp(s.body, .39).lerp(s.light, Math.max(0, -Math.cos(tau * v)) ** 2 * .28);
      }
      return tint;
    }), s.bodyMat));
    return;
  }

  group.add(new Mesh(patch(41, 24, (u, v) => trunk(u, v, .77), () => s.dark), s.bodyMat));
  for (let i = 0; i < 9; i++) {
    const start = i / 9 + .006;
    const end = (i + 1) / 9 - .006;
    group.add(new Mesh(patch(low ? 7 : 11, low ? 23 : 32, (u, v) =>
      trunk(mix(start, end, u), v, .83 + .20 * Math.sin(Math.PI * u) ** .46 + .037 * Math.cos(v * tau * 6)),
    (u, v) => s.dark.clone().lerp(s.body, .57 + .32 * Math.cos(v * tau * 4) ** 2).lerp(s.light,
      (i === 2 || i === 6 ? .20 : .044) * Math.max(0, Math.sin(Math.PI * u))), false), s.bodyMat));
    if (i % 2 === 0) {
      for (const side of [-1, 1]) {
        const at = trunk((start + end) / 2, side === 1 ? .21 : .79, 1.055);
        pearl(group, at, .026 + m.emission * .019, s.jewel, vector(1.4, .70, .68));
      }
    }
  }
}

function eyesAndGills({ group, m, s, trunk }: Figure, profile: Profile, form: FishForm) {
  for (const side of [-1, 1]) {
    const angle = side === 1 ? .214 : .786;
    const eyeCount = form === 'cosmic' || form === 'machine' ? 3 : 1;
    for (let i = 0; i < eyeCount; i++) {
      const eye = trunk((form === 'blade' ? .81 : .84) - i * .075, angle + side * i * .018, .997);
      const radius = profile.eye * (.69 + m.eye * .58) * (1 - i * .22);
      const rim = form === 'round' ? vector(1.06, 1.12, .53) : vector(1.18, .74, .53);
      pearl(group, eye.clone().add(vector(0, 0, side * radius * .23)), radius * 1.14, s.jewel, rim);
      pearl(group, eye.clone().add(vector(.013, .003, side * radius * .56)), radius * .83, s.black, rim);
      pearl(group, eye.clone().add(vector(radius * .30, radius * .32, side * radius * .92)), radius * .22, s.jewel);
    }
    for (let i = 0; i < (form === 'machine' ? 3 : 2); i++) {
      filament(group, u => trunk(.70 + i * .033 + .033 * Math.sin(Math.PI * u), angle + side * mix(-.09, .13, u), 1.018),
        s.trim, form === 'machine' ? s.light : s.dark, 21, false);
    }
    if (form === 'round') {
      const cheek = trunk(.79, angle + side * .10, 1.018);
      pearl(group, cheek, .097, s.jewel, vector(1.40, .55, .31));
    }
    filament(group, u => trunk(.94 + .057 * u, angle + side * (.104 + .064 * u), 1.038),
      s.trim, s.dark, 19, false);
  }
}

function fins({ group, m, s, trunk, low }: Figure, p: Profile, form: FishForm) {
  const cut = form === 'machine' || form === 'blade';
  const sailShape = (v: number) => cut ? 1 - Math.abs(v - .30) / (v < .30 ? .33 : .74) : Math.sin(Math.PI * v) ** .68;
  for (const sign of [-1, 1]) {
    const direction = 1 + sign * m.asymmetry * .26;
    const tail = (u: number, v: number) => {
      const start = trunk(.022 + .028 * v, sign === 1 ? .02 : .48, .78);
      const sweep = form === 'round' ? .78 + .22 * Math.sin(v * Math.PI) : .41 + .58 * v ** .84;
      return start.add(vector(-p.tailReach * m.fin * sweep * u,
        sign * p.tailSpread * m.fin * direction * (form === 'round' ? v : v ** .67) * u,
        u * u * .16 * Math.sin(v * 5.8 + sign)));
    };
    fin(group, tail, s, cut ? 7 : 13, low);
    const dorsal = (u: number, v: number) => {
      const start = trunk(mix(.58, .26, v), sign === 1 ? 0 : .5, .83);
      const span = sailShape(v) * u * (sign === 1 ? 1 : .44) * m.fin;
      return start.add(vector(-p.rearSweep * u * (.26 + .74 * (1 - v)),
        sign * p.dorsal * span, .14 * Math.sin(Math.PI * u) * v));
    };
    fin(group, dorsal, s, cut ? 5 : 11, low);
    const paddle = (u: number, v: number) => {
      const start = trunk(.65 - .11 * v, sign === 1 ? .30 : .70, .91);
      const fan = sailShape(v) * u * p.paddle * m.fin;
      return start.add(vector(-p.rearSweep * u * (.70 + .55 * v) - .25 * u,
        -fan * (form === 'blade' ? .74 : 1.17), sign * (.38 * u + fan * .70) * direction));
    };
    if (cut) {
      group.add(new Mesh(patch(9, 13, paddle, (u, v) => s.dark.clone().lerp(s.body, .43 + .38 * v).lerp(s.light, u ** 5 * .5)), s.bodyMat));
      filament(group, v => paddle(1, v), s.trim, s.light, 26, false);
      filament(group, u => paddle(u, .30), s.seam, s.vein, 19, false);
    } else {
      fin(group, paddle, s, 8, low);
    }
  }
}

function cord({ group, s, low }: Figure, path: (u: number) => Vector3, gauge: number, luminous = false) {
  const geometry = patch(low ? 34 : 62, low ? 6 : 8, (u, v) => {
    const at = path(u);
    const tangent = path(Math.min(1, u + .002)).sub(path(Math.max(0, u - .002))).normalize();
    const side = vector(-tangent.y, tangent.x, 0).normalize();
    const w = tau * v;
    const taper = .61 + .39 * Math.sin(Math.PI * u) ** .45;
    return at.addScaledVector(side, Math.cos(w) * gauge * taper).add(vector(0, 0, Math.sin(w) * gauge * taper));
  }, (_u, v) => s.dark.clone().lerp(s.body, .70 + .25 * Math.sin(v * tau)).lerp(s.light, .21), true);
  group.add(new Mesh(geometry, luminous ? s.jewel : s.bodyMat));
}

function crown(figure: Figure) {
  const { group, s, trunk, m } = figure;
  const radius = .72 + .34 * m.fin;
  const arc = (u: number, r = radius) => {
    const a = mix(-.35, Math.PI * 1.31, u);
    return vector(-.32 + Math.cos(a) * r * 1.17, .67 + Math.sin(a) * r, -.22 + .20 * Math.cos(a + .71));
  };
  cord(figure, u => arc(u), .030, true);
  cord(figure, u => arc(u, radius * 1.115), .019);
  for (let i = 1; i < 10; i++) {
    const u = i / 10;
    const bead = arc(u, radius * 1.19);
    const spike = arc(u, radius * (i === 4 ? 1.42 : 1.27));
    pearl(group, bead, i === 4 ? .077 : .036, s.jewel, vector(.78, 1.19, .76));
    filament(group, t => arc(u).lerp(spike, t), s.trim, s.vein, 10);
  }
  for (const side of [-1, 1]) {
    cord(figure, u => trunk(.33, side === 1 ? .31 : .69, .73).lerp(arc(.90), u).add(vector(0, -.27 * Math.sin(u * Math.PI), side * .1 * u)), .054);
  }
}

function orbit(figure: Figure) {
  const { group, s, trunk, m } = figure;
  for (const side of [-1, 1]) {
    const bow = (u: number, inset = 0) => trunk(mix(.12, .86, u), side === 1 ? .32 : .68, .89).add(vector(
      -.21 * Math.sin(Math.PI * u),
      -(1.06 + .30 * m.fin - inset) * Math.sin(Math.PI * u) ** .87,
      side * (.42 + .30 * m.asymmetry * side) * Math.sin(Math.PI * u),
    ));
    cord(figure, bow, .096 + m.girth * .024);
    filament(group, u => bow(u, .125).add(vector(0, 0, side * .05)), s.trim, s.light, 36, false);
    for (let i = 1; i <= 4; i++) {
      const u = i / 5;
      const bead = bow(u, .30 + .18 * Math.sin(u * Math.PI));
      pearl(group, bead, .045 + .027 * Math.sin(u * Math.PI), s.jewel);
      filament(group, t => bow(u).lerp(bead, t), s.seam, s.vein, 13);
    }
  }
}

function trailing({ group, s, trunk, m }: Figure, form: 'halo' | 'cosmic') {
  const rng = random(m.formSeed + '/streamers');
  for (let i = 0; i < m.appendages; i++) {
    const root = trunk(.10 + .023 * i, .06 + .82 * i / Math.max(1, m.appendages - 1), .9);
    const reach = rng.range(.92, 2.50) * m.fin;
    const direction = rng.range(-1, 1);
    const path = (u: number) => root.clone().add(vector(
      -reach * u,
      (.36 * Math.sin(u * 5.5 + i) + direction * u * (form === 'halo' ? .53 : .81)) * u,
      .30 * Math.cos(u * 5 + i) * u,
    ));
    filament(group, path, i % 2 ? s.trim : s.seam, s.vein, 34);
    if (i % 3 === 0) pearl(group, path(.76), .033, s.jewel);
  }
}

export function buildFishForm(group: Figure['group'], m: Morphology, s: Surface, form: FishForm, low: boolean) {
  const profile = profiles[form];
  const figure: Figure = { group, m, s, trunk: makeTrunk(profile, m, form), low };
  body(figure, form);
  fins(figure, profile, form);
  eyesAndGills(figure, profile, form);
  if (form === 'halo') crown(figure);
  if (form === 'cosmic') orbit(figure);
  if (form === 'halo' || form === 'cosmic') trailing(figure, form);
}
