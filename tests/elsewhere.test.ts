import { describe, expect, it } from 'vitest';
import { makeTerrain, defaultLand, terrainKinds, worldBounds } from '../src/reborn/terrain';
import { GardenMotion } from '../src/reborn/motion';
import { gardenReferences } from '../src/reborn/genome';

describe('Elsewhere terrain',()=>{
  it('is deterministic, finite and changes with seed or elevation',()=>{
    for(const kind of terrainKinds){
      const a=makeTerrain({...defaultLand,kind}),b=makeTerrain({...defaultLand,kind}),c=makeTerrain({...defaultLand,kind,seed:'different'}),flat=makeTerrain({...defaultLand,kind,elevation:0});
      let different=false;
      for(let x=-34;x<=34;x+=2.25)for(let z=-34;z<=34;z+=3.1){
        expect(Number.isFinite(a.height(x,z))).toBe(true);
        expect(a.height(x,z)).toBe(b.height(x,z));
        expect(flat.height(x,z)).toBeCloseTo(0);
        if(Math.abs(a.height(x,z)-c.height(x,z))>.01)different=true;
      }
      expect(different).toBe(true);
      expect(a.anchors).toEqual(b.anchors);expect(a.landmarks).toEqual(b.landmarks);
    }
  });
  it('interpolates the same triangles as the ground mesh',()=>{
    const t=makeTerrain(defaultLand);
    expect(t.height(2.25,-3.25)).toBeCloseTo(.75*t.height(2,-3)+.25*t.height(3,-4)); // on the shared diagonal
    expect(t.height(2.2,3.3)).toBeCloseTo(.5*t.height(2,3)+.2*t.height(3,3)+.3*t.height(2,4));
  });
  it('keeps roaming finite and within the larger field',()=>{
    for(const specimen of [gardenReferences[0],gardenReferences[3],gardenReferences[6]]){
      const t=makeTerrain(defaultLand),motion=new GardenMotion(specimen.genome,t.anchors[0],t.landmarks,.68,{bounds:worldBounds,height:t.height,slope:t.slope});
      const start=[motion.pose.x,motion.pose.z];let travel=0;
      for(let i=0;i<7200;i++){const p=motion.step();if(!Number.isFinite(t.height(p.x,p.z))||Math.abs(p.x)>30||Math.abs(p.z)>30)throw new Error('Invalid field pose');travel=Math.max(travel,Math.hypot(p.x-start[0],p.z-start[1]));}
      expect(travel).toBeGreaterThan(1);
    }
  });
});
