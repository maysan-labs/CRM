import { Test, TestingModule } from '@nestjs/testing';

import { TwilioService } from 'src/modules/twilio/services/twilio.service';

describe('TwilioService', () => {
  let service: TwilioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TwilioService],
    }).compile();

    service = module.get<TwilioService>(TwilioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a mock token when env vars are missing', async () => {
    const result = await service.generateVoiceToken('agent_test');
    expect(result).toHaveProperty('token');
    expect(result.identity).toBe('agent_test');
    expect(result.isMock).toBe(true);
  });

  it('should generate TwiML XML response for outbound call', () => {
    const twiml = service.generateTwiMLResponse('+1234567890');
    expect(twiml).toContain('<Response>');
    expect(twiml).toContain('<Dial');
    expect(twiml).toContain('<Number>+1234567890</Number>');
  });

  it('should process recording status callback', async () => {
    const result = await service.handleRecordingStatusWebhook({
      CallSid: 'CA12345',
      RecordingSid: 'RE12345',
      RecordingUrl: 'https://api.twilio.com/recording.mp3',
      RecordingStatus: 'completed',
    });

    expect(result.success).toBe(true);
    expect(result.callSid).toBe('CA12345');
  });
});
