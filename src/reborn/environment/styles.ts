import { defaultLand } from '../terrain';
import type { LandSettings } from '../terrain';
import type { Finish, ObjectKind } from '../world/document';
import { defaultAtmosphere, defaultLighting, defaultSurface } from './settings';
import type { Atmosphere, Lighting, Surface, WorldStyle } from './settings';

export type Composition = 'Sparse' | 'Cluster' | 'Axis' | 'Perimeter' | 'Asymmetric' | 'Monumental' | 'Distributed';

type Style = {
  land: Omit<Required<LandSettings>, 'seed'>;
  surface: Surface;
  atmosphere: Atmosphere;
  lighting: Lighting;
  structures: { pattern: Composition; count: number; scale: number; kinds: readonly ObjectKind[]; finishes: readonly Finish[] };
  residentSpread: number;
};

export const styles: Record<WorldStyle, Style> = {
  Elsewhere: {
    land: defaultLand, surface: defaultSurface, atmosphere: defaultAtmosphere, lighting: defaultLighting,
    structures: { pattern: 'Distributed', count: 8, scale: 1, kinds: ['arch','monolith','ring','stones','flora','kinetic'], finishes: ['Original'] },
    residentSpread: 1,
  },
  'Pale Colony': {
    land: { kind: 'Rolling Field', elevation: .28, roughness: .15, openness: .83, density: .30 },
    surface: { low: '#a6a599', high: '#e3d8c0', accent: '#c8beae', roughness: .92, metalness: 0 },
    atmosphere: { sky: '#dbdcd4', fog: '#e3dfd2', distance: 43, depth: 86 },
    lighting: { key: '#fff2df', ambient: '#efeeec', bounce: '#d0ba9a', intensity: 2.1, fill: 1.65, bearing: 38, elevation: 38 },
    structures: { pattern: 'Sparse', count: 6, scale: 1.12, kinds: ['monolith','arch','stones','ring'], finishes: ['Chalk','Chalk','Original'] },
    residentSpread: 1.2,
  },
  'Oxide Field': {
    land: { kind: 'Terraces', elevation: .52, roughness: .40, openness: .54, density: .70 },
    surface: { low: '#765347', high: '#bf9473', accent: '#9b604a', roughness: .85, metalness: .10 },
    atmosphere: { sky: '#c3a994', fog: '#bd9a83', distance: 34, depth: 86 },
    lighting: { key: '#ffd5a4', ambient: '#e5d4c7', bounce: '#ae795e', intensity: 2.78, fill: 1.15, bearing: -65, elevation: 25 },
    structures: { pattern: 'Axis', count: 10, scale: 1.09, kinds: ['arch','monolith','kinetic','stones','ring'], finishes: ['Oxide','Mineral','Oxide','Original'] },
    residentSpread: .80,
  },
  'Shallow Memory': {
    land: { kind: 'Hollow Land', elevation: .26, roughness: .16, openness: .74, density: .48 },
    surface: { low: '#69928c', high: '#c8c7a5', accent: '#719f9d', roughness: .55, metalness: .08 },
    atmosphere: { sky: '#a9c8c3', fog: '#a9c6c1', distance: 28, depth: 96 },
    lighting: { key: '#e7f4e6', ambient: '#dcebea', bounce: '#94b8ad', intensity: 2.1, fill: 1.65, bearing: -32, elevation: 46 },
    structures: { pattern: 'Perimeter', count: 9, scale: 1.02, kinds: ['ring','stones','kinetic','arch'], finishes: ['Jade','Chalk','Original'] },
    residentSpread: .68,
  },
  'Uncertain Garden': {
    land: { kind: 'Rolling Field', elevation: .43, roughness: .31, openness: .47, density: .84 },
    surface: { low: '#68765d', high: '#b3ad7c', accent: '#8d816e', roughness: .83, metalness: .03 },
    atmosphere: { sky: '#bcc8ab', fog: '#c1c4a1', distance: 36, depth: 100 },
    lighting: { key: '#f5e8be', ambient: '#e4ecd7', bounce: '#99a075', intensity: 2.38, fill: 1.46, bearing: -15, elevation: 29 },
    structures: { pattern: 'Cluster', count: 13, scale: .87, kinds: ['flora','kinetic','flora','stones','flora','ring'], finishes: ['Original','Jade','Original'] },
    residentSpread: 1.02,
  },
  'Black Mineral': {
    land: { kind: 'Terraces', elevation: .41, roughness: .44, openness: .64, density: .59 },
    surface: { low: '#343a42', high: '#686773', accent: '#544951', roughness: .69, metalness: .19 },
    atmosphere: { sky: '#88858e', fog: '#767780', distance: 35, depth: 75 },
    lighting: { key: '#ffdbbd', ambient: '#cfddec', bounce: '#8c8da1', intensity: 3.0, fill: 1.65, bearing: 66, elevation: 30 },
    structures: { pattern: 'Asymmetric', count: 9, scale: 1.34, kinds: ['monolith','stones','arch','ring'], finishes: ['Mineral','Original','Mineral','Chalk'] },
    residentSpread: .88,
  },
  'Incorrect Paradise': {
    land: { kind: 'Rolling Field', elevation: .38, roughness: .24, openness: .63, density: .78 },
    surface: { low: '#939f83', high: '#e0c9b9', accent: '#c7aab1', roughness: .72, metalness: .03 },
    atmosphere: { sky: '#baccdc', fog: '#d6c3cd', distance: 47, depth: 88 },
    lighting: { key: '#fff0d7', ambient: '#ece2ef', bounce: '#a7bb9e', intensity: 2.34, fill: 1.62, bearing: 20, elevation: 43 },
    structures: { pattern: 'Distributed', count: 11, scale: 1.06, kinds: ['ring','flora','arch','kinetic','stones'], finishes: ['Original','Original','Chalk'] },
    residentSpread: 1.18,
  },
  'Abandoned Geometry': {
    land: { kind: 'Rolling Field', elevation: .32, roughness: .20, openness: .89, density: .34 },
    surface: { low: '#7e8783', high: '#b8b6a5', accent: '#8e8c85', roughness: .86, metalness: .06 },
    atmosphere: { sky: '#bac4c6', fog: '#a6babc', distance: 60, depth: 102 },
    lighting: { key: '#ffe9d2', ambient: '#e4edf2', bounce: '#a9a6a0', intensity: 2.68, fill: 1.24, bearing: -72, elevation: 22 },
    structures: { pattern: 'Monumental', count: 7, scale: 2.16, kinds: ['monolith','arch','ring','stones'], finishes: ['Chalk','Mineral','Original'] },
    residentSpread: .74,
  },
};
