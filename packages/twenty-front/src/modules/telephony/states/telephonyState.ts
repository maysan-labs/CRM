import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export type TelephonyCallState =
  | 'IDLE'
  | 'DIALING'
  | 'CONNECTED'
  | 'INCOMING'
  | 'ENDED'
  | 'BUSY'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_ANSWER';

export interface TelephonyState {
  isDrawerOpen: boolean;
  callState: TelephonyCallState;
  phoneNumber: string;
  contactName: string;
  durationSeconds: number;
  isMuted: boolean;
  isMockMode: boolean;
  activeProvider: 'telnyx' | 'twilio';
  lastErrorMessage?: string;
}

export const telephonyState = createAtomState<TelephonyState>({
  key: 'telephonyState',
  defaultValue: {
    isDrawerOpen: false,
    callState: 'IDLE',
    phoneNumber: '',
    contactName: '',
    durationSeconds: 0,
    isMuted: false,
    isMockMode: false,
    activeProvider: 'telnyx',
    lastErrorMessage: undefined,
  },
});
