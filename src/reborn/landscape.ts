import * as T from 'three';
import { makeTerrain, landExtent, gridSpacing } from './terrain';
import type { LandSettings } from './terrain';
import { LandscapeObjects } from './objects/render';
import { landmarksFor } from './world/document';
import type { WorldObject } from './world/document';
import { defaultSurface } from './environment/settings';
import type { Surface } from './environment/settings';
import { cellKey, cellPoint, editEdge, emptyLand, surfaceFamilies } from './environment/land-edits';
import type { PersonalLand } from './environment/land-edits';
import { QuietWater } from './environment/water';

export function buildLandscape(scene: T.Scene, settings: LandSettings, initialSurface = defaultSurface, layout?: readonly WorldObject[], initialEdits = emptyLand) {
  const terrain = makeTerrain(settings, initialEdits.relief);
  const root = new T.Group();
  const geometry = new T.PlaneGeometry(landExtent * 2, landExtent * 2, landExtent * 2 / gridSpacing, landExtent * 2 / gridSpacing);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrain.height(pos.getX(i), pos.getZ(i)));
  geometry.computeVertexNormals();
  const colors = new T.BufferAttribute(new Float32Array(pos.count * 3), 3);
  const finish = new T.BufferAttribute(new Float32Array(pos.count * 2), 2);
  geometry.setAttribute('color', colors);
  geometry.setAttribute('landFinish', finish);
  const groundMat = new T.MeshStandardMaterial({ vertexColors: true });
  const water = new QuietWater(root);
  const materialColors = Object.fromEntries(Object.entries(surfaceFamilies).map(([key, value]) => [key, new T.Color(value.color)]));
  let edits = initialEdits;
  let surface = initialSurface;
  const low = new T.Color(), high = new T.Color(), accent = new T.Color(), tone = new T.Color();
  const side = landExtent * 2 / gridSpacing + 1;
  const index = (x: number, z: number) => (z + landExtent) * side + x + landExtent;
  const colorVertex = (i: number) => {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
    const heightTone = Math.max(0, Math.min(1, .50 + h / 12 + .10 * Math.sin(x * .19 + z * .13)));
    tone.copy(low).lerp(high, heightTone).lerp(accent, .13 + .10 * Math.sin(z * .46 + x * .11));
    const cell = Math.abs(x) <= editEdge && Math.abs(z) <= editEdge ? edits.paint[cellKey(x, z)] : undefined;
    if (cell) tone.lerp(materialColors[cell[0]], cell[1]);
    colors.setXYZ(i, tone.r, tone.g, tone.b);
    const recipe = cell && surfaceFamilies[cell[0]];
    finish.setXY(i, recipe ? T.MathUtils.lerp(surface.roughness, recipe.roughness, cell[1]) : surface.roughness,
      recipe ? T.MathUtils.lerp(surface.metalness, recipe.metalness, cell[1]) : surface.metalness);
  };
  const setSurface = (next: Surface) => {
    surface = next;
    low.set(surface.low); high.set(surface.high); accent.set(surface.accent);
    for (let i = 0; i < pos.count; i++) colorVertex(i);
    colors.needsUpdate = finish.needsUpdate = true;
  };
  setSurface(initialSurface);
  water.apply(edits.water, terrain);
  const setEdits = (next: PersonalLand) => {
    const old = edits;
    edits = next;
    const changed = new Set<number>();
    if (old.relief !== next.relief) {
      terrain.setRelief(next.relief);
      for (const key of new Set([...Object.keys(old.relief), ...Object.keys(next.relief)])) {
        const n = Number(key);
        if (old.relief[n] === next.relief[n]) continue;
        const [x, z] = cellPoint(n);
        const i = index(x, z);
        pos.setY(i, terrain.height(x, z));
        changed.add(i);
      }
      if (changed.size) {
        pos.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
      }
    }
    if (old.paint !== next.paint) {
      for (const key of new Set([...Object.keys(old.paint), ...Object.keys(next.paint)])) {
        const n = Number(key);
        if (old.paint[n] !== next.paint[n]) changed.add(index(...cellPoint(n)));
      }
    }
    if (changed.size) {
      for (const i of changed) colorVertex(i);
      colors.needsUpdate = finish.needsUpdate = true;
    }
    if (old.relief !== next.relief || old.water !== next.water) water.apply(next.water, terrain);
  };
  const backdropBlend = { value: 0 };
  groundMat.onBeforeCompile = shader => {
    shader.uniforms.backdropBlend = backdropBlend;
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nattribute vec2 landFinish; varying vec2 vLandFinish;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvLandFinish = landFinish;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vLandFinish.x;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vLandFinish.y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float backdropBlend; varying vec2 vLandFinish;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>','#include <fog_fragment>\n#ifdef USE_FOG\n gl_FragColor.a *= 1.0 - backdropBlend * smoothstep(30.0, 98.0, vFogDepth);\n#endif');
  };
  groundMat.customProgramCacheKey=()=> 'elsewhere-ground-photo-fade';
  const ground=new T.Mesh(geometry,groundMat);
  ground.receiveShadow=true;ground.renderOrder=-10;root.add(ground);
  // Resolve the nearest terrain surface before its translucent photo blend.
  const groundDepth = new T.Mesh(geometry, new T.MeshBasicMaterial({ colorWrite: false }));
  groundDepth.renderOrder = -11;
  groundDepth.visible = false;
  root.add(groundDepth);
  const objects = new LandscapeObjects(root, terrain.height);
  objects.update(layout ?? landmarksFor(terrain));
  scene.add(root);
  return { root, terrain, ground, groundMat, objects, setSurface, setEdits, setBackdrop: (amount: number) => {
    backdropBlend.value = amount;
    const transparent = amount > 0;
    if (groundMat.transparent !== transparent) {
      groundDepth.visible = transparent;
      groundMat.transparent = transparent;
      groundMat.needsUpdate = true;
    }
  }, animate: (time: number) => { objects.animate(time); water.animate(time); }, dispose:()=>{
    root.removeFromParent();
    const geometries=new Set<T.BufferGeometry>(), materials=new Set<T.Material>();
    root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }};
}
