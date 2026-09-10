import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/\"/g, '').trim();
  if (!rawKey.includes('-----BEGIN PRIVATE KEY-----')) {
    rawKey = '-----BEGIN PRIVATE KEY-----\n' + rawKey + '\n-----END PRIVATE KEY-----\n';
  }
  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: rawKey },
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
  });
  const client = await auth.getClient();
  const id = process.env.ISSUER_ID + '.beanhouse_coffee';
  
  console.log('Testing genericClass...');
  try {
    const res1 = await client.request({ url: 'https://walletobjects.googleapis.com/walletobjects/v1/genericClass/' + id, method: 'GET' });
    console.log(JSON.stringify(res1.data, null, 2));
  } catch(e) { console.error('genericClass error', e.message); }
  
  console.log('\nTesting loyaltyClass...');
  try {
    const res2 = await client.request({ url: 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/' + id, method: 'GET' });
    console.log(JSON.stringify(res2.data, null, 2));
  } catch(e) { console.error('loyaltyClass error', e.message); }
}
run();
