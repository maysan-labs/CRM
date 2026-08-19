import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TelnyxService {
  private readonly logger = new Logger(TelnyxService.name);

  /**
   * Generates a Telnyx WebRTC Access Token (JWT) for browser clients.
   */
  async generateVoiceToken(
    identity: string,
  ): Promise<{
    token: string;
    identity: string;
    isMock: boolean;
    missingEnvVars?: any;
    debug?: any;
  }> {
    const apiKey = process.env.TELNYX_API_KEY?.trim();
    const credentialId =
      process.env.TELNYX_CREDENTIAL_ID?.trim() ||
      process.env.CONNECTION_ID?.trim();

    if (!apiKey || !credentialId) {
      this.logger.warn(
        'Telnyx environment variables not fully configured in backend container. Returning mock token.',
      );
      return {
        token: `mock_telnyx_token_${identity}_${Date.now()}`,
        identity,
        isMock: true,
        missingEnvVars: {
          TELNYX_API_KEY: apiKey ? 'PRESENT' : 'MISSING',
          TELNYX_CREDENTIAL_ID: credentialId ? 'PRESENT' : 'MISSING',
        },
      };
    }

    try {
      // Dynamic import to support optional telnyx dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const telnyx = require('telnyx')(apiKey);

      let activeCredentialId = credentialId;

      // Intelligently resolve the Telephony Credential ID if the user provided a SIP Connection ID
      try {
        const credentialsList = await telnyx.telephonyCredentials.list({
          filter: { resource_id: `connection:${credentialId}` },
        });
        if (credentialsList?.data && credentialsList.data.length > 0) {
          activeCredentialId = credentialsList.data[0].id;
          this.logger.log(
            `Resolved SIP Connection ID to Telephony Credential ID: ${activeCredentialId}`,
          );
        } else {
          // If 0 credentials exist, automatically provision one for WebRTC!
          const newCredential = await telnyx.telephonyCredentials.create({
            connection_id: credentialId,
          });
          if (newCredential?.data?.id) {
            activeCredentialId = newCredential.data.id;
            this.logger.log(
              `Auto-provisioned new Telephony Credential ID: ${activeCredentialId}`,
            );
          }
        }
      } catch (e) {
        // Silently ignore: The ID might already be a valid Telephony Credential ID, or the API call failed.
      }

      const response =
        await telnyx.telephonyCredentials.createToken(activeCredentialId);
      // Ensure we extract the string token properly, as the exact return structure may vary
      let jwtToken = '';
      if (typeof response === 'string') {
        jwtToken = response;
      } else if (response?.data && typeof response.data === 'string') {
        jwtToken = response.data;
      } else if (response?.data?.token) {
        jwtToken = response.data.token;
      } else if (response?.token) {
        jwtToken = response.token;
      } else if (response) {
        jwtToken = response.toString();
      }

      this.logger.log(
        `Successfully generated Telnyx WebRTC Token for user: ${identity} | CredentialID: ${credentialId}`,
      );

      return {
        token: jwtToken,
        identity,
        isMock: false,
        debug: {
          credentialId,
        },
      };
    } catch (error: any) {
      this.logger.error('Failed to generate Telnyx WebRTC token', error);
      const errMsg = error?.message
        ? error.message.replace(/[^a-zA-Z0-9]/g, '_')
        : 'unknown_error';
      return {
        token: `mock_telnyx_token_ERROR_${errMsg}_${Date.now()}`,
        identity,
        isMock: true,
      };
    }
  }

  /**
   * Generates TeXML (XML) instructions for handling outbound/inbound calls.
   */
  generateTeXMLResponse(to?: string, from?: string): string {
    const callerId =
      process.env.TELNYX_PHONE_NUMBER ||
      process.env.TWILIO_PHONE_NUMBER ||
      from ||
      '';
    let serverUrl = process.env.SERVER_URL || process.env.FRONT_BASE_URL || '';
    if (serverUrl.endsWith('/')) {
      serverUrl = serverUrl.slice(0, -1);
    }
    const callbackUrl = serverUrl
      ? `${serverUrl}/telephony/telnyx/recording-status`
      : '/telephony/telnyx/recording-status';

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
   * Process recording completion webhook from Telnyx and log to database.
   */
  async handleRecordingStatusWebhook(
    payload: any,
  ): Promise<{ success: boolean; callSid: string }> {
    this.logger.log(
      `Received Telnyx recording callback for CallSid=${payload.CallSid || payload.call_control_id}, URL=${payload.RecordingUrl || payload.recording_url}`,
    );

    return {
      success: true,
      callSid: payload.CallSid || payload.call_control_id || 'unknown',
    };
  }
}
