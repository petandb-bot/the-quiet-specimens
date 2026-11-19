import { Color, MeshPhysicalMaterial } from 'three';
import type { MeshPhysicalMaterialParameters } from 'three';
import type { GardenGenome, GardenMaterial } from './genome';

const qualities: Record<GardenMaterial, MeshPhysicalMaterialParameters> = {
  CERAMIC: { roughness: .52, metalness: .03, clearcoat: .34, clearcoatRoughness: .55 },
  METALLIC: { roughness: .32, metalness: .79, clearcoat: .20 },
  MEMBRANE: { roughness: .23, metalness: .04, transparent: true, opacity: .56, depthWrite: false, clearcoat: .5, iridescence: .20 },
  MINERAL: { roughness: .53, metalness: .20, flatShading: true, clearcoat: .21 },
  SYNTHETIC: { roughness: .30, metalness: .06, clearcoat: .75, clearcoatRoughness: .40 },
  COMPOSITE: { roughness: .45, metalness: .29, clearcoat: .28 },
};

export function specimenMaterials(genome: GardenGenome) {
  const [skin, trim, pin] = genome.palette;
  const shell = new MeshPhysicalMaterial({ color: skin, ...qualities[genome.material] });
  const accent = new MeshPhysicalMaterial({
    color: trim, roughness: .37, clearcoat: .3, metalness: genome.material === 'COMPOSITE' ? .65 : .13,
  });
  const dark = new MeshPhysicalMaterial({ color: pin, roughness: .43, metalness: .33 });
  const inner = new MeshPhysicalMaterial({
    color: new Color(trim).lerp(new Color('#faf2d0'), .26), metalness: .37, roughness: .32, clearcoat: .4,
  });
  return { shell, accent, dark, inner };
}
