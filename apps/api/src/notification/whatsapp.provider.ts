import { Logger } from '@nestjs/common';

/**
 * The one seam every WhatsApp call goes through (D6 — the provider is fluid:
 * WAHA today, Cloud API later). Swapping provider is a new implementation of
 * this interface and nothing else; no call site knows what WAHA is.
 */
export interface WhatsappProvider {
  /** `phone` is E.164 (`+919876543210`). */
  sendText(phone: string, text: string): Promise<any>;
}

/** WAHA (self-hosted WhatsApp HTTP API). The only implementation today. */
export class WahaProvider implements WhatsappProvider {
  private readonly logger = new Logger(WahaProvider.name);

  /** E.164 (+919876543210) -> WAHA chat id (919876543210@c.us). */
  private toChatId(phone: string): string {
    return `${phone.replace(/^\+/, '')}@c.us`;
  }

  async sendText(phone: string, text: string): Promise<any> {
    return this.post('/api/sendText', { chatId: this.toChatId(phone), text });
  }

  private async post(endpoint: string, body: object) {
    const baseUrl = process.env.WAHA_BASE_URL;
    const apiKey = process.env.WAHA_API_KEY;
    const session = process.env.WAHA_SESSION;

    // Gracefully handle a missing base URL so the app still runs offline.
    if (!baseUrl) {
      this.logger.warn(
        'WAHA_BASE_URL not set in .env. Skipping WhatsApp message.',
      );
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (apiKey) headers['X-Api-Key'] = apiKey;

    const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ session, ...body }),
      });

      if (!res.ok) {
        const detail = await res.text();
        this.logger.error(`Waha error ${res.status}: ${detail}`);
        throw new Error(`Waha error ${res.status}: ${detail}`);
      }

      return await res.json();
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${endpoint}:`,
        error,
      );
      throw error;
    }
  }
}
