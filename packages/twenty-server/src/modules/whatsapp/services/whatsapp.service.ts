import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface WhatsappInstanceStatus {
  instanceName: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'QR_READY' | 'CONNECTING' | 'ERROR';
  qrcode?: string; // base64 or raw pairing string
  pairingCode?: string;
  phoneConnected?: string;
  isMock?: boolean;
  message?: string;
}

export interface SendWhatsappMessageDto {
  to: string; // phone number e.g. "+1234567890" or "1234567890"
  text: string;
  instanceName?: string;
}

export interface SendWhatsappMediaDto {
  to: string;
  mediaUrl: string;
  caption?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
  fileName?: string;
  instanceName?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private getBaseUrl(): string {
    const rawUrl =
      process.env.EVOLUTION_GO_BASE_URL?.trim() ||
      process.env.EVOLUTION_BASE_URL?.trim() ||
      process.env.SERVER_URL?.trim() ||
      '';
    return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  }

  private getApiKey(): string {
    return (
      process.env.EVOLUTION_GO_API_KEY?.trim() ||
      process.env.AUTHENTICATION_API_KEY?.trim() ||
      process.env.GLOBAL_API_KEY?.trim() ||
      ''
    );
  }

  private getDefaultInstance(): string {
    return (
      process.env.EVOLUTION_GO_INSTANCE_NAME?.trim() ||
      process.env.CLIENT_NAME?.trim() ||
      'crm_main_instance'
    );
  }

  private getHeaders() {
    const apiKey = this.getApiKey();
    return {
      apikey: apiKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Normalizes a phone number to Evolution Go format (numbers only without + or special chars).
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Fetch current connection state and QR code from Evolution Go.
   */
  async getInstanceStatus(instanceName?: string): Promise<WhatsappInstanceStatus> {
    const instance = instanceName || this.getDefaultInstance();
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();

    if (!baseUrl || !apiKey) {
      this.logger.warn(
        'Evolution Go credentials (EVOLUTION_GO_BASE_URL / EVOLUTION_GO_API_KEY) missing in backend container. Returning mock status.',
      );
      return {
        instanceName: instance,
        status: 'QR_READY',
        qrcode:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        isMock: true,
        message: 'Mock Mode: Configure EVOLUTION_GO_BASE_URL and EVOLUTION_GO_API_KEY in Dokploy env.',
      };
    }

    try {
      // 1. Try to check connection state
      const stateUrl = `${baseUrl}/instance/connectionState/${instance}`;
      let stateRes;
      try {
        stateRes = await axios.get(stateUrl, {
          headers: this.getHeaders(),
          timeout: 8000,
        });
      } catch (err: any) {
        if (err.response?.status === 404) {
          // Instance does not exist yet -> create it
          this.logger.log(`Instance ${instance} not found. Creating instance...`);
          await this.createInstance(instance);
        } else {
          throw err;
        }
      }

      const connectionState =
        stateRes?.data?.instance?.state ||
        stateRes?.data?.state ||
        stateRes?.data?.status;

      if (connectionState === 'open' || connectionState === 'connected') {
        const phone =
          stateRes?.data?.instance?.ownerJid?.split('@')[0] ||
          stateRes?.data?.owner?.split('@')[0];
        return {
          instanceName: instance,
          status: 'CONNECTED',
          phoneConnected: phone ? `+${phone}` : undefined,
          isMock: false,
        };
      }

      // 2. If not connected, fetch QR code / connect payload
      const connectUrl = `${baseUrl}/instance/connect/${instance}`;
      const connectRes = await axios.get(connectUrl, {
        headers: this.getHeaders(),
        timeout: 8000,
      });

      const qrCode =
        connectRes.data?.base64 ||
        connectRes.data?.qrcode?.base64 ||
        connectRes.data?.code ||
        connectRes.data?.pairingCode;

      return {
        instanceName: instance,
        status: qrCode ? 'QR_READY' : 'CONNECTING',
        qrcode: qrCode,
        pairingCode: connectRes.data?.pairingCode,
        isMock: false,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching Evolution Go status for instance ${instance}:`, error?.message);
      return {
        instanceName: instance,
        status: 'ERROR',
        message: error?.response?.data?.message || error?.message || 'Failed to connect to Evolution Go',
        isMock: false,
      };
    }
  }

  /**
   * Provision a new instance in Evolution Go.
   */
  async createInstance(instanceName: string) {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return null;

    try {
      const res = await axios.post(
        `${baseUrl}/instance/create`,
        {
          instanceName,
          integration: 'WHATSAPP_BAILEYS',
          qrcode: true,
        },
        {
          headers: this.getHeaders(),
          timeout: 10000,
        },
      );
      this.logger.log(`Instance ${instanceName} created successfully in Evolution Go.`);
      return res.data;
    } catch (error: any) {
      this.logger.warn(`Could not create instance ${instanceName} (may already exist): ${error?.message}`);
      return null;
    }
  }

  /**
   * Send outbound text message to a destination phone number.
   */
  async sendTextMessage(dto: SendWhatsappMessageDto): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    isMock?: boolean;
  }> {
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const instance = dto.instanceName || this.getDefaultInstance();
    const cleanNumber = this.normalizePhone(dto.to);

    if (!cleanNumber) {
      return { success: false, error: 'Recipient phone number is invalid.' };
    }

    if (!baseUrl || !apiKey) {
      this.logger.warn(
        `Evolution Go credentials not configured. Mock sending WhatsApp text to ${cleanNumber}: "${dto.text}"`,
      );
      return {
        success: true,
        messageId: `mock_msg_${Date.now()}`,
        isMock: true,
      };
    }

    try {
      const url = `${baseUrl}/message/sendText/${instance}`;
      const res = await axios.post(
        url,
        {
          number: cleanNumber,
          text: dto.text,
          delay: 1200,
          linkPreview: true,
        },
        {
          headers: this.getHeaders(),
          timeout: 12000,
        },
      );

      const messageId =
        res.data?.key?.id ||
        res.data?.messageId ||
        res.data?.id ||
        `msg_${Date.now()}`;

      this.logger.log(
        `WhatsApp text message successfully sent to ${cleanNumber} (MsgID: ${messageId})`,
      );

      return {
        success: true,
        messageId,
        isMock: false,
      };
    } catch (error: any) {
      const errMsg =
        error?.response?.data?.response?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to send WhatsApp message';
      this.logger.error(`Failed to send WhatsApp message to ${cleanNumber}: ${errMsg}`, error?.stack);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Send outbound media (PDF, image, audio) to a destination phone number.
   */
  async sendMediaMessage(dto: SendWhatsappMediaDto): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const baseUrl = this.getBaseUrl();
    const instance = dto.instanceName || this.getDefaultInstance();
    const cleanNumber = this.normalizePhone(dto.to);

    if (!baseUrl || !this.getApiKey()) {
      return { success: true, messageId: `mock_media_${Date.now()}` };
    }

    // Ensure only valid URLs are passed for media (never raw Base64 strings to prevent DB bloat)
    if (dto.mediaUrl.startsWith('data:') || dto.mediaUrl.length > 2048) {
      this.logger.warn(
        'Base64 media rejected. Please upload media to S3/storage and provide the public URL.',
      );
      return {
        success: false,
        error:
          'Base64 binary media is not allowed. Provide an S3/Cloud storage URL instead.',
      };
    }

    try {
      const url = `${baseUrl}/message/sendMedia/${instance}`;
      const res = await axios.post(
        url,
        {
          number: cleanNumber,
          media: dto.mediaUrl,
          mediatype: dto.mediaType || 'document',
          caption: dto.caption || '',
          fileName: dto.fileName || 'file',
        },
        {
          headers: this.getHeaders(),
          timeout: 20000,
        },
      );

      return {
        success: true,
        messageId: res.data?.key?.id || res.data?.id,
      };
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || error?.message;
      this.logger.error(`Failed to send WhatsApp media to ${cleanNumber}: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Automatically triggered when an opportunity/deal changes pipeline stage.
   */
  async sendStageChangeNotification(
    recipientPhone: string,
    stageName: string,
    contactName?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const name = contactName || 'there';
    const messageText = `Hi ${name}, your deal status has been updated to: *${stageName}*. Our team is reviewing the next steps with you.`;

    this.logger.log(
      `Triggering automated WhatsApp stage notification to ${recipientPhone} for stage "${stageName}"`,
    );

    return this.sendTextMessage({
      to: recipientPhone,
      text: messageText,
    });
  }

  /**
   * Process incoming webhook payloads from Evolution Go.
   */
  async handleIncomingWebhook(payload: any): Promise<{
    success: boolean;
    event?: string;
    parsedMessage?: {
      senderPhone: string;
      text: string;
      fromMe: boolean;
      timestamp: number;
      messageId: string;
    };
    statusUpdate?: {
      messageId: string;
      status: string;
    };
  }> {
    const event = (payload?.event || payload?.type || '').toLowerCase();
    const data = payload?.data || payload;

    this.logger.log(`Received Evolution Go webhook event: ${event}`);

    // 1. Check for incoming or outgoing message upsert
    if (event.includes('messages.upsert') || event === 'messages_upsert') {
      const messageKey = data?.key || {};
      const remoteJid = messageKey.remoteJid || '';

      // BOUNDARY RULE: Ignore all group chats (@g.us) and status broadcasts (@broadcast)
      if (
        remoteJid.endsWith('@g.us') ||
        remoteJid.includes('@broadcast') ||
        remoteJid.includes('status@broadcast')
      ) {
        this.logger.log(`Skipping non-1-on-1 WhatsApp event from ${remoteJid}`);
        return { success: true, event: 'ignored_group_or_broadcast' };
      }

      const fromMe = Boolean(messageKey.fromMe);
      const messageObj = data?.message || {};

      const text =
        messageObj.conversation ||
        messageObj.extendedTextMessage?.text ||
        messageObj.imageMessage?.caption ||
        messageObj.documentMessage?.caption ||
        '';

      const rawNumber = remoteJid.split('@')[0];
      const senderPhone = rawNumber ? `+${rawNumber}` : '';
      const messageId = messageKey.id || `msg_${Date.now()}`;
      const timestamp = Number(data?.messageTimestamp || Date.now() / 1000);

      this.logger.log(
        `Parsed 1-on-1 WhatsApp message from ${senderPhone} (fromMe: ${fromMe}): "${text.slice(0, 40)}"`,
      );

      return {
        success: true,
        event: 'messages.upsert',
        parsedMessage: {
          senderPhone,
          text,
          fromMe,
          timestamp,
          messageId,
        },
      };
    }

    // 2. BOUNDARY RULE: Handle delivery status updates (sent -> delivered -> read ticks)
    if (event.includes('messages.update') || event === 'messages_update') {
      const messageId = data?.key?.id || data?.id || '';
      const status = (data?.status || data?.update?.status || '').toLowerCase();

      this.logger.log(
        `Received WhatsApp delivery receipt for message ${messageId}: ${status}`,
      );

      return {
        success: true,
        event: 'messages.update',
        statusUpdate: {
          messageId,
          status,
        },
      };
    }

    // 3. Handle connection update
    if (event.includes('connection.update') || event === 'connection_update') {
      const state = data?.state || data?.status;
      this.logger.log(`Evolution Go connection state updated: ${state}`);
      return { success: true, event: 'connection.update' };
    }

    return { success: true, event };
  }
}
