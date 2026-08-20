import { useCallback, useMemo } from 'react';

import {
  whatsappState,
  type WhatsappChatMessage,
  type WhatsappState,
} from '@/whatsapp/states/whatsappState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// Helper to normalize phone numbers to clean digits for dictionary lookup
const normalizePhoneKey = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

export const useWhatsapp = () => {
  const [state, setState] = useAtomState(whatsappState);

  const fetchStatus = useCallback(async () => {
    try {
      setState((prev: WhatsappState) => ({
        ...prev,
        connectionStatus:
          prev.connectionStatus === 'CONNECTED' ? 'CONNECTED' : 'LOADING',
      }));

      const baseUrl = REACT_APP_SERVER_BASE_URL || '';
      const res = await fetch(`${baseUrl}/whatsapp/status`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();

      setState((prev: WhatsappState) => ({
        ...prev,
        connectionStatus: data.status || 'ERROR',
        qrCode: data.qrcode,
        phoneConnected: data.phoneConnected,
        isMockMode: Boolean(data.isMock),
        errorMessage: data.message,
      }));
    } catch (error: any) {
      console.error('Failed to fetch WhatsApp status:', error);
      setState((prev: WhatsappState) => ({
        ...prev,
        connectionStatus: 'ERROR',
        errorMessage: error?.message || 'Unable to connect to WhatsApp backend',
      }));
    }
  }, [setState]);

  const openChat = useCallback(
    (phoneNumber: string, contactName?: string) => {
      setState((prev: WhatsappState) => ({
        ...prev,
        isDrawerOpen: true,
        phoneNumber,
        contactName: contactName || 'Contact',
        errorMessage: undefined,
      }));
      // Automatically refresh connection state when opening chat
      fetchStatus();
    },
    [fetchStatus, setState],
  );

  const closeChat = useCallback(() => {
    setState((prev: WhatsappState) => ({
      ...prev,
      isDrawerOpen: false,
    }));
  }, [setState]);

  const sendMessage = useCallback(
    async (text: string) => {
      const activePhone = state.phoneNumber;
      const phoneKey = normalizePhoneKey(activePhone);
      if (!text.trim() || !phoneKey) return;

      const trimmedText = text.trim();
      const tempId = `msg_${Date.now()}`;
      const now = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const newMsg: WhatsappChatMessage = {
        id: tempId,
        text: trimmedText,
        sender: 'me',
        timestamp: now,
        status: 'pending',
      };

      // Optimistically add message STRICTLY to this contact's conversation thread
      setState((prev: WhatsappState) => {
        const existingMessages = prev.messagesByPhone[phoneKey] || [];
        return {
          ...prev,
          isSending: true,
          errorMessage: undefined,
          messagesByPhone: {
            ...prev.messagesByPhone,
            [phoneKey]: [...existingMessages, newMsg],
          },
        };
      });

      try {
        const baseUrl = REACT_APP_SERVER_BASE_URL || '';
        const res = await fetch(`${baseUrl}/whatsapp/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: activePhone,
            text: trimmedText,
          }),
        });

        const data = await res.json();

        if (data.success) {
          setState((prev: WhatsappState) => {
            const currentList = prev.messagesByPhone[phoneKey] || [];
            return {
              ...prev,
              isSending: false,
              messagesByPhone: {
                ...prev.messagesByPhone,
                [phoneKey]: currentList.map((m) =>
                  m.id === tempId
                    ? { ...m, status: 'sent', id: data.messageId || tempId }
                    : m,
                ),
              },
            };
          });
        } else {
          setState((prev: WhatsappState) => ({
            ...prev,
            isSending: false,
            errorMessage: data.error || 'Failed to send message',
          }));
        }
      } catch (error: any) {
        console.error('Failed to send WhatsApp message:', error);
        setState((prev: WhatsappState) => ({
          ...prev,
          isSending: false,
          errorMessage: error?.message || 'Network error while sending message',
        }));
      }
    },
    [state.phoneNumber, setState],
  );

  // Derive the active message list STRICTLY for the currently selected phone number
  const activeMessages: WhatsappChatMessage[] = useMemo(() => {
    if (!state.phoneNumber) return [];
    const phoneKey = normalizePhoneKey(state.phoneNumber);
    return state.messagesByPhone[phoneKey] || [];
  }, [state.messagesByPhone, state.phoneNumber]);

  return {
    ...state,
    messages: activeMessages,
    openChat,
    closeChat,
    sendMessage,
    fetchStatus,
  };
};
