import { Body, Controller, Get, Header, HttpCode, Post, Query, UseGuards } from '@nestjs/common';

import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { TwilioRecordingStatusWebhookDto } from 'src/modules/twilio/dtos/twilio-recording-status-webhook.dto';
import { TwilioService } from 'src/modules/twilio/services/twilio.service';

@Controller('telephony/twilio')
export class TwilioController {
  constructor(private readonly twilioService: TwilioService) {}

  /**
   * Endpoint to vend Twilio Voice JWT tokens for browser WebRTC clients.
   * Access: GET /telephony/twilio/token?identity=user_123
   */
  @Get('token')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getToken(@Query('identity') identity?: string) {
    const userIdentity = identity || `agent_${Math.floor(Math.random() * 10000)}`;
    return this.twilioService.generateVoiceToken(userIdentity);
  }

  /**
   * Public TwiML Webhook called by Twilio when an outbound or inbound call connects (POST).
   * Returns XML TwiML response.
   */
  @Post('voice')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  handleVoiceWebhookPost(@Body() body: any, @Query('To') queryTo?: string) {
    const destinationTo = body?.To || queryTo;
    const callerFrom = body?.From;

    return this.twilioService.generateTwiMLResponse(destinationTo, callerFrom);
  }

  /**
   * Public TwiML Webhook called by Twilio when an outbound or inbound call connects (GET).
   * Returns XML TwiML response.
   */
  @Get('voice')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  handleVoiceWebhookGet(@Query('To') queryTo?: string, @Query('From') queryFrom?: string) {
    return this.twilioService.generateTwiMLResponse(queryTo, queryFrom);
  }

  /**
   * Public Webhook callback from Twilio when a call recording completes.
   */
  @Post('recording-status')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  async handleRecordingStatus(@Body() body: TwilioRecordingStatusWebhookDto) {
    return this.twilioService.handleRecordingStatusWebhook(body);
  }
}
