export const DEFAULT_PASS_HEX = '#1A365D';

export interface User {
  id: string;
  email: string;
}

export interface SendOtpRequest {
  phone: string;
  tenantId?: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
  consentGiven: boolean;
  tenantId?: string;
  memberName?: string;
  tier?: string;
  balance?: string;
}

export interface GeneratePassRequest {
  phone: string;
  memberName?: string;
  tier?: string;
  balance?: string;
  tenantId?: string;
}

export interface Tenant {
  id: string;
  name: string;
  classSuffix: string;
  brandHexColor: string;
  logoUrl?: string;
  heroUrl?: string;
  apiKey?: string;
  webhookUrl?: string;
}

export interface Pass {
  id: string;
  fullPassId: string;
  tier: string;
  balance: string | number;
}

export interface Member {
  id: string;
  phone: string;
  name?: string;
  tenantId: string;
  createdAt?: string;
  passes?: Pass[];
  /** Demo-mode issuance gate: only test accounts get passes while the tenant is in demo. */
  isTestAccount?: boolean;
  /** Set when the member replies STOP. Every campaign send filters on it. */
  marketingOptOutAt?: string | null;
}

// Legacy JSONB shape stored on PassTemplate.tierThresholds. Kept as a
// distinct DTO (not replaced by `Tier`) because it describes a threshold
// with no DB row identity — no id/programId/templateId/sortOrder — used
// only for the template-designer's tier editor payload. `Tier` below is
// the real DB row shape `computeTier` operates on post Phase-3.
export interface TierThreshold {
  name: string;
  min: number;
}

export interface Program {
  id: string;
  tenantId: string;
  name: string;
  createdAt?: string;
}

export interface Tier {
  id: string;
  programId: string;
  name: string;
  minPoints: number;
  templateId: string;
  sortOrder: number;
  createdAt?: string;
}

/**
 * Phase 2.2 — campaign audience segmentation. Every field is optional and
 * every set field narrows; an empty filter means "all members" (minus
 * marketing opt-outs, which are never a choice).
 */
export interface AudienceFilter {
  /** Program scope (D8). Inert until Phase 3 puts `programId` on `Pass`. */
  programId?: string;
  /** Exact tier names, e.g. ['Gold', 'Platinum']. */
  tiers?: string[];
  balanceMin?: number;
  balanceMax?: number;
  /** No AuditLog activity in this many days. */
  inactiveForDays?: number;
  /** Restrict to members flagged `isTestAccount` (demo-mode dry runs). */
  testAccountsOnly?: boolean;
}

export interface Campaign {
  id: string;
  tenantId: string;
  programId?: string | null;
  name: string;
  channel: 'whatsapp' | 'wallet_push';
  /** Required for wallet_push — Google Wallet's addMessage needs a header. */
  header?: string | null;
  body: string;
  audienceFilter: AudienceFilter;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  sentAt?: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt?: string;
}

export interface CampaignRecipientPreview {
  id: string;
  name?: string;
  phone: string;
  tier?: string;
  balance?: string | number;
}

export interface CampaignPreviewResponse {
  success: boolean;
  recipientCount: number;
  /** First 5 recipients, so a send is never fired blind. */
  sample: CampaignRecipientPreview[];
  renderedHeader?: string;
  renderedBody: string;
  /** Members excluded purely because they opted out of marketing. */
  optedOutCount: number;
}

export interface PassTemplate {
  id: string;
  tenantId: string;
  title: string;
  name?: string;
  subtitle?: string;
  archetype: string;
  status: 'draft' | 'published' | 'unsaved';
  classSuffix: string;
  googleClassId?: string;
  /** Live Google Wallet class id per environment prefix, e.g. { prod, preview, dev }. */
  googleClassIds?: Record<string, string>;
  fieldRows?: Array<{ id: string; columns: Array<{ key: string; header: string; body: string }> }>;
  tierThresholds?: TierThreshold[];
  hexBackgroundColor?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  /** Loyalty economics (Phase 1.3). Move onto `Program` in Phase 3. */
  earnRate?: number;
  redeemRate?: number;
  redeemCapPercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

