import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { logNotification } from '@/lib/notify';
import { updateGenericObject } from '@/lib/google-wallet';

const VALID_CHANNELS = ['whatsapp', 'wallet_push'] as const;
type Channel = typeof VALID_CHANNELS[number];

async function wahaPost(endpoint: string, body: object) {
  const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
  const WAHA_SESSION  = process.env.WAHA_SESSION ?? 'default';
  const WAHA_API_KEY  = process.env.WAHA_API_KEY;
  if (!WAHA_BASE_URL) return;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (WAHA_API_KEY) headers['X-Api-Key'] = WAHA_API_KEY;
  const res = await fetch(`${WAHA_BASE_URL.replace(/\/$/, '')}${endpoint}`, {
    method: 'POST', headers, body: JSON.stringify({ session: WAHA_SESSION, ...body }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`WAHA error ${res.status}: ${t}`); }
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId, channel, message } = await request.json();
    if (!tenantId || !channel || !message) {
      return NextResponse.json({ success: false, error: 'tenantId, channel, and message are required' }, { status: 400 });
    }
    if (!VALID_CHANNELS.includes(channel as Channel)) {
      return NextResponse.json({ success: false, error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` }, { status: 400 });
    }

    const { data: members, error: memberError } = await supabase
      .from('Member')
      .select('id, phone, name, passes:Pass(id, fullPassId)')
      .eq('tenantId', tenantId);

    if (memberError) throw memberError;
    if (!members?.length) {
      return NextResponse.json({ success: true, sent: 0, failed: 0, message: 'No members' });
    }

    let sent = 0;
    let failed = 0;

    for (const member of members) {
      try {
        if (channel === 'whatsapp') {
          await wahaPost('/api/sendText', { chatId: `${member.phone.replace(/^\+/, '')}@c.us`, text: message });
          await logNotification({ supabase, tenantId, memberId: member.id, type: 'campaign', channel: 'whatsapp', status: 'sent' });
          sent++;
        } else {
          const passes: any[] = (member as any).passes || [];
          if (!passes.length) {
            await logNotification({ supabase, tenantId, memberId: member.id, type: 'campaign', channel: 'wallet_push', status: 'failed', errorReason: 'No pass' });
            failed++;
            continue;
          }
          for (const pass of passes) {
            await updateGenericObject(pass.fullPassId, { pushNotification: message });
            await logNotification({ supabase, tenantId, memberId: member.id, type: 'campaign', channel: 'wallet_push', status: 'sent' });
          }
          sent++;
        }
      } catch (err: any) {
        await logNotification({ supabase, tenantId, memberId: member.id, type: 'campaign', channel: channel as Channel, status: 'failed', errorReason: err.message });
        failed++;
      }
    }

    return NextResponse.json({ success: true, sent, failed });
  } catch (error: any) {
    console.error('API Error sending notifications:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
