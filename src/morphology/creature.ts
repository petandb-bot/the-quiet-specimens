import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Material, Morphology, Plan, Specimen } from '../core/model';
import { clamp, mix, random } from '../core/random';
import { filament, fin, patch, pearl, vector } from './mesh';
import { buildFishForm } from './fishForms';

const tau = Math.PI * 2;
const white = new T.Color('#fff4d7');
type Motion = { time: { value: number }; effort: { value: number }; display: { value: number }; rhythm: { value: number } };
type Builder = (group: T.Group, m: Morphology, surface: Surface, seed: string, low: boolean) => void;
export type Surface = ReturnType<typeof surfaces>;

function animate<M extends T.Material>(material: M, plan: Plan, motion: Motion, rigidity = 1) {
  const mode = { FISH: 0, RAY: 1, JELLY: 2 }[plan];
  material.customProgramCacheKey = () => `specimen-${mode}-${rigidity}`;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      swimTime: motion.time, swimEffort: motion.effort, finDisplay: motion.display, swimRhythm: motion.rhythm,
    });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform float swimTime, swimEffort, finDisplay, swimRhythm;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float w = swimTime * swimRhythm;
      float motion = ${rigidity.toFixed(3)} * (0.45 + swimEffort * 0.55);
      #if ${mode} == 0
        float aft = clamp((1.15 - position.x) / 4.6, 0.0, 1.4);
        transformed.z += sin(w * 2.4 + aft * 5.8) * aft * aft * motion * 0.70;
        transformed.y *= 1.0 + finDisplay * aft * 0.24;
      #elif ${mode} == 1
        float wing = abs(position.z);
        transformed.y += sin(w * 1.9 - wing * 1.1 + position.x * 0.5) * wing * motion * 0.24;
        transformed.z *= 1.0 + finDisplay * 0.14;
      #else
        float pulse = sin(w * 2.2 - max(0.0, -position.y) * 0.86);
        float swell = 1.0 + pulse * 0.075 * motion + finDisplay * 0.10;
        transformed.xz *= swell;
        transformed.y += pulse * motion * (position.y > 0.0 ? 0.16 : 0.21);
        transformed.x += sin(w * 1.4 - position.y) * max(0.0, -position.y) * 0.11;
      #endif
    `);
  };
  return material;
}

const familyOptions: Record<Material, T.MeshPhysicalMaterialParameters> = {
  ORGANIC: { metalness: .12, roughness: .52, clearcoat: .36, clearcoatRoughness: .38, sheen: .35 },
  METALLIC: { metalness: .79, roughness: .32, clearcoat: .58, clearcoatRoughness: .25, iridescence: .34 },
  SYNTHETIC: { metalness: .24, roughness: .30, clearcoat: .82, clearcoatRoughness: .33 },
  TRANSLUCENT: { metalness: .16, roughness: .29, clearcoat: .82, iridescence: .55, transparent: true, depthWrite: false },
};

function surfaces(m: Morphology, motion: Motion) {
  const [body, shadow, light] = m.palette.map(c => new T.Color(c));
  const dark = shadow.clone().lerp(body, .22);
  const make = (material: Material, membrane = false) => {
    const properties = familyOptions[material];
    const transparent = membrane || Boolean(properties.transparent);
    return animate(new T.MeshPhysicalMaterial({
      ...properties, vertexColors: true, side: T.DoubleSide,
      roughness: clamp((properties.roughness ?? .4) + .16 * (.5 - m.reflectivity), .18, .7),
      envMapIntensity: .75 + m.reflectivity * .95,
      transparent, opacity: membrane ? .47 + .22 * (1 - m.transparency) : transparent ? .40 + .39 * (1 - m.transparency) : 1,
      depthWrite: !transparent, forceSinglePass: membrane, emissive: light, emissiveIntensity: membrane ? .08 : .014 + m.emission * .019,
    }), m.plan, motion);
  };
  const bodyMat = make(m.material);
  const membrane = make(m.accentMaterial, true);
  const trim = animate(new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .63, depthWrite: false, toneMapped: false }), m.plan, motion);
  const seam = animate(new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .30, depthWrite: false, toneMapped: false }), m.plan, motion);
  const jewel = animate(new T.MeshStandardMaterial({ color: light, emissive: light, emissiveIntensity: .27 + m.emission * .75, roughness: .33, metalness: .16 }), m.plan, motion);
  const black = new T.MeshStandardMaterial({ color: '#09151a', metalness: .3, roughness: .2 });
  const vein = light.clone().lerp(white, .13);
  const skin = (u: number, v: number) => {
    const turbulence = Math.sin(v * tau * 3 + Math.sin(u * 12)) * Math.cos(u * 27 - v * tau * 4);
    const stripes = Math.pow(.5 + .5 * Math.sin(u * 155 + 3 * Math.sin(v * tau) + 2.3 * turbulence), 12);
    const scales = Math.pow(.5 + .5 * Math.cos(u * 194 + .9 * Math.sin(v * tau * 16)), 9)
      * Math.pow(.5 + .5 * Math.sin(v * tau * 23 + 5 * u), 4);
    let motif = stripes * .46 + scales * .55;
    if (m.pattern === 'mottled') motif = Math.pow(clamp(.43 + turbulence * .71), 1.6) * .77;
    if (m.pattern === 'geometric') motif = Number(Math.sin(u * 53 + v * tau * 7) > .26) * .60 + scales * .35;
    if (m.pattern === 'contour') motif = Math.pow(.5 + .5 * Math.sin(u * 29 + 6.4 * Math.sin(v * tau * 2)), 6) * .68;
    return dark.clone().lerp(body, .36 + .41 * Math.abs(Math.cos(v * tau)) + turbulence * .11).lerp(light, clamp(motif, 0, .84));
  };
  const finTint = (u: number, v: number) => {
    const rays = Math.pow(.5 + .5 * Math.cos(v * tau * 17 + Math.sin(u * 7) * .35), 6);
    return dark.clone().lerp(body, .36 + .2 * Math.sin(u * 9 + v * 8)).lerp(light, .11 + rays * .55 + u * .25);
  };
  return { body, dark, light, vein, bodyMat, membrane, trim, seam, jewel, black, skin, finTint };
}

const fish: Builder = (group, m, s, seed, low) => {
  const length = m.length, girth = m.girth, fins = m.fin;
  const trunk = (u: number, v: number) => {
    const radius = (Math.sin(Math.PI * u ** 1.25) ** .75 * (1.02 + .24 * u) + .009) * girth;
    const twist = v * tau;
    const bulge = 1 + .04 * Math.sin(u * 23 + twist * 6) + .018 * Math.cos(twist * 12 + u * 46);
    return vector(mix(-2.03, 2.08, u) * length,
      Math.cos(twist) * radius * .78 * bulge + m.curvature * (u - .55) ** 2 * 2.2,
      Math.sin(twist) * radius * (.44 + .13 * u) * bulge);
  };
  group.add(new T.Mesh(patch(low ? 82 : 124, low ? 38 : 54, trunk, s.skin), s.bodyMat));

  for (const side of [-1, 1]) {
    const angle = side === 1 ? .23 : .77;
    const lateral = trunk(.855, angle);
    const size = .038 + m.eye * .071;
    pearl(group, lateral.clone().add(vector(.005, 0, side * .017)), size * 1.47, s.jewel, vector(1.05, .83, .40));
    pearl(group, lateral.clone().add(vector(.019, .005, side * .054)), size, s.black, vector(1, .87, .52));
    pearl(group, lateral.clone().add(vector(.034, .019, side * .078)), size * .29, s.jewel);
    for (let j = 0; j < 4; j++) {
      filament(group, v => trunk(.64 + .026 * j + .023 * Math.sin(v * Math.PI), angle - .124 + v * .27).add(vector(0, 0, side * .014)), s.seam, s.vein, 18, false);
    }
    for (let j = 0; j < 15; j++) {
      const u = .20 + j * .033;
      const pos = trunk(u, angle + side * (.062 + .015 * Math.sin(u * 30)));
      pearl(group, pos.add(vector(0, 0, side * .014)), .012 + m.emission * .009, s.jewel);
    }

    for (let layer = 0; layer < 2; layer++) {
      fin(group, (u, v) => {
        const sideScale = 1 + side * m.asymmetry * .42;
        const spread = Math.sin(v * Math.PI) ** .75;
        return vector(
          length * mix(.66 - layer * 1.05 - v * (.54 + layer * .07), -.41 - v * (1.78 + layer * .24), u),
          (-.07 - layer * .32 - v * .12 - u * (layer ? .95 : .53) * fins * (spread + .14)) * girth + .19 * Math.sin(u * 3.3 + v * 7) * u,
          side * (.26 + (.58 + spread * .88) * u * sideScale * fins / (layer + 1) + .11 * Math.sin(u * 9 + v * 9) * u),
        );
      }, s, layer ? 12 : 16, low);
    }
  }

  for (const side of [-1, 1]) {
    fin(group, (u, v) => {
      const sail = Math.sin(v * Math.PI) ** .7;
      const edge = 1.29 + sail * .55 + (1 - v) * .25;
      const root = trunk((.83 - v * 2.54 + 2.03) / 4.11, side === 1 ? 0 : .5);
      return vector(
        mix(root.x, (-.19 - v * 2.97 - sail * .18) * length, u),
        mix(root.y * .80, side * edge * fins * (side === 1 ? 1 : .68), u),
        .11 * Math.sin(v * 11 + u * 5) * u + u * (v - .31) * .35 * side,
      );
    }, s, side === 1 ? 26 : 18, low);
  }

  for (const half of [-1, 1]) {
    fin(group, (u, v) => {
      const w = v * Math.PI / 2;
      const scallop = Math.sin(v * 17) * .087;
      return vector(
        -length * (1.83 + .16 * v + u * (1.12 + 1.04 * v ** 1.4 + scallop)),
        half * (.043 + .14 * v + u * Math.sin(w) * fins * (1.14 + .09 * half + m.asymmetry * .18 * half)),
        u * (.13 * Math.sin(v * 8 + half) + .19 * half * v + .12 * Math.sin(u * 4 + v * 15)),
      );
    }, s, 21, low);
  }

  const rng = random(seed + '/appendages');
  for (let i = 0; i < m.appendages; i++) {
    const side = i % 2 ? 1 : -1;
    const k = rng.range(.6, 1.55);
    const spread = rng.range(.35, 1.18) * (m.anomalous ? 1.3 : 1);
    filament(group, u => vector(
      -length * (1.70 + u * (1.86 + k * .58)),
      side * (spread * u ** 1.4 + .18 * Math.sin(u * (6 + i) + i) * u),
      .2 * Math.sin(u * 4 + i) * u + side * .21 * u,
    ), i % 3 === 0 ? s.trim : s.seam, i % 2 ? s.light : s.body, 34);
  }
};

const ray: Builder = (group, m, s, seed, low) => {
  const wing = (u: number, v: number, side: number, underside: boolean) => {
    const span = 2.68 * m.fin * (.93 + side * m.asymmetry * .24);
    const curl = Math.sin((v - .09) * Math.PI);
    const rootFront = 1.75 * m.length, rootRear = -1.95 * m.length;
    const tip = -.72 * m.length - .59 * v;
    const profile = .52 * m.girth * (1 - u ** .62) * Math.sin(v * Math.PI) ** .74;
    return vector(
      mix(mix(rootFront, rootRear, v), tip, u ** .85) + .16 * curl * u,
      (underside ? -profile : profile) + m.curvature * u ** 2 + .2 * Math.sin(v * 5 + u * 3) * u + u ** 4 * .27,
      side * (span * u * (1 - .045 * Math.cos(v * tau)) + .004),
    );
  };
  for (const side of [-1, 1]) {
    for (const underside of [false, true]) {
      const geometry = patch(low ? 34 : 55, low ? 41 : 69, (u, v) => wing(u, v, side, underside), (u, v) => s.skin(v, u * .48 + .2), (side === 1) !== underside);
      group.add(new T.Mesh(geometry, s.bodyMat));
    }
    fin(group, (u, v) => wing(.57 + .42 * u, v, side, false).add(vector(-u * .13, .015 + u * .04, side * .27 * u)), s, 14, low);
    for (let i = 0; i < 8; i++) {
      filament(group, u => wing(u * .92, i * .115 + .07, side, false).add(vector(0, .011, 0)), s.seam, s.vein, 29, false);
    }
    const eye = wing(.10, .159, side, false);
    pearl(group, eye, .053 + m.eye * .037, s.jewel, vector(1.15, .51, .85));
    pearl(group, eye.clone().add(vector(.024, .039, .012 * side)), .039, s.black, vector(1, .46, 1));
    for (let i = 0; i < 7; i++) pearl(group, wing(.31 + i * .087, .19 + .10 * i / 7, side, false).add(vector(0, .025, 0)), .023, s.jewel);
  }
  const rng = random(seed + '/ray');
  for (let i = 0; i < Math.max(1, m.appendages); i++) {
    const x = rng.range(1.0, 3.0) * m.length;
    const offset = (i - m.appendages / 2) * .11;
    const path = (u: number) => vector(-m.length * (1.69 - Math.abs(offset) * 1.3) - x * u,
      -.13 + Math.sin(u * 7 + offset * 7) * .25 * u, offset * (1 + u * 1.7) + .13 * Math.sin(u * 8) * u);
    if (i < 2) {
      const geometry = patch(low ? 22 : 38, 10, (u, v) => path(u).add(vector(0, Math.cos(tau * v) * .075 * (1 - u) + .001, Math.sin(tau * v) * .11 * (1 - u) + .001)), s.finTint, true);
      group.add(new T.Mesh(geometry, s.bodyMat));
    }
    filament(group, path, s.trim, s.vein, 37);
  }
};

const jelly: Builder = (group, m, s, seed, low) => {
  const r = (v: number, z: number) => (1.36 + .15 * Math.cos(v * tau * 9) * (z ** 2)) * m.girth * (1 + .17 * m.asymmetry * Math.sin(v * tau));
  const dome = (u: number, v: number) => {
    const phase = v * tau;
    const ring = Math.sin(u * 1.71) ** .84 * r(v, u) + .001;
    return vector(Math.cos(phase) * ring, .06 + Math.cos(u * 1.69) * (1.35 * m.length) + Math.cos(phase * 9) * .10 * u ** 3, Math.sin(phase) * ring * .9);
  };
  const bell = new T.Mesh(patch(low ? 45 : 70, low ? 55 : 86, dome, (u, v) => s.skin(v, u * .81), true), s.bodyMat);
  bell.renderOrder = 2;
  group.add(bell);
  const interior = (u: number, v: number) => {
    const a = v * tau, radius = Math.sin(u * Math.PI) ** .72;
    return vector(.56 * radius * Math.cos(a), mix(-.48, 1.11 * m.length, u), .47 * radius * Math.sin(a) + .11 * Math.sin(u * Math.PI));
  };
  group.add(new T.Mesh(patch(36, 44, interior, s.finTint), s.membrane));
  for (let i = 0; i < 11; i++) {
    filament(group, u => dome(.13 + u * .87, i / 11), s.trim, s.vein, 30, false);
    filament(group, u => interior(u, i / 11), s.seam, s.vein, 23, false);
  }
  for (const u of [.75, .91, 1]) filament(group, v => dome(u, v), s.trim, s.vein, 89, false);
  const rng = random(seed + '/jelly');
  const count = Math.max(4, m.appendages + 2);
  for (let i = 0; i < count; i++) {
    const a = (i / count + rng.range(-.025, .025)) * tau;
    const radius = (i < 3 ? .42 : .84) * m.girth;
    const reach = rng.range(.72, 2.07) * m.fin * (i < 3 ? 1.31 : .92);
    const wave = rng.range(.12, .35) * (1 + m.asymmetry * .42);
    const phase = rng.range(0, tau);
    const path = (u: number) => vector(
      Math.cos(a) * (radius + .46 * u) + Math.sin(u * 7 + phase) * wave * u,
      -.18 - reach * u + .108 * Math.sin(u * 8 + phase),
      Math.sin(a) * (radius + .31 * u) + Math.cos(u * 8 + phase) * wave * u,
    );
    if (i < 4) {
      const frill = (u: number, v: number) => path(u).add(vector(
        Math.cos(a + Math.PI * .5) * v * (.095 + .20 * Math.sin(Math.PI * u) ** 2) * Math.cos(u * 9 + i),
        -.11 * v * Math.sin(u * 13 + i), Math.sin(a + Math.PI * .5) * v * .20 * Math.sin(u * 8 + i),
      ));
      fin(group, frill, s, 4, low);
    }
    filament(group, path, s.trim, s.vein, 44);
    for (let j = 0; j < 4; j++) pearl(group, path(j / 5), .022 + .012 * m.emission, s.jewel);
  }
};

const builders: Record<Plan, Builder> = { FISH: fish, RAY: ray, JELLY: jelly };

function batchAccents(group: T.Group) {
  const lines = new Map<T.LineBasicMaterial, T.Line[]>();
  const pearls = new Map<T.Material, T.Mesh[]>();
  for (const child of group.children) {
    if (child instanceof T.Line && child.material instanceof T.LineBasicMaterial) {
      const list = lines.get(child.material) ?? [];
      list.push(child);
      lines.set(child.material, list);
    } else if (child instanceof T.Mesh && child.geometry.type === 'SphereGeometry' && child.material instanceof T.Material) {
      const list = pearls.get(child.material) ?? [];
      list.push(child);
      pearls.set(child.material, list);
    }
  }
  for (const [material, list] of lines) {
    const xyz: number[] = [], rgb: number[] = [];
    for (const line of list) {
      const pos = line.geometry.getAttribute('position');
      const color = line.geometry.getAttribute('color');
      for (let i = 1; i < pos.count; i++) {
        xyz.push(pos.getX(i - 1), pos.getY(i - 1), pos.getZ(i - 1), pos.getX(i), pos.getY(i), pos.getZ(i));
        rgb.push(color.getX(i - 1), color.getY(i - 1), color.getZ(i - 1), color.getX(i), color.getY(i), color.getZ(i));
      }
      group.remove(line);
      line.geometry.dispose();
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(xyz, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(rgb, 3));
    const combined = new T.LineSegments(geometry, material);
    combined.renderOrder = 3;
    group.add(combined);
  }
  for (const [material, list] of pearls) {
    const geometries = list.map(mesh => {
      mesh.updateMatrix();
      return mesh.geometry.applyMatrix4(mesh.matrix);
    });
    const combined = mergeGeometries(geometries);
    if (combined) {
      group.remove(...list);
      geometries.forEach(geometry => geometry.dispose());
      group.add(new T.Mesh(combined, material));
    }
  }
}

export function buildCreature(specimen: Specimen, low = false) {
  const group = new T.Group();
  const m = specimen.genome.morphology;
  const motion: Motion = { time: { value: 0 }, effort: { value: .55 }, display: { value: 0 }, rhythm: { value: specimen.genome.behavior.rhythm } };
  const surface = surfaces(m, motion);
  if (m.plan === 'FISH' && m.fishForm) buildFishForm(group, m, surface, m.fishForm, low);
  else builders[m.plan](group, m, surface, m.formSeed, low);
  batchAccents(group);
  const materials = [surface.bodyMat, surface.membrane, surface.trim, surface.seam, surface.jewel, surface.black];
  return { group, motion, dispose: () => {
    group.traverse(child => {
      if (child instanceof T.Mesh || child instanceof T.Line) child.geometry.dispose();
    });
    materials.forEach(material => material.dispose());
  } };
}
