import { Module } from '@nestjs/common';
import { WhatsappController } from 'src/modules/whatsapp/controllers/whatsapp.controller';
import { WhatsappService } from 'src/modules/whatsapp/services/whatsapp.service';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
