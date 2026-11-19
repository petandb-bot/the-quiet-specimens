import { describe, expect, it } from 'vitest';
import { defaultChoices, engines, fishForms, formsGeneratorVersion, legacyGeneratorVersion, plans } from '../src/core/model';
import { generate, mutate, normalizeGenome, specimen } from '../src/genesis/genome';
import { imageFeatures } from '../src/genesis/image';
import { deserialize, serialize, validateGenome, validateRecord } from '../src/archive/records';
import { featured, references } from '../src/legacy/presets/reference';

describe('Genesis and specimen exchange', () => {
  it('recreates the same genome from choices and seed', () => {
    const a = generate('E07', 'Discover', defaultChoices);
    expect(generate('E07', 'Discover', defaultChoices)).toEqual(a);
    expect(specimen(a).id).toBe(specimen(generate('E07', 'Discover', defaultChoices)).id);
    expect(generate('E08', 'Discover', defaultChoices)).not.toEqual(a);
    expect(generate('E07', 'Discover', ['Frozen Lake', ...defaultChoices.slice(1)] as typeof defaultChoices)).not.toEqual(a);
  });

  it('derives reproducible features, color, and genomes from normalized pixel data', () => {
    const blue = new Uint8ClampedArray([0,0,215,255, 0,20,194,255, 0,0,183,255, 0,20,200,255]);
    const red = new Uint8ClampedArray([250,76,0,255, 180,0,0,255, 220,10,0,255, 255,120,0,255]);
    const features = imageFeatures(blue, 2, 2);
    expect(features.palette[0]).toBe('#000dcb');
    const a = generate(features.seed, 'Extract', undefined, features);
    expect(generate(features.seed, 'Extract', undefined, imageFeatures(blue, 2, 2))).toEqual(a);
    const other = imageFeatures(red, 2, 2);
    expect(other.seed).not.toBe(features.seed);
    expect(generate(other.seed, 'Extract', undefined, other)).not.toEqual(a);
    expect(() => imageFeatures(blue, 3, 2)).toThrow(/usable pixels/);
  });

  it('clamps finite fields and rejects bad types, plans and versions', () => {
    const g = structuredClone(references[0].genome);
    g.morphology.length = 55;
    g.sound.register = -77;
    const validated = validateGenome(g);
    expect(validated.morphology.length).toBe(1.45);
    expect(validated.sound.register).toBe(72);
    expect(() => validateGenome({ ...g, schemaVersion: 2 })).toThrow(/unsupported/);
    expect(() => validateGenome({ ...g, morphology: { ...g.morphology, plan: 'CUBE' } })).toThrow(/valid specimen/);
    expect(() => validateGenome({ ...g, morphology: { ...g.morphology, fishForm: 'unknown' } })).toThrow(/valid specimen/);
    expect(() => validateGenome({ ...g, morphology: { ...g.morphology, plan: 'JELLY', fishForm: 'halo' } })).toThrow(/valid specimen/);
    expect(() => validateGenome({ ...g, behavior: { ...g.behavior, speed: Infinity } })).toThrow(/valid specimen/);
    expect(() => validateGenome({ ...g, sound: { ...g.sound, pitches: ['0'] } })).toThrow(/valid specimen/);
  });

  it('bounds all mutation modes and preserves parent and lineage', () => {
    const parent = structuredClone(references[2]);
    const original = structuredClone(parent);
    let unchangedMorphology = 0;
    for (const mode of ['Subtle', 'Strange', 'Anomaly'] as const) {
      for (let i = 0; i < 36; i++) {
        const child = mutate(parent, 'a' + i, mode);
        expect(child).toEqual(normalizeGenome(child));
        expect(child.lineage).toEqual([parent.id]);
        expect(child.generation).toBe(2);
        if (child.morphology.formSeed === parent.genome.morphology.formSeed) {
          expect(child.morphology).toEqual(parent.genome.morphology);
          unchangedMorphology++;
        }
        if (mode === 'Anomaly') expect(child.morphology.anomalous).toBe(true);
      }
    }
    expect(parent).toEqual(original);
    expect(unchangedMorphology).toBeGreaterThan(0);
  });

  it('includes eight named fish forms and retains the previous reference IDs', () => {
    expect(references).toHaveLength(21);
    expect(new Set(references.map(s => s.id)).size).toBe(21);
    expect(featured.map(item => item.genome.morphology.fishForm)).toEqual(fishForms);
    expect(references.find(item => item.name === 'Ember Veil')?.id).toBe('QS-21019D32');
    expect(references.find(item => item.name === 'Vesper Crown')?.id).toBe('QS-698FBF22');
    const seen = new Set(Array.from({ length: 120 }, (_, i) => generate(String(i), 'Discover').morphology.fishForm));
    expect(seen.has('arowana')).toBe(true);
    expect(seen.has('seahorse')).toBe(true);
    expect(new Set(references.map(s => s.genome.morphology.plan))).toEqual(new Set(plans));
    expect(new Set(references.map(s => s.genome.sound.engine))).toEqual(new Set(engines));
  });

  it('replays original generator seeds and round-trips the original fish genome', () => {
    const generateOriginal = () => generate('E07', 'Discover', defaultChoices, undefined, legacyGeneratorVersion);
    const original = generateOriginal();
    expect(original).toEqual(generateOriginal());
    expect(original.morphology.fishForm).toBeUndefined();
    expect(JSON.stringify(original)).not.toEqual(JSON.stringify(generate('E07', 'Discover', defaultChoices)));
    const prior = Array.from({ length: 32 }, (_, i) => generate(String(i), 'Discover', defaultChoices, undefined, formsGeneratorVersion));
    expect(prior.every(g => g.generatorVersion === formsGeneratorVersion && g.morphology.fishForm !== 'arowana' && g.morphology.fishForm !== 'seahorse')).toBe(true);
    const ember = references.find(item => item.id === 'QS-21019D32')!;
    expect(deserialize(serialize(ember)).genome).toEqual(ember.genome);
  });

  it('round-trips a versioned record, metadata, and a legacy unwrapped record', () => {
    const reference = structuredClone(references[5]);
    reference.user.favorite = true;
    reference.user.thumbnail = 'data:image/jpeg;base64,aaaa';
    expect(deserialize(serialize(reference))).toEqual(reference);
    expect(deserialize(JSON.stringify(reference))).toEqual(reference);
    expect(validateRecord({ ...reference, user: { thumbnail: 'https://example.test/image.png' } }).user.thumbnail).toBeUndefined();
  });

  it('handles corrupted and unsupported JSON separately', () => {
    expect(() => deserialize('{')).toThrow(/valid JSON/);
    expect(() => deserialize('null')).toThrow(/valid specimen/);
    expect(() => deserialize('"' + '0'.repeat(450_001) + '"')).toThrow(/large/);
    expect(() => deserialize(JSON.stringify({ format: 'quiet-specimen', version: 2, specimen: references[0] }))).toThrow(/unsupported/);
  });
});
