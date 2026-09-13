export type PracticeHighlightColor = 'yellow' | 'blue' | 'pink';
export type PracticeHighlightRegion = 'passage' | 'stem';
export type PracticeRegionHighlights = Record<number, PracticeHighlightColor>;
export type PracticeHighlights = Partial<
  Record<PracticeHighlightRegion, PracticeRegionHighlights>
>;

export type PracticeHighlightTarget = {
  region: PracticeHighlightRegion;
  index: number;
};

export function updatePracticeHighlights(
  highlights: PracticeHighlights,
  targets: PracticeHighlightTarget[],
  color: PracticeHighlightColor | null
): PracticeHighlights {
  const next: PracticeHighlights = { ...highlights };
  const changedRegions = new Set<PracticeHighlightRegion>();

  for (const { region, index } of targets) {
    if (!changedRegions.has(region)) {
      next[region] = { ...(highlights[region] ?? {}) };
      changedRegions.add(region);
    }

    if (color) next[region]![index] = color;
    else delete next[region]![index];
  }

  for (const region of changedRegions) {
    if (Object.keys(next[region] ?? {}).length === 0) delete next[region];
  }

  return next;
}

export function countPracticeHighlights(highlights: PracticeHighlights): number {
  return Object.values(highlights).reduce(
    (total, regionHighlights) => total + Object.keys(regionHighlights ?? {}).length,
    0
  );
}
