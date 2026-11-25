export const sizes = ['Small', 'Medium', 'Large'] as const;
export type SpecimenSize = typeof sizes[number];

export const specimenProfiles = {
  Small: { scale: .72, tempo: 1.17, speed: .88, interval: .87 },
  Medium: { scale: 1, tempo: 1, speed: 1, interval: 1 },
  Large: { scale: 1.38, tempo: .79, speed: .94, interval: 1.23 },
} as const;

export function specimenProfile(size: SpecimenSize | undefined) {
  return specimenProfiles[size ?? 'Medium'];
}
