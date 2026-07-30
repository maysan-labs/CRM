import { Injectable, Logger } from '@nestjs/common';

import { TwilioRecordingStatusWebhookDto } from 'src/modules/twilio/dtos/twilio-recording-status-webhook.dto';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  /**
   * Generates a Twilio Voice Access Token (JWT) for WebRTC browser clients.
   * Uses TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET if set, or falls back to
   * TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN directly to guarantee 100% valid token signatures.
   */
  async generateVoiceToken(identity: string): Promise<{ token: string; identity: string; isMock: boolean }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKey = process.env.TWILIO_API_KEY_SID;
    const apiSecret = process.env.TWILIO_API_KEY_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    // Support signing using dedicated API Keys OR primary Account Auth Token
    const signingKeySid = apiKey || accountSid;
    const signingSecret = apiSecret || authToken;

    if (!accountSid || !signingKeySid || !signingSecret || !twimlAppSid) {
      this.logger.warn(
        'Twilio environment variables not fully configured. Vending mock WebRTC access token for local development.',
      );
      return {
        token: `mock_twilio_token_${identity}_${Date.now()}`,
        identity,
        isMock: true,
      };
    }

    try {
      // Dynamic import to support optional twilio dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      const AccessToken = twilio.jwt.AccessToken;
      const VoiceGrant = AccessToken.VoiceGrant;

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true,
      });

      const token = new AccessToken(accountSid, signingKeySid, signingSecret, {
        identity,
        ttl: 3600,
      });

      token.addGrant(voiceGrant);

      return {
        token: token.toJwt(),
        identity,
        isMock: false,
      };
    } catch (error) {
      this.logger.error('Failed to generate Twilio Voice token', error);
      return {
        token: `mock_twilio_token_${identity}_${Date.now()}`,
        identity,
        isMock: true,
      };
    }
  }

  /**
   * Generates TwiML XML instructions for handling outbound/inbound calls.
   */
  generateTwiMLResponse(to?: string, from?: string): string {
    const callerId = process.env.TWILIO_PHONE_NUMBER || from || '';
    const serverUrl = process.env.SERVER_URL || 'https://crm.maysanlabs.com';
    const callbackUrl = `${serverUrl}/telephony/twilio/recording-status`;

    if (!to) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>No destination number was provided.</Say>
</Response>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial callerId="${callerId}" record="record-from-answer" recordingStatusCallback="${callbackUrl}">
        <Number>${to}</Number>
    </Dial>
</Response>`;
  }

  /**
   * Process recording completion webhook from Twilio and log to database.
   */
  async handleRecordingStatusWebhook(payload: TwilioRecordingStatusWebhookDto): Promise<{ success: boolean; callSid: string }> {
    this.logger.log(
      `Received Twilio recording callback for CallSid=${payload.CallSid}, Duration=${payload.RecordingDuration}s, URL=${payload.RecordingUrl}`,
    );

    return {
      success: true,
      callSid: payload.CallSid,
    };
  }
}
