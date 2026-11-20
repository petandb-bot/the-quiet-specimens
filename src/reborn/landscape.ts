import * as T from 'three';
import { makeTerrain, landExtent, gridSpacing } from './terrain';
import type { LandSettings } from './terrain';
import { LandscapeObjects } from './objects/render';
import { landmarksFor } from './world/document';

const colorLow = new T.Color('#899377'), colorHigh = new T.Color('#d6c6a6');
const basin = new T.Color('#a4a58a');
export function buildLandscape(scene: T.Scene, settings: LandSettings) {
  const terrain = makeTerrain(settings);
  const root = new T.Group();
  const geometry = new T.PlaneGeometry(landExtent * 2, landExtent * 2, landExtent * 2 / gridSpacing, landExtent * 2 / gridSpacing);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const tone = new T.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i), h=terrain.height(x,z);
    pos.setY(i,h);
    const heightTone = Math.max(0, Math.min(1, .50 + h / 12 + .10 * Math.sin(x * .19 + z * .13)));
    tone.copy(colorLow).lerp(colorHigh, heightTone).lerp(basin, .13 + .10 * Math.sin(z * .46 + x * .11));
    tone.toArray(colors, i * 3);
  }
  geometry.computeVertexNormals();
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  const groundMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.94});
  const backdropBlend = { value: 0 };
  groundMat.onBeforeCompile = shader => {
    shader.uniforms.backdropBlend=backdropBlend;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float backdropBlend;');
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
  objects.update(landmarksFor(terrain));
  scene.add(root);
  return { root, terrain, ground, groundMat, objects, setBackdrop: (amount: number) => {
    backdropBlend.value = amount;
    const transparent = amount > 0;
    if (groundMat.transparent !== transparent) {
      groundDepth.visible = transparent;
      groundMat.transparent = transparent;
      groundMat.needsUpdate = true;
    }
  }, animate: (time: number) => objects.animate(time), dispose:()=>{
    root.removeFromParent();
    const geometries=new Set<T.BufferGeometry>(), materials=new Set<T.Material>();
    root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }};
}
