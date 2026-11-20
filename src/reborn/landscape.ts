import * as T from 'three';
import { makeTerrain, landExtent, gridSpacing } from './terrain';
import type { LandSettings } from './terrain';

const colorLow = new T.Color('#a4ab91'), colorHigh = new T.Color('#ded4b1');
export function buildLandscape(scene: T.Scene, settings: LandSettings) {
  const terrain = makeTerrain(settings);
  const root = new T.Group();
  const geometry = new T.PlaneGeometry(landExtent * 2, landExtent * 2, landExtent * 2 / gridSpacing, landExtent * 2 / gridSpacing);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i), h=terrain.height(x,z);
    pos.setY(i,h);
    const c=colorLow.clone().lerp(colorHigh,Math.max(0,Math.min(1,.5+h/12+.05*Math.sin(x*.24+z*.17))));
    colors.set([c.r,c.g,c.b],i*3);
  }
  geometry.computeVertexNormals();
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  const groundMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.94});
  const backdropBlend={value:0};
  groundMat.onBeforeCompile = shader => {
    shader.uniforms.backdropBlend=backdropBlend;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float backdropBlend;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>','#include <fog_fragment>\n#ifdef USE_FOG\n gl_FragColor.a *= 1.0 - backdropBlend * smoothstep(55.0, 105.0, vFogDepth);\n#endif');
  };
  groundMat.customProgramCacheKey=()=> 'elsewhere-ground-photo-fade';
  const ground=new T.Mesh(geometry,groundMat);
  ground.receiveShadow=true;ground.renderOrder=-10;root.add(ground);
  const mats=['#ad5b40','#506e86','#c1a15c','#485b51','#d4c9af'].map(color=>new T.MeshStandardMaterial({color,roughness:.72}));
  function mesh(parent:T.Group,geo:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0){
    const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const kinetics:Array<(t:number)=>void>=[];
  for (const [i,o] of terrain.landmarks.entries()){
    const g=new T.Group(); g.position.set(o.x,terrain.height(o.x,o.z)-.15,o.z);g.rotation.y=o.yaw;g.scale.setScalar(o.scale);root.add(g);
    const m=mats[i%4];
    if(o.kind==='arch'){
      const s=new T.Shape();s.moveTo(-1.2,0);s.lineTo(1.2,0);s.lineTo(1.2,2.6);s.lineTo(.5,3);s.lineTo(-1.2,3);s.closePath();
      const hole=new T.Path();hole.absarc(0,1.75,.72,0,Math.PI*2,true);s.holes.push(hole);
      mesh(g,new T.ExtrudeGeometry(s,{depth:.25,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:2,curveSegments:32}),m);
    }else if(o.kind==='ring'){
      const ring=mesh(g,new T.TorusGeometry(1.12,.16,12,48),m,0,1.48,0);
      ring.rotation.y=.22;mesh(g,new T.BoxGeometry(.36,.7,.4),mats[4],0,.25,0);
      kinetics.push(t=>{ring.rotation.y=.22+Math.sin(t*.14+i)*.16;});
    }else if(o.kind==='monolith'){
      mesh(g,new T.BoxGeometry(.75,3.6,.68),m,0,1.8,0);
      mesh(g,new T.BoxGeometry(.50,2.45,.5),mats[4],.7,1.225,.22);
      const cap=mesh(g,new T.OctahedronGeometry(.45),mats[2],-.3,4.1,0);
      kinetics.push(t=>{cap.position.y=4.1+.15*Math.sin(t*.75+i);cap.rotation.y=t*.14;});
    }else{
      for(let j=0;j<4;j++){const stone=mesh(g,new T.DodecahedronGeometry(.38+j*.08,0),mats[(i+j)%5],(j-1.5)*.48,.18+j*.05,Math.sin(j)*.38);stone.scale.y=.65;}
    }
  }
  scene.add(root);
  return { root, terrain, groundMat, setBackdrop:(enabled:boolean)=>{backdropBlend.value=enabled?1:0;groundMat.transparent=enabled;groundMat.needsUpdate=true;}, animate:(t:number)=>kinetics.forEach(f=>f(t)), dispose:()=>{
    root.removeFromParent();
    const geometries=new Set<T.BufferGeometry>(), materials=new Set<T.Material>();
    root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }};
}
