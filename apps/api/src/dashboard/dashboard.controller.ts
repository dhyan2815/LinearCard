import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('stats')
  async getstats() {
    try {
      const [{ count: memberCount }, { count: passCount }, { data: passTiers }] = await Promise.all([
        this.supabaseService.client.from('Member').select('*', { count: 'exact', head: true }),
        this.supabaseService.client.from('Pass').select('*', { count: 'exact', head: true }),
        this.supabaseService.client.from('Pass').select('tier'),
      ]);

      const tierDistribution: Record<string, number> = {};
      (passTiers || []).forEach((p: any) => {
        const t = p.tier || 'Unknown';
        tierDistribution[t] = (tierDistribution[t] || 0) + 1;
      });

      const googleConnected = !!(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.ISSUER_ID);

      return {
        success: true,
        memberCount: memberCount || 0,
        passCount:   passCount   || 0,
        tierDistribution,
        walletStatus: {
          google:  googleConnected ? 'connected' : 'not_configured',
          apple:   'not_configured',
          samsung: 'pending_approval',
        },
      };
    } catch (error: any) {
      return { success: false, error: 'Failed to fetch stats' };
    }
  }
}
