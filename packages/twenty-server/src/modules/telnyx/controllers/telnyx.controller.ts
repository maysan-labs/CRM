import { Body, Controller, Get, Header, HttpCode, Post, Query, UseGuards } from '@nestjs/common';

import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { TelnyxService } from 'src/modules/telnyx/services/telnyx.service';

@Controller('telephony/telnyx')
export class TelnyxController {
  constructor(private readonly telnyxService: TelnyxService) {}

  /**
   * Endpoint to vend Telnyx Voice JWT tokens for browser WebRTC clients.
   * Access: GET /telephony/telnyx/token?identity=user_123
   */
  @Get('token')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getToken(@Query('identity') identity?: string) {
    const userIdentity = identity || `agent_${Math.floor(Math.random() * 10000)}`;
    return this.telnyxService.generateVoiceToken(userIdentity);
  }

  /**
   * Public TeXML Webhook called by Telnyx when an outbound or inbound call connects (POST).
   * Returns XML TeXML response (compatible with TwiML).
   */
  @Post('voice')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  handleVoiceWebhookPost(@Body() body: any, @Query('To') queryTo?: string) {
    const destinationTo = body?.To || queryTo;
    const callerFrom = body?.From;

    return this.telnyxService.generateTeXMLResponse(destinationTo, callerFrom);
  }

  /**
   * Public TeXML Webhook called by Telnyx when an outbound or inbound call connects (GET).
   * Returns XML TeXML response (compatible with TwiML).
   */
  @Get('voice')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  handleVoiceWebhookGet(@Query('To') queryTo?: string, @Query('From') queryFrom?: string) {
    return this.telnyxService.generateTeXMLResponse(queryTo, queryFrom);
  }

  /**
   * Public Webhook callback from Telnyx when a call recording completes.
   */
  @Post('recording-status')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  async handleRecordingStatus(@Body() body: any) {
    return this.telnyxService.handleRecordingStatusWebhook(body);
  }
}
