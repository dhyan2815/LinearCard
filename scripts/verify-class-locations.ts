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
  
  // 2. Construct the full ID using your issuer ID[cite: 5]
  const fullClassId = `${process.env.ISSUER_ID}.${classIdSuffix}`;

  try {
    // 3. Fetch the live class payload directly from Google's servers
    const response = await walletobjects.genericclass.get({
      resourceId: fullClassId,
    });

    const payload = response.data;
    
    // 4. Log the merchantLocations to verify latitude and longitude arrays
    console.log(`Class ID: ${payload.id}`);
    console.log(`Locations Captured: ${payload.merchantLocations?.length || 0}`);``
    console.log(JSON.stringify(payload.merchantLocations, null, 2));

    return payload.merchantLocations;
  } catch (error) {
    console.error('Failed to fetch payload from Google Wallet:', error);
  }
}

if (require.main === module) {
  const classIdSuffix = process.argv[2];
  if (!classIdSuffix) {
    console.error('Please provide a class suffix as an argument (e.g. ts-node script.ts my_suffix)');
    process.exit(1);
  }
  
  // Load env vars from the nearest .env file
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
  require('dotenv').config({ path: require('path').resolve(__dirname, '../apps/api/.env') });

  verifyClassLocations(classIdSuffix);
}
