import type { ObjectKind } from '../world/document';
import type { LandSettings } from '../terrain';
import type { Composition } from './styles';

export const morphologyNames = ['Style default', 'Expanse', 'Folded Land', 'Thicket', 'Basin'] as const;
export type WorldMorphology = typeof morphologyNames[number];

type Study = {
  land: Partial<Omit<Required<LandSettings>, 'seed'>>;
  structures: { pattern: Composition; count: number; scale: number; kinds?: readonly ObjectKind[] };
};

export const morphologyStudies: Record<Exclude<WorldMorphology, 'Style default'>, Study> = {
  Expanse: {
    land: { kind: 'Rolling Field', elevation: .17, roughness: .12, openness: .94 },
    structures: { pattern: 'Sparse', count: 3, scale: .68 },
  },
  'Folded Land': {
    land: { kind: 'Terraces', elevation: .67, roughness: .32, openness: .41 },
    structures: { pattern: 'Axis', count: 7, scale: 1.05 },
  },
  Thicket: {
    land: { kind: 'Rolling Field', elevation: .35, roughness: .34, openness: .56 },
    structures: { pattern: 'Cluster', count: 13, scale: .94, kinds: ['canopy', 'flora', 'hollow', 'aggregate'] },
  },
  Basin: {
    land: { kind: 'Hollow Land', elevation: .49, roughness: .22, openness: .69 },
    structures: { pattern: 'Perimeter', count: 6, scale: 1.08 },
  },
};

export function morphologyStudy(name?: WorldMorphology) {
  return name && name !== 'Style default' ? morphologyStudies[name] : undefined;
}
