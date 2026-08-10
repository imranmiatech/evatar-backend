export type AgeRange = {
  minAgeMonths: number;
  maxAgeMonths: number;
};

export function resolveAgeGroupRange(ageGroup?: string): AgeRange | undefined {
  if (!ageGroup?.trim()) {
    return undefined;
  }

  const normalized = ageGroup
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-');

  const presets: Record<string, AgeRange> = {
    '6 months': { minAgeMonths: 6, maxAgeMonths: 6 },
    '6-9 months': { minAgeMonths: 6, maxAgeMonths: 9 },
    '9-12 months': { minAgeMonths: 9, maxAgeMonths: 12 },
    '12-24 months': { minAgeMonths: 12, maxAgeMonths: 24 },
    '2+ years': { minAgeMonths: 24, maxAgeMonths: 216 },
  };

  if (presets[normalized]) {
    return presets[normalized];
  }

  const yearRange = normalized.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*years?$/);
  if (yearRange) {
    return {
      minAgeMonths: Math.round(Number(yearRange[1]) * 12),
      maxAgeMonths: Math.round(Number(yearRange[2]) * 12),
    };
  }

  const monthRange = normalized.match(/^(\d+)\s*-\s*(\d+)\s*months?$/);
  if (monthRange) {
    return {
      minAgeMonths: Number(monthRange[1]),
      maxAgeMonths: Number(monthRange[2]),
    };
  }

  const singleMonth = normalized.match(/^(\d+)\s*months?$/);
  if (singleMonth) {
    const months = Number(singleMonth[1]);
    return { minAgeMonths: months, maxAgeMonths: months };
  }

  const yearPlus = normalized.match(/^(\d+(?:\.\d+)?)\+\s*years?$/);
  if (yearPlus) {
    return {
      minAgeMonths: Math.round(Number(yearPlus[1]) * 12),
      maxAgeMonths: 216,
    };
  }

  return undefined;
}
