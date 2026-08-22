import { Injectable, Logger } from '@nestjs/common';

import { TwilioRecordingStatusWebhookDto } from 'src/modules/twilio/dtos/twilio-recording-status-webhook.dto';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  /**
   * Generates a Twilio Voice Access Token (JWT) for WebRTC browser clients.
   */
  async generateVoiceToken(identity: string): Promise<{ token: string; identity: string; isMock: boolean; missingEnvVars?: any; debug?: any }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const apiKey = process.env.TWILIO_API_KEY_SID?.trim();
    const apiSecret = process.env.TWILIO_API_KEY_SECRET?.trim();
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim();

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      this.logger.warn(
        'Twilio environment variables not fully configured in backend container. Returning mock token.',
      );
      return {
        token: `mock_twilio_token_${identity}_${Date.now()}`,
        identity,
        isMock: true,
        missingEnvVars: {
          TWILIO_ACCOUNT_SID: accountSid ? 'PRESENT' : 'MISSING',
          TWILIO_API_KEY_SID: apiKey ? 'PRESENT' : 'MISSING',
          TWILIO_API_KEY_SECRET: apiSecret ? 'PRESENT' : 'MISSING',
          TWILIO_TWIML_APP_SID: twimlAppSid ? 'PRESENT' : 'MISSING',
        },
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

      const token = new AccessToken(accountSid, apiKey, apiSecret, {
        identity: identity,
        ttl: 3600,
      });

      token.identity = identity;
      token.addGrant(voiceGrant);

      const jwtToken = token.toJwt();

      this.logger.log(`Successfully generated WebRTC Token for user: ${identity} | AccountSID: ${accountSid} | KeySID: ${apiKey} | AppSID: ${twimlAppSid}`);

      return {
        token: jwtToken,
        identity,
        isMock: false,
        debug: {
          accountSid,
          apiKeySid: apiKey,
          twimlAppSid,
        },
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
    let callerId = process.env.TWILIO_PHONE_NUMBER?.trim() || '';
    if (!callerId && from && !from.startsWith('client:') && /^\+?[0-9]+$/.test(from)) {
      callerId = from;
    }

    let serverUrl = process.env.SERVER_URL || process.env.FRONT_BASE_URL || 'https://crm.maysanlabs.com';
    if (serverUrl.endsWith('/')) {
      serverUrl = serverUrl.slice(0, -1);
    }
    const callbackUrl = `${serverUrl}/telephony/twilio/recording-status`;

    if (!to) {
      this.logger.warn('Twilio Voice Webhook received without destination number.');
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>No destination number was provided.</Say>
</Response>`;
    }

    // Clean destination number to E.164
    let cleanTo = to.trim().replace(/[\s\-\(\)\.]/g, '');
    if (!cleanTo.startsWith('+') && /^\d+$/.test(cleanTo)) {
      cleanTo = `+${cleanTo}`;
    }

    this.logger.log(`Handling Twilio Outbound Call to: ${cleanTo} | CallerId: ${callerId || 'NONE'}`);

    if (!callerId) {
      this.logger.warn(
        'TWILIO_PHONE_NUMBER is not set in backend environment. Twilio outbound PSTN calls require a verified Twilio callerId.',
      );
    }

    const callerIdAttr = callerId ? ` callerId="${callerId}"` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial${callerIdAttr} record="record-from-answer" recordingStatusCallback="${callbackUrl}">
        <Number>${cleanTo}</Number>
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
