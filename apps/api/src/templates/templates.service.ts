import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';

/**
 * Publishing a template is the one piece of template logic with a second
 * caller: `POST /programs/:id/publish` publishes every template a program
 * owns (Phase 3.4), and it must do exactly what the designer's Publish
 * button does — same class id bookkeeping, same 409/PATCH fallback check.
 * So it lives here rather than being reimplemented next door.
 */
@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly walletService: WalletService,
  ) {}

  /** Localhost/relative image URLs are unusable by Google Wallet. */
  static resolveImageUrl(url?: string): string | undefined {
    if (!url) return undefined;
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return 'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg';
    }
    if (url.startsWith('/')) {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL.replace('-api', '')}`
          : 'http://localhost:3000');
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        return 'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg';
      }
      return `${baseUrl}${url}`;
    }
    return url;
  }

  async publish(id: string, tenantId: string) {
    const { data: template, error: fetchError } =
      await this.supabaseService.client
        .from('PassTemplate')
        .select('*, tenant:Tenant(*)')
        .eq('id', id)
        .eq('tenantId', tenantId)
        .single();
    if (fetchError || !template)
      throw new HttpException(
        { success: false, error: 'Template not found' },
        HttpStatus.NOT_FOUND,
      );

    const logoUrl = TemplatesService.resolveImageUrl(
      template.logoUrl || template.tenant?.logoUrl,
    );
    const heroImageUrl = TemplatesService.resolveImageUrl(
      template.heroImageUrl || template.tenant?.heroUrl,
    );

    const rowsWithKeys = (template.fieldRows || []).map((row: any) => ({
      ...row,
      columns: row.columns.map((col: any, idx: number) => ({
        ...col,
        key: col.key || `${row.id}_${idx}`,
      })),
    }));

    const tenantWallet = await this.walletService.forTenant(tenantId);
    const envKey = tenantWallet.getWalletEnvPrefix() || 'prod';
    const classData: any = await tenantWallet.createGenericClass({
      classSuffix: template.classSuffix || template.tenant?.classSuffix,
      cardTitle: template.tenant?.name || template.title,
      hexBackgroundColor:
        template.hexBackgroundColor || template.tenant?.brandHexColor,
      rows: rowsWithKeys,
      logoUrl,
      heroImageUrl,
      storeLocations: template.storeLocations ?? [],
      // Each environment tracks whether *its own* class exists (ENV-1):
      // `googleClassId` alone held whichever environment published last.
      isUpdate: !!(template.googleClassIds || {})[envKey],
    });

    // The 409 fallback returns {existing:true, updated:false} when its own
    // PATCH attempt also failed — without this check that silent failure
    // used to still flip status to 'published'.
    if (classData?.updated === false) {
      throw new HttpException(
        {
          success: false,
          error:
            'Failed to publish: Google Wallet class update was rejected. Template left as draft.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Phase 4.1 — Google silently accepts a PATCH and still returns a class
    // with no `merchantLocations`. Publishing then "succeeds" with zero live
    // geofences, which is exactly the failure Part 3 chased for weeks. Surface
    // it instead of leaving the admin to guess.
    const sentLocations = (template.storeLocations ?? []).length;
    const liveLocations = (classData?.merchantLocations ?? []).length;
    let warning: string | undefined;
    if (sentLocations > 0 && liveLocations === 0) {
      warning =
        `Published, but Google returned no merchantLocations for ${sentLocations} store location(s). ` +
        'Proximity notifications will not fire. Check the live class via GET /templates/:id/wallet-class.';
      this.logger.warn(`${warning} (template ${id})`);
    }

    const { data: updated, error: updateError } =
      await this.supabaseService.client
        .from('PassTemplate')
        .update({
          status: 'published',
          googleClassId: classData.id,
          googleClassIds: {
            ...(template.googleClassIds || {}),
            [envKey]: classData.id,
          },
          updatedAt: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenantId', tenantId)
        .select()
        .single();
    if (updateError) throw updateError;

    return { classData, template: updated, warning };
  }
}
