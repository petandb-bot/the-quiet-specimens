import { clamp, random } from '../../core/random';
import { gardenMaterials, gardenPlans, gardenSpecimen, fromGardenSeed } from '../genome';
import type { GardenMaterial, GardenPlan, GardenSpecimen } from '../genome';
import { sizes, specimenProfile } from './profiles';
import type { SpecimenSize } from './profiles';

export const temperaments = ['Quiet', 'Curious', 'Cautious', 'Restless', 'Unpredictable'] as const;
export const policies = ['Reference', 'Mixed', 'Wild'] as const;
export type ResidentPolicy = typeof policies[number];
export type Temperament = typeof temperaments[number];
export type SpecimenRecipe = {
  seed: string; body: GardenPlan | 'Any'; material: GardenMaterial | 'Any'; size: SpecimenSize; temperament: Temperament;
};

export const validSpecimenSeed = (value: string) => /^[a-z0-9._-]{1,24}$/i.test(value);

const bodies = ['Any', ...gardenPlans] as const;
const materials = ['Any', ...gardenMaterials] as const;
const tones = {
  Quiet: [.38, .52, .86, .70], Curious: [.88, .39, .44, 1],
  Cautious: [.39, .88, .72, .82], Restless: [.73, .33, .19, 1.22], Unpredictable: [.63, .56, .47, 1.01],
} as const;

export function personalSpecimen(recipe: SpecimenRecipe): GardenSpecimen {
  const seed = ['PL1', encodeURIComponent(recipe.seed), bodies.indexOf(recipe.body), materials.indexOf(recipe.material),
    sizes.indexOf(recipe.size), temperaments.indexOf(recipe.temperament)].join(':');
  const rng = random('personal/1/' + seed);
  const [curiosity, caution, patience, gait] = tones[recipe.temperament];
  const spread = recipe.temperament === 'Unpredictable' ? .26 : .12;
  const sample = (amount: number) => clamp(amount + rng.range(-spread, spread));
  const specimen = gardenSpecimen(seed, undefined, {
    ...(recipe.body === 'Any' ? {} : { plan: recipe.body }),
    ...(recipe.material === 'Any' ? {} : { material: recipe.material }),
    curiosity: sample(curiosity), caution: sample(caution), patience: sample(patience),
    gait: clamp(gait + rng.range(-spread, spread), .45, 1.4),
  });
  const profile = specimenProfile(recipe.size);
  specimen.genome.sound.interval *= profile.interval;
  specimen.genome.sound.register /= Math.sqrt(profile.scale);
  return { ...specimen, size: recipe.size, recipe };
}

function materialVariant(source: GardenSpecimen, material: GardenMaterial): GardenSpecimen {
  const shapeSeed = source.genome.shapeSeed ?? source.genome.seed;
  const seed = 'PM1:' + gardenMaterials.indexOf(material) + ':' + shapeSeed;
  return { ...source, recipe: source.recipe && { ...source.recipe, material },
    genome: { ...source.genome, seed, shapeSeed, material } };
}

export function replayPersonalSpecimen(seed: string): GardenSpecimen | undefined {
  const variant = /^PM1:([0-5]):(.{1,150})$/.exec(seed);
  if (variant && !variant[2].startsWith('PM1:')) {
    const base = replayPersonalSpecimen(variant[2]) ?? fromGardenSeed(variant[2]);
    return materialVariant(base, gardenMaterials[Number(variant[1])]);
  }
  const [version, encoded, b, m, s, t, extra] = seed.split(':');
  if (version !== 'PL1' || !encoded || extra !== undefined || ![b, m, s, t].every(value => /^\d$/.test(value))) return undefined;
  const body = bodies[Number(b)], material = materials[Number(m)], size = sizes[Number(s)], temperament = temperaments[Number(t)];
  if (!body || !material || !size || !temperament) return undefined;
  if (!validSpecimenSeed(encoded)) return undefined;
  return personalSpecimen({ seed: encoded, body, material, size, temperament });
}

export function mutateSpecimen(item: GardenSpecimen, aspect: 'Form' | 'Material', seed: string) {
  const rng = random('mutation/1/' + item.genome.seed + '/' + seed);
  if (aspect === 'Material') return materialVariant(item, rng.pick(gardenMaterials.filter(candidate => candidate !== item.genome.material)));
  return personalSpecimen({ seed, body: item.genome.plan, material: item.genome.material, size: item.size ?? 'Medium', temperament: item.recipe?.temperament ?? 'Unpredictable' });
}
