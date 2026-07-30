import { Injectable, Logger } from '@nestjs/common';

import { TwilioRecordingStatusWebhookDto } from 'src/modules/twilio/dtos/twilio-recording-status-webhook.dto';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  /**
   * Generates a Twilio Voice Access Token (JWT) for WebRTC browser clients.
   * Includes 60s nbf buffer to protect against server clock skew.
   */
  async generateVoiceToken(identity: string): Promise<{ token: string; identity: string; isMock: boolean }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const apiKey = process.env.TWILIO_API_KEY_SID?.trim();
    const apiSecret = process.env.TWILIO_API_KEY_SECRET?.trim();
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim();

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      this.logger.warn(
        'Twilio environment variables not fully configured. Vending mock WebRTC access token for local development.',
      );
      return {
        token: `mock_twilio_token_${identity}_${Date.now()}`,
        identity,
        isMock: true,
      };
    }

    if (!accountSid.startsWith('AC')) {
      this.logger.error(`TWILIO_ACCOUNT_SID must start with "AC" (got "${accountSid.substring(0, 4)}...")`);
    }
    if (!apiKey.startsWith('SK')) {
      this.logger.error(`TWILIO_API_KEY_SID must start with "SK" (got "${apiKey.substring(0, 4)}...")`);
    }
    if (!twimlAppSid.startsWith('AP')) {
      this.logger.error(`TWILIO_TWIML_APP_SID must start with "AP" (got "${twimlAppSid.substring(0, 4)}...")`);
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

      const nowInSeconds = Math.floor(Date.now() / 1000);
      const token = new AccessToken(accountSid, apiKey, apiSecret, {
        identity,
        ttl: 3600,
        nbf: nowInSeconds - 60, // 60s buffer against server clock skew
      });

      token.addGrant(voiceGrant);

      this.logger.log(`Vended valid WebRTC token for user: ${identity} under Account: ${accountSid.substring(0, 6)}...`);

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
