import { useCallback } from 'react';

import {
  whatsappState,
  type WhatsappChatMessage,
  type WhatsappState,
} from '@/whatsapp/states/whatsappState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

export const useWhatsapp = () => {
  const [state, setState] = useAtomState(whatsappState);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const closeChat = useCallback(() => {
    setState((prev: WhatsappState) => ({
      ...prev,
      isDrawerOpen: false,
    }));
  }, [setState]);

  const fetchStatus = useCallback(async () => {
    try {
      setState((prev: WhatsappState) => ({
        ...prev,
        connectionStatus: prev.connectionStatus === 'CONNECTED' ? 'CONNECTED' : 'LOADING',
      }));

      const res = await fetch('/whatsapp/status');
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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !state.phoneNumber) return;

      const trimmedText = text.trim();
      const tempId = `msg_${Date.now()}`;
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newMsg: WhatsappChatMessage = {
        id: tempId,
        text: trimmedText,
        sender: 'me',
        timestamp: now,
        status: 'pending',
      };

      // Optimistically add message to state
      setState((prev: WhatsappState) => ({
        ...prev,
        isSending: true,
        messages: [...prev.messages, newMsg],
      }));

      try {
        const res = await fetch('/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: state.phoneNumber,
            text: trimmedText,
          }),
        });

        const data = await res.json();

        if (data.success) {
          setState((prev: WhatsappState) => ({
            ...prev,
            isSending: false,
            messages: prev.messages.map((m) =>
              m.id === tempId ? { ...m, status: 'sent', id: data.messageId || tempId } : m,
            ),
          }));
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

  return {
    ...state,
    openChat,
    closeChat,
    sendMessage,
    fetchStatus,
  };
};
