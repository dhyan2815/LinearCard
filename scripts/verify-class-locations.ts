import { google } from 'googleapis';

async function verifyClassLocations(classIdSuffix: string) {
  let rawKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim() || '';
  if (
    rawKey &&
    !rawKey.includes('BEGIN PRIVATE KEY') &&
    !rawKey.includes('BEGIN RSA PRIVATE KEY')
  ) {
    rawKey = `-----BEGIN PRIVATE KEY-----\n${rawKey}\n-----END PRIVATE KEY-----\n`;
  }

  // 1. Authenticate using your service account credentials[cite: 5]
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: rawKey,
    },
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });

  const walletobjects = google.walletobjects({ version: 'v1', auth });
  
  // Canonical source: WalletService.getWalletEnvPrefix / resolveClassId
  // Duplicated here to avoid importing the Nest DI container.
  const explicit = process.env.WALLET_ENV_PREFIX?.trim();
  const walletEnvPrefix = explicit
    ? (explicit === 'none' ? '' : explicit)
    : (process.env.VERCEL_ENV === 'production' ? '' :
       process.env.VERCEL_ENV === 'preview' ? 'preview' : 'dev');
  const resolvedSuffix = walletEnvPrefix
    ? `${walletEnvPrefix}_${classIdSuffix}`
    : classIdSuffix;
  const fullClassId = `${process.env.ISSUER_ID}.${resolvedSuffix}`;
  console.log(`Resolved class id: ${fullClassId}`);

  try {
    // 3. Fetch the live class payload directly from Google's servers
    const response = await walletobjects.genericclass.get({
      resourceId: fullClassId,
    });

    const payload = response.data;
    
    // 4. Log the full payload
    console.log(`Class ID: ${payload.id}`);
    console.log(`Locations Captured: ${payload.merchantLocations?.length || 0}`);
    console.log('\n--- Full Payload ---');
    console.log(JSON.stringify(payload, null, 2));

    return payload;
  } catch (error) {
    console.error('Failed to fetch payload from Google Wallet:', error);
  }
}

if (require.main === module) {
  const classIdSuffix = process.argv[2];
  if (!classIdSuffix) {
    console.error('Please provide a bare class suffix (no dev_ prefix) as an argument (e.g. ts-node script.ts bistro_cafe_coffee_loyalty_silver)');
    process.exit(1);
  }
  
  // Load env vars from the nearest .env file
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
  require('dotenv').config({ path: require('path').resolve(__dirname, '../apps/api/.env') });

  verifyClassLocations(classIdSuffix);
}
