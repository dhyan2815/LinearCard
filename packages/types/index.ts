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
  createdAt?: string;
  updatedAt?: string;
}

