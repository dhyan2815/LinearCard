import { NestFactory } from '@nestjs/core';
import { AppModule } from './apps/api/src/app.module';
import { TemplatesService } from './apps/api/src/templates/templates.service';
import { SupabaseService } from './apps/api/src/supabase/supabase.service';

// Force the production URL as the callback URL to execute the repair pass.
process.env.PUBLIC_CALLBACK_URL = 'https://linearcard.vercel.app';

async function repair() {
  console.log('Starting Repair Pass for Google Wallet Classes (Phase 0.2)...');
  console.log(`Setting Callback URL to: ${process.env.PUBLIC_CALLBACK_URL}`);

  const app = await NestFactory.createApplicationContext(AppModule);
  const supabase = app.get(SupabaseService);
  const templatesService = app.get(TemplatesService);

  // Fetch all published templates across all tenants
  const { data: templates, error } = await supabase.client
    .from('PassTemplate')
    .select('*')
    .eq('status', 'published');

  if (error) {
    console.error('Error fetching templates:', error);
    process.exit(1);
  }

  if (!templates || templates.length === 0) {
    console.log('No published templates found.');
    process.exit(0);
  }

  console.log(`Found ${templates.length} published templates to repair.`);

  for (const template of templates) {
    console.log(`\nRepublishing Template ID: ${template.id} (Tenant: ${template.tenantId})`);
    try {
      const result = await templatesService.publish(template.id, template.tenantId);
      console.log(`  Success! Class Data returned for ${template.id}`);
      if (result.warning) {
        console.warn(`  Warning: ${result.warning}`);
      }
    } catch (err: any) {
      console.error(`  Failed to publish template ${template.id}:`, err.message);
    }
  }

  console.log('\nRepair Pass Complete.');
  await app.close();
}

repair();
