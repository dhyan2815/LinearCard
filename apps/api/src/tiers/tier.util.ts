export interface TierThreshold {
  name: string;
  min: number;
}

export function computeTier(
  balance: number,
  thresholds: TierThreshold[],
): string {
  if (!thresholds || thresholds.length === 0) {
    return 'Standard';
  }

  const sorted = [...thresholds].sort((a, b) => a.min - b.min);

  let matched = sorted[0].name;
  for (const threshold of sorted) {
    if (balance >= threshold.min) {
      matched = threshold.name;
    }
  }
  return matched;
}
