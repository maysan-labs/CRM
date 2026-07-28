import { Module } from '@nestjs/common';

import { TwilioController } from 'src/modules/twilio/controllers/twilio.controller';
import { TwilioService } from 'src/modules/twilio/services/twilio.service';

@Module({
  imports: [],
  controllers: [TwilioController],
  providers: [TwilioService],
  exports: [TwilioService],
})
export class TwilioModule {}
