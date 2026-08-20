import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export type WhatsappConnectionStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'QR_READY'
  | 'CONNECTING'
  | 'LOADING'
  | 'ERROR';

export interface WhatsappChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'contact';
  timestamp: string;
  status?: 'pending' | 'sent' | 'delivered' | 'read';
}

export interface WhatsappState {
  isDrawerOpen: boolean;
  phoneNumber: string;
  contactName: string;
  connectionStatus: WhatsappConnectionStatus;
  qrCode?: string;
  phoneConnected?: string;
  messages: WhatsappChatMessage[];
  isSending: boolean;
  isMockMode: boolean;
  errorMessage?: string;
}

export const whatsappState = createAtomState<WhatsappState>({
  key: 'whatsappState',
  defaultValue: {
    isDrawerOpen: false,
    phoneNumber: '',
    contactName: '',
    connectionStatus: 'LOADING',
    qrCode: undefined,
    phoneConnected: undefined,
    messages: [],
    isSending: false,
    isMockMode: false,
    errorMessage: undefined,
  },
});
