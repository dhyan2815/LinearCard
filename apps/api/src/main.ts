import './env';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) or matching localhost/frontend
      if (
        !origin ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Dev-friendly fallback
      }
    },
    credentials: true,
  });
  // No host arg: Node binds the IPv6 wildcard '::' dual-stack, so both
  // 'localhost' (which Windows can resolve to ::1) and '127.0.0.1' connect.
  // Binding '0.0.0.0' only accepted IPv4, forcing the frontend workaround
  // that rewrote 'localhost' to '127.0.0.1' before every fetch call.
  await app.listen(process.env.PORT || 3001);
  printEnvironmentBanner();
}

/**
 * Phase 0.2/0.2b: local, preview and production share one Supabase project
 * (D13) and one Google Wallet issuer (D15). Print, at boot, exactly which
 * data and which wallet classes this process is about to mutate.
 */
function printEnvironmentBanner() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '(unset)';
  const projectRef =
    supabaseUrl.match(/https?:\/\/([^.]+)\./)?.[1] || supabaseUrl;
  const envPrefix =
    process.env.WALLET_ENV_PREFIX?.trim() ||
    (process.env.VERCEL_ENV === 'production'
      ? '(none — production)'
      : process.env.VERCEL_ENV === 'preview'
        ? 'preview'
        : 'dev');
  const callbackBase = (
    process.env.PUBLIC_CALLBACK_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '(unset)')
  ).replace(/\/$/, '');
  const localCallback = /localhost|127\.0\.0\.1/.test(callbackBase);

  console.log(
    [
      '',
      '──────────── LinearCard API ────────────',
      `  Supabase project : ${projectRef}`,
      `  Wallet issuer    : ${process.env.ISSUER_ID || '(per-tenant only)'}`,
      `  Wallet env prefix: ${envPrefix}`,
      `  Callback base    : ${callbackBase}${localCallback ? '  ← publishing a class is BLOCKED (set PUBLIC_CALLBACK_URL)' : ''}`,
      '  Writes go to the shared project above — this is production data.',
      '────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}
bootstrap();
