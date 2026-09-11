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
  
  const payload = {
    id: id,
    issuerName: 'BeanHouse Coffee',
    locations: [
      {
        kind: 'walletobjects#latLongPoint',
        latitude: 23.109056,
        longitude: 72.603672
      }
    ]
  };
  
  console.log('Sending PATCH request to Google Wallet...');
  try {
    const res = await client.request({
      url: 'https://walletobjects.googleapis.com/walletobjects/v1/genericClass/' + id,
      method: 'PATCH',
      data: payload
    });
    console.log('PATCH response: SUCCESS!');
    console.log(JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.error('PATCH error:', e.response?.data || e.message);
  }
}
run();
