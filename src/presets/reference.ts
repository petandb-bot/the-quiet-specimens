import { legacyGeneratorVersion } from '../core/model';
import type { FishForm, Morphology, Personality, Sonotype } from '../core/model';
import { generate, normalizeGenome, paletteBank, specimen } from '../genesis/genome';

type Entry = [string, Partial<Morphology>, Partial<Personality>, Partial<Sonotype>];
const census: Entry[] = [
  ['Ember Veil', { plan: 'FISH', material: 'METALLIC', accentMaterial: 'TRANSLUCENT', pattern: 'striated', length: 1.02, girth: 1.13, curvature: .04, asymmetry: .16, reflectivity: .87, transparency: .7, fin: 1.43, appendages: 7, eye: .32, emission: .78 }, { speed: .61, activity: .37, preferred: 'DISPLAY' }, { engine: 'Hollow Pulse', register: 183, envelope: 1.5 }],
  ['Glacial Nacre', { plan: 'JELLY', material: 'TRANSLUCENT', accentMaterial: 'ORGANIC', pattern: 'contour', length: .91, girth: 1.28, fin: .84, appendages: 9 }, { speed: .34, rest: 7, preferred: 'HOVER' }, { engine: 'Thin Membrane', register: 315, envelope: 2.7 }],
  ['Vesper Lattice', { plan: 'RAY', material: 'SYNTHETIC', accentMaterial: 'TRANSLUCENT', pattern: 'geometric', length: 1.23, girth: .84, fin: 1.43 }, { speed: .91, turning: 2.1, preferred: 'TURN' }, { engine: 'Metallic Residue', register: 139, resonance: .83 }],
  ['Coral Wake', { plan: 'FISH', material: 'ORGANIC', accentMaterial: 'ORGANIC', pattern: 'mottled', length: .74, girth: 1.32, fin: 1.24 }, { speed: 1.25, activity: .88, preferred: 'DART' }, { engine: 'Soft Debris', noise: .68 }],
  ['Moss Circuit', { plan: 'RAY', material: 'ORGANIC', accentMaterial: 'SYNTHETIC', pattern: 'mottled', length: .8, girth: 1.12, fin: 1.26 }, { curiosity: .88, preferred: 'INSPECT' }, { engine: 'Soft Debris', register: 186 }],
  ['Tin Minnow', { plan: 'FISH', material: 'METALLIC', accentMaterial: 'SYNTHETIC', pattern: 'geometric', length: 1.45, girth: .6, fin: .71, reflectivity: .95 }, { speed: 1.35, activity: .78, preferred: 'STARTLE' }, { engine: 'Metallic Residue', register: 412 }],
  ['Ivory Halo', { plan: 'JELLY', material: 'TRANSLUCENT', accentMaterial: 'METALLIC', pattern: 'striated', length: .66, girth: 1.3, fin: .61, appendages: 5 }, { speed: .41, preferred: 'REST' }, { engine: 'Hollow Pulse', register: 86, interval: 6.5 }],
  ['Bathyal Echo', { plan: 'RAY', material: 'METALLIC', accentMaterial: 'TRANSLUCENT', pattern: 'contour', length: 1.1, girth: .66, fin: 1.53 }, { speed: .52, depth: -.6, preferred: 'HOVER' }, { engine: 'Thin Membrane', register: 217 }],
  ['Silt Oracle', { plan: 'FISH', material: 'SYNTHETIC', accentMaterial: 'ORGANIC', pattern: 'geometric', length: 1.13, girth: 1.1, curvature: -.28, asymmetry: .59, fin: 1.04 }, { activity: .34, preferred: 'REST' }, { engine: 'Hollow Pulse', register: 121, interval: 6 }],
  ['Umbral Bloom', { plan: 'JELLY', material: 'ORGANIC', accentMaterial: 'TRANSLUCENT', pattern: 'mottled', anomalous: true, asymmetry: .79, length: 1.4, appendages: 12 }, { speed: .59, preferred: 'TUMBLE' }, { engine: 'Metallic Residue', register: 272 }],
  ['Mercury Kite', { plan: 'RAY', material: 'SYNTHETIC', accentMaterial: 'METALLIC', pattern: 'striated', length: 1.1, girth: 1.22, fin: .63 }, { speed: 1.16, turning: 2.2, preferred: 'DART' }, { engine: 'Hollow Pulse', register: 260 }],
  ['Saffron Spindle', { plan: 'FISH', material: 'TRANSLUCENT', accentMaterial: 'SYNTHETIC', pattern: 'contour', anomalous: true, length: 1.31, girth: .68, asymmetry: .78, fin: 1.3, appendages: 10 }, { activity: .6, preferred: 'DISPLAY' }, { engine: 'Soft Debris', register: 179 }],
];

const originals = census.map(([name, morphology, behavior, sound], i) => {
  const seed = (i === 0 ? 'E8F419C2' : (0x32a4b057 + 0x46d9b1 * i).toString(16).toUpperCase());
  const genome = generate(seed, 'Reference', undefined, undefined, legacyGeneratorVersion);
  const record = specimen(normalizeGenome({
    ...genome,
    morphology: { ...genome.morphology, ...morphology, palette: paletteBank[i] },
    behavior: { ...genome.behavior, ...behavior },
    sound: { ...genome.sound, ...sound },
  }), name);
  return { ...record, discoveredAt: '2026-01-01T00:00:00.000Z' };
});

type FeaturedEntry = [FishForm, string, Partial<Morphology>, Partial<Personality>, Partial<Sonotype>];
const gallery: FeaturedEntry[] = [
  ['lagoon', 'Reedfin', {
    length: 1.19, girth: .83, curvature: .02, eye: .43, fin: .94, emission: .16,
    material: 'ORGANIC', accentMaterial: 'ORGANIC', pattern: 'contour',
    palette: ['#6e9a74', '#163c43', '#e7d8a0'],
  }, { speed: .75, rhythm: 1.12, curiosity: .49, preferred: 'CRUISE' }, { engine: 'Hollow Pulse', register: 210 }],
  ['halo', 'Vesper Crown', {
    length: 1.12, girth: .81, curvature: .15, eye: .22, fin: 1.32, appendages: 8, emission: .61,
    material: 'METALLIC', accentMaterial: 'TRANSLUCENT', pattern: 'contour', reflectivity: .6, transparency: .8,
    palette: ['#d59053', '#66416d', '#fff0b0'],
  }, { speed: .50, rhythm: .62, activity: .34, caution: .18, preferred: 'DISPLAY' }, { engine: 'Thin Membrane', register: 261, envelope: 2.1 }],
  ['machine', 'Rivet Nine', {
    length: 1.12, girth: 1.06, curvature: .01, eye: .42, fin: 1.05, emission: .72,
    material: 'METALLIC', accentMaterial: 'SYNTHETIC', pattern: 'geometric', reflectivity: .87,
    palette: ['#869899', '#1d303a', '#ff9761'],
  }, { speed: .81, rhythm: .86, caution: .56, preferred: 'TURN' }, { engine: 'Metallic Residue', register: 135, resonance: .85 }],
  ['cosmic', 'Umbra Sail', {
    length: 1.00, girth: .88, curvature: -.22, eye: .04, fin: 1.20, appendages: 9, emission: .89, asymmetry: .64,
    material: 'TRANSLUCENT', accentMaterial: 'SYNTHETIC', pattern: 'mottled', transparency: .65,
    palette: ['#764ac6', '#182b73', '#91fbef'],
  }, { speed: .53, rhythm: .70, curiosity: .85, preferred: 'HOVER' }, { engine: 'Soft Debris', register: 224, noise: .68 }],
  ['round', 'Little Comet', {
    length: .84, girth: 1.23, curvature: .05, eye: .94, fin: .82, emission: .29,
    material: 'ORGANIC', accentMaterial: 'TRANSLUCENT', pattern: 'mottled', reflectivity: .54,
    palette: ['#65b9cf', '#255079', '#ffcb8f'],
  }, { speed: .77, rhythm: 1.54, curiosity: .96, caution: .09, activity: .75, preferred: 'INSPECT' }, { engine: 'Hollow Pulse', register: 296 }],
  ['blade', 'Knife Current', {
    length: 1.41, girth: .66, curvature: .07, eye: .08, fin: 1.14, emission: .41,
    material: 'SYNTHETIC', accentMaterial: 'METALLIC', pattern: 'striated', reflectivity: .69,
    palette: ['#6d709d', '#1c2446', '#ff6956'],
  }, { speed: 1.25, rhythm: 1.08, turning: 1.95, activity: .84, preferred: 'DART' }, { engine: 'Metallic Residue', register: 201 }],
];

export const featured = gallery.map(([fishForm, name, morphology, behavior, sound]) => {
  const genome = generate('FORM-' + fishForm.toUpperCase(), 'Reference');
  const record = specimen(normalizeGenome({
    ...genome,
    morphology: { ...genome.morphology, ...morphology, plan: 'FISH', fishForm },
    behavior: { ...genome.behavior, ...behavior },
    sound: { ...genome.sound, ...sound },
  }), name);
  return { ...record, discoveredAt: '2026-11-19T00:00:00.000Z' };
});

export const references = [...featured, ...originals];
