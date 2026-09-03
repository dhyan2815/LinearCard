/// <reference types="node" />
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { GoogleAuth } from 'google-auth-library';

/**
 * Formats private key handling newline escapes and PEM headers
 */
export function formatPrivateKey(rawKey: string): string {
  if (!rawKey) {
    throw new Error('GOOGLE_PRIVATE_KEY is missing in environment variables');
  }
  let key = rawKey.replace(/\\n/g, '\n').trim();
  // Ensure the private key string contains the necessary PEM headers for JWT signing
  if (!key.includes('BEGIN PRIVATE KEY') && !key.includes('BEGIN RSA PRIVATE KEY')) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----\n`;
  }
  return key;
}

export interface GoogleWalletPassOptions {
  passId: string;
  memberName?: string;
  cardTitle?: string;
  balance?: string;
  tier?: string;
  hexBackgroundColor?: string;
  barcodeValue?: string;
  barcodeAltText?: string;
  classSuffix?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  rows?: any[];
}

/**
 * Generates a signed Google Wallet Save URL for Generic Passes
 */
export async function createGoogleWalletPass(options: GoogleWalletPassOptions) {
  const {
    passId,
    memberName = 'Dhyan Patel',
    cardTitle = 'LinearCard Platinum',
    balance = '1250 Pts',
    tier = 'Platinum',
    hexBackgroundColor = '#1A365D',
    classSuffix = 'linearcard_sandbox_class',
    logoUrl = '',
    heroImageUrl = '',
    rows = []
  } = options;

  const barcodeValue = options.barcodeValue || `https://linearcard.vercel.app/m/${passId}`;
  const barcodeAltText = options.barcodeAltText || passId;

  const issuerId = process.env.ISSUER_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  // Validate that all required Google Wallet credentials are provided in the environment
  if (!issuerId || !clientEmail || !rawKey) {
    throw new Error(
      'Missing Google Wallet credentials. Please ensure ISSUER_ID, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY are set in .env'
    );
  }

  if (!passId) {
    throw new Error('passId is required to generate a Google Wallet pass.');
  }

  const privateKey = formatPrivateKey(rawKey);
  const objectSuffix = passId;
  const fullPassId = `${issuerId}.${objectSuffix}`;
  const classId = `${issuerId}.${classSuffix}`;

  const passData = {
    memberName,
    cardTitle,
    balance,
    tier,
    hexBackgroundColor,
    barcodeValue,
    barcodeAltText,
    passId: objectSuffix,
    fullPassId: fullPassId,
    createdAt: new Date().toISOString()
  };

  const textModulesData: any[] = [];
  // If custom rows are provided, map them into the generic object textModulesData format
  if (rows && rows.length > 0) {
    rows.forEach((row: any) => {
      row.columns.forEach((col: any, idx: number) => {
        let displayBody = col.body;
        // Override body content if the column header represents a dynamic field (tier or balance)
        if (col.header.toLowerCase().includes('tier')) displayBody = tier;
        if (col.header.toLowerCase().includes('balance') || col.header.toLowerCase().includes('points')) displayBody = balance;

        textModulesData.push({
          id: `${row.id}_${idx}`,
          header: col.header,
          body: displayBody
        });
      });
    });
  } else {
    // Provide default fallback fields if no custom rows are defined
    textModulesData.push(
      { id: 'balance', header: 'Points / Status', body: balance },
      { id: 'tier_info', header: 'Tier Level', body: tier || 'Standard' }
    );
  }

  const genericObjectPayload = {
    id: fullPassId,
    classId: classId,
    cardTitle: {
      defaultValue: {
        language: 'en-US',
        value: cardTitle || 'LinearCard'
      }
    },
    subheader: {
      defaultValue: {
        language: 'en-US',
        value: tier || 'Member'
      }
    },
    header: {
      defaultValue: {
        language: 'en-US',
        value: memberName
      }
    },
    textModulesData,
    barcode: {
      type: 'QR_CODE',
      value: barcodeValue,
      alternateText: `${tier || 'Member'} • ${balance || '0 Pts'}`
    },
    hexBackgroundColor: hexBackgroundColor || '#1A365D',
    ...(logoUrl && { logo: { sourceUri: { uri: logoUrl } } }),
    ...(heroImageUrl && { heroImage: { sourceUri: { uri: heroImageUrl } } })
  };

  // Synchronous API Call to create the object in Google Wallet
  const client = await getGoogleAuthClient();
  try {
    await client.request({
      url: 'https://walletobjects.googleapis.com/walletobjects/v1/genericObject',
      method: 'POST',
      data: genericObjectPayload
    });
  } catch (error: any) {
    console.error('Failed to create generic object in Google Wallet:', error.response?.data || error.message);
    
    // Fallback: If the class does not exist, attempt to auto-create it with provided details
    try {
      console.log(`Attempting to auto-create missing class ${classId}...`);
      await createGenericClass({
        classSuffix,
        cardTitle,
        hexBackgroundColor,
        logoUrl,
        heroImageUrl,
        rows
      });
      // Retry creating the object after class is created
      await client.request({
        url: 'https://walletobjects.googleapis.com/walletobjects/v1/genericObject',
        method: 'POST',
        data: genericObjectPayload
      });
    } catch (retryError: any) {
      console.error('Failed to auto-create class and retry object creation:', retryError.response?.data || retryError.message);
      
      let errorMsg = 'Google Wallet API rejected the pass payload. Verify Class ID and image URLs.';
      if (retryError.response?.data?.error?.message) {
        errorMsg += ` Details: ${retryError.response.data.error.message}`;
      }
      throw new Error(errorMsg);
    }
  }

  // Generate lightweight JWT with just object reference
  const claims = {
    iss: clientEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [],
    payload: {
      genericObjects: [
        {
          id: fullPassId,
          classId: classId
        }
      ]
    }
  };

  const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' });
  const googleWalletUrl = `https://pay.google.com/gp/v/save/${token}`;

  return {
    success: true,
    googleWalletUrl,
    passId: objectSuffix,
    fullPassId,
    token,
    passData
  };
}

export async function getGoogleAuthClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !rawKey) {
    throw new Error('Missing Google Wallet credentials.');
  }

  const privateKey = formatPrivateKey(rawKey);

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });

  return await auth.getClient();
}

export async function createGenericClass(templateData: any) {
  const client = await getGoogleAuthClient();
  const issuerId = process.env.ISSUER_ID;
  const classId = `${issuerId}.${templateData.classSuffix || 'linearcard_sandbox_class'}`;

  const cardRowTemplateInfos: any[] = [];
  if (templateData.rows && templateData.rows.length > 0) {
    templateData.rows.forEach((row: any) => {
      const items = row.columns.map((col: any, idx: number) => {
        return {
          item: {
            fieldSelector: {
              fields: [
                {
                  fieldPath: `object.textModulesData['${row.id}_${idx}']`
                }
              ]
            }
          }
        };
      });

      if (items.length === 1) cardRowTemplateInfos.push({ oneItem: items[0] });
      else if (items.length === 2) cardRowTemplateInfos.push({ twoItems: { startItem: items[0], endItem: items[1] } });
      else if (items.length === 3) cardRowTemplateInfos.push({ threeItems: { startItem: items[0], middleItem: items[1], endItem: items[2] } });
    });
  }

  const classPayload: any = {
    id: classId,
    issuerName: templateData.cardTitle || 'LinearCard',
    hexBackgroundColor: templateData.hexBackgroundColor || '#1A365D'
  };

  if (templateData.logoUrl) {
    classPayload.logo = { sourceUri: { uri: templateData.logoUrl } };
  }
  if (templateData.heroImageUrl) {
    classPayload.heroImage = { sourceUri: { uri: templateData.heroImageUrl } };
  }
  
  if (cardRowTemplateInfos.length > 0) {
    classPayload.classTemplateInfo = {
      cardTemplateOverride: {
        cardRowTemplateInfos
      }
    };
  }

  const url = `https://walletobjects.googleapis.com/walletobjects/v1/genericClass`;

  try {
    // If updating an existing class, use the PATCH method
    if (templateData.isUpdate) {
      console.log(`Class ${classId} exists. Updating directly...`);
      const patchPayload = { ...classPayload };
      const updateRes = await client.request({
        url: `${url}/${classId}`,
        method: 'PATCH',
        data: patchPayload
      });
      return updateRes.data;
    } else {
      // Otherwise, attempt to create the class via POST
      const res = await client.request({
        url,
        method: 'POST',
        data: classPayload
      });
      return res.data;
    }
  } catch (error: any) {
    // Handle 409 Conflict if the class already exists during a POST attempt
    if (error.response?.status === 409) {
      console.log(`Class ${classId} already exists. Attempting update as fallback...`);
      try {
        const patchPayload = { ...classPayload };
        const updateRes = await client.request({
          url: `${url}/${classId}`,
          method: 'PATCH',
          data: patchPayload
        });
        return updateRes.data;
      } catch (e) {
        // Return existing status if the fallback update also fails
        return { id: classId, existing: true, updated: false };
      }
    }
    throw error;
  }
}

export async function updateGenericObject(passId: string, updateData: any) {
  const client = await getGoogleAuthClient();
  const url = `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${passId}`;

  // Since we mapped the dynamic fields to specific IDs in createGoogleWalletPass, 
  // we assume 'row1_0' or 'row1_1' could be the IDs if we kept them. 
  // For the sake of the update demo acting magically, we will fetch the object first to find the ID of the tier/balance.
  
  try {
     const getRes = await client.request({
       url,
       method: 'GET'
     });
     const genericObject: any = getRes.data;
     
     const patchPayload: any = { textModulesData: [] };
     // Map over existing text modules and inject the updated tier or balance values
     if (genericObject.textModulesData) {
       genericObject.textModulesData.forEach((mod: any) => {
         let newBody = mod.body;
         if (mod.header.toLowerCase().includes('tier') && updateData.tier) newBody = updateData.tier;
         if ((mod.header.toLowerCase().includes('balance') || mod.header.toLowerCase().includes('points')) && updateData.balance) newBody = updateData.balance;
         
         patchPayload.textModulesData.push({
           id: mod.id,
           header: mod.header,
           body: newBody
         });
       });
     } else {
       // Fallback payload if the object lacks text modules
       patchPayload.textModulesData = [
         { id: 'balance', header: 'Points / Status', body: updateData.balance },
         { id: 'tier_info', header: 'Tier Level', body: updateData.tier || 'Standard' }
       ];
     }

     // If a push notification message is provided, append it to the update payload
     if (updateData.pushNotification) {
       patchPayload.messages = [
         {
           header: 'LinearCard Update',
           body: updateData.pushNotification,
           id: `msg_${Date.now()}`
         }
       ];
     }

     const res = await client.request({
       url,
       method: 'PATCH',
       data: patchPayload
     });
     return res.data;
  } catch (err) {
     throw err;
  }
}
