import { Module } from '@nestjs/common';
import { TelnyxController } from 'src/modules/telnyx/controllers/telnyx.controller';
import { TelnyxService } from 'src/modules/telnyx/services/telnyx.service';

@Module({
  controllers: [TelnyxController],
  providers: [TelnyxService],
  exports: [TelnyxService],
})
export class TelnyxModule {}
