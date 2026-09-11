import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';
import fs from 'fs';

// Load .env file from the root
dotenv.config();

async function checkClassLocation() {
  const resourceId = process.argv[2];

  if (!resourceId) {
    console.error("❌ Error: Please provide your Class ID as an argument.");
    console.error("Usage: node check-location.mjs YOUR_ISSUER_ID.beanhouse_coffee");
    process.exit(1);
  }

  console.log(`🔍 Checking Google Wallet API for Class: ${resourceId}...\n`);

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !rawKey) {
    console.error('❌ Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY in .env file.');
    process.exit(1);
  }

  // Format the private key just like the backend does
  let privateKey = rawKey.replace(/\\n/g, '\n').replace(/"/g, '').trim();
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----\n`;
  }

  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });

    const client = await auth.getClient();
    const url = `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${resourceId}`;

    const response = await client.request({
      url,
      method: 'GET',
    });

    const classData = response.data;
    console.log("✅ Class fetched successfully from Google servers!\n");

    if (classData.locations && classData.locations.length > 0) {
      console.log("📍 LOCATIONS METADATA FOUND:");
      console.log(JSON.stringify(classData.locations, null, 2));
      console.log("\nSuccess! The geofence is properly configured on Google's end.");
    } else {
      console.log("❌ NO LOCATIONS FOUND.");
      console.log("The 'locations' array is either missing or empty on this Class.");
      console.log("Full Class Data:", JSON.stringify(classData, null, 2));
    }
  } catch (error) {
    console.error("\n❌ Error fetching class from Google API:");
    console.error(error.response?.data?.error?.message || error.message);
  }
}

checkClassLocation();
