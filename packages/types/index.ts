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
  fieldRows?: Array<{ id: string; columns: Array<{ header: string; body: string }> }>;
  hexBackgroundColor?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

