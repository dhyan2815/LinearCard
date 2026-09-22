import type { ProgramKind } from '@linearcard/types';

/**
 * Phase 3.5 — the preset catalog (D9/D14).
 *
 * "Create Program" is always "pick a preset → rename": a preset carries the
 * program's kind, its loyalty economics (or its ticket fields), the pass
 * design, and — for loyalty — the tiers. Two of the four presets are *not*
 * loyalty programs: tickets have no points and no tiers, which is the whole
 * reason `kind` exists.
 *
 * Field keys are canonical (see POINTS_FIELD_KEYS / TIER_FIELD_KEYS in
 * wallet.service) so Google Wallet text-module updates bind correctly.
 */

export interface PresetColumn {
  key: string;
  header: string;
  body: string;
}

export interface PresetRow {
  id: string;
  columns: PresetColumn[];
}

export interface PresetTier {
  name: string;
  minPoints: number;
}

export interface ProgramPreset {
  id: string;
  name: string;
  kind: ProgramKind;
  archetype: string;
  description: string;
  hexBackgroundColor: string;
  fieldRows: PresetRow[];
  /** Loyalty only. Empty for ticket presets. */
  tiers: PresetTier[];
  /** Loyalty only. Undefined for ticket presets. */
  loyalty?: {
    earnRate: number;
    redeemRate: number;
    redeemCapPercent: number;
  };
}

export const PROGRAM_PRESETS: ProgramPreset[] = [
  {
    id: 'coffee_loyalty',
    name: 'Coffee Loyalty',
    kind: 'loyalty',
    archetype: 'loyalty',
    description: 'Points per rupee spent, three tiers, 50% redemption cap.',
    hexBackgroundColor: '#4B2E2B',
    fieldRows: [
      {
        id: 'row1',
        columns: [
          { key: 'points', header: 'Points', body: '0' },
          { key: 'tier', header: 'Tier', body: 'Bronze' },
        ],
      },
      {
        id: 'row2',
        columns: [{ key: 'memberId', header: 'Member', body: '—' }],
      },
    ],
    tiers: [
      { name: 'Bronze', minPoints: 0 },
      { name: 'Silver', minPoints: 100 },
      { name: 'Gold', minPoints: 500 },
    ],
    loyalty: { earnRate: 0.1, redeemRate: 1, redeemCapPercent: 50 },
  },
  {
    id: 'gym_membership',
    name: 'Gym Membership',
    kind: 'loyalty',
    archetype: 'membership',
    description:
      'Visit-based points, three tiers, membership expiry on the pass.',
    hexBackgroundColor: '#12303F',
    fieldRows: [
      {
        id: 'row1',
        columns: [
          { key: 'points', header: 'Visits', body: '0' },
          { key: 'tier', header: 'Tier', body: 'Starter' },
        ],
      },
      {
        id: 'row2',
        columns: [
          { key: 'memberId', header: 'Member', body: '—' },
          { key: 'membership_expires', header: 'Expires', body: '—' },
        ],
      },
    ],
    tiers: [
      { name: 'Starter', minPoints: 0 },
      { name: 'Regular', minPoints: 25 },
      { name: 'Elite', minPoints: 100 },
    ],
    // One "point" per visit: earnRate 1 with the scan sending amount=1.
    loyalty: { earnRate: 1, redeemRate: 1, redeemCapPercent: 0 },
  },
  {
    id: 'event_ticket',
    name: 'Event Tickets',
    kind: 'ticket',
    archetype: 'event_ticket',
    description:
      'Single-use ticket: seat, section and gate. The event date drives lock-screen relevance.',
    hexBackgroundColor: '#3B1E6E',
    fieldRows: [
      {
        id: 'row1',
        columns: [
          { key: 'seat', header: 'Seat', body: '—' },
          { key: 'section', header: 'Section', body: '—' },
        ],
      },
      {
        id: 'row2',
        columns: [
          { key: 'gate', header: 'Gate', body: '—' },
          { key: 'event_starts', header: 'Starts', body: '—' },
        ],
      },
    ],
    tiers: [],
  },
  {
    id: 'travel_ticket',
    name: 'Travel Tickets',
    kind: 'ticket',
    archetype: 'transit_ticket',
    description:
      'Origin, destination and departure — a transit pass, not a loyalty card.',
    hexBackgroundColor: '#0B3D2E',
    fieldRows: [
      {
        id: 'row1',
        columns: [
          { key: 'origin', header: 'From', body: '—' },
          { key: 'destination', header: 'To', body: '—' },
        ],
      },
      {
        id: 'row2',
        columns: [
          { key: 'event_starts', header: 'Departs', body: '—' },
          { key: 'seat', header: 'Seat', body: '—' },
        ],
      },
    ],
    tiers: [],
  },
];

export function findPreset(id?: string): ProgramPreset | undefined {
  return PROGRAM_PRESETS.find((p) => p.id === id);
}

/**
 * Slug used in enrollment URLs and Google Wallet class ids. Mirrors the
 * `linearcard_slugify` SQL function used by the Phase 3 backfill so a slug
 * generated here and one generated there are the same string.
 */
export function slugify(text: string): string {
  const slug = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'program';
}
