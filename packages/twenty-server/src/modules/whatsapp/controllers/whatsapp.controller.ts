import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import {
  SendWhatsappMessageDto,
  SendWhatsappMediaDto,
  WhatsappService,
} from 'src/modules/whatsapp/services/whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  /**
   * Get WhatsApp instance connection status and QR code / pairing info.
   * Access: GET /whatsapp/status?instance=crm_main_instance
   */
  @Get('status')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getStatus(@Query('instance') instance?: string) {
    return this.whatsappService.getInstanceStatus(instance);
  }

  /**
   * Create or re-initialize a WhatsApp instance in Evolution Go.
   * Access: POST /whatsapp/instance/create
   */
  @Post('instance/create')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async createInstance(@Body() body: { instanceName: string }) {
    const instanceName = body?.instanceName || 'crm_main_instance';
    return this.whatsappService.createInstance(instanceName);
  }

  /**
   * Outbound WhatsApp message sending endpoint from CRM UI.
   * Access: POST /whatsapp/send
   */
  @Post('send')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  async sendMessage(@Body() body: SendWhatsappMessageDto) {
    return this.whatsappService.sendTextMessage(body);
  }

  /**
   * Outbound WhatsApp media message sending endpoint.
   * Access: POST /whatsapp/send-media
   */
  @Post('send-media')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  async sendMedia(@Body() body: SendWhatsappMediaDto) {
    return this.whatsappService.sendMediaMessage(body);
  }

  /**
   * Health check / confirmation endpoint for webhook URL in browsers.
   * Access: GET /whatsapp/webhook
   */
  @Get('webhook')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getWebhookHealth() {
    return {
      status: 'ok',
      message: 'WhatsApp webhook endpoint is active and listening for POST events.',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Public Webhook receiver for Evolution Go events.
   * Evolution Go posts events here (MESSAGES_UPSERT, CONNECTION_UPDATE, etc.).
   * Access: POST /whatsapp/webhook
   */
  @Post('webhook')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  async handleWebhook(@Body() payload: any) {
    return this.whatsappService.handleIncomingWebhook(payload);
  }
}
