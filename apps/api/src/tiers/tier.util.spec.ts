import { computeTier } from './tier.util';

describe('computeTier', () => {
  const thresholds = [
    { name: 'Bronze', min: 0 },
    { name: 'Silver', min: 500 },
    { name: 'Gold', min: 2000 },
  ];

  it('returns the lowest tier for a balance below every threshold', () => {
    expect(computeTier(-5, thresholds)).toBe('Bronze');
  });

  it('returns the matching tier at an exact threshold boundary', () => {
    expect(computeTier(500, thresholds)).toBe('Silver');
  });

  it('returns the highest matching tier for a balance between two thresholds', () => {
    expect(computeTier(1999, thresholds)).toBe('Silver');
  });

  it('returns the top tier for a balance above every threshold', () => {
    expect(computeTier(50000, thresholds)).toBe('Gold');
  });

  it('sorts unordered thresholds before computing', () => {
    const unordered = [
      { name: 'Gold', min: 2000 },
      { name: 'Bronze', min: 0 },
      { name: 'Silver', min: 500 },
    ];
    expect(computeTier(600, unordered)).toBe('Silver');
  });

  it('returns "Standard" when no thresholds are configured', () => {
    expect(computeTier(1000, [])).toBe('Standard');
  });
});
