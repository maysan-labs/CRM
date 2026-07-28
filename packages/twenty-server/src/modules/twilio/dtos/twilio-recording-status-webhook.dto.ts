export class TwilioRecordingStatusWebhookDto {
  CallSid: string;
  RecordingSid: string;
  RecordingUrl: string;
  RecordingDuration?: string;
  RecordingStatus: string;
  CallStatus?: string;
  From?: string;
  To?: string;
  AccountSid?: string;
}
