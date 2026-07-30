import { useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';

import {
  telephonyState,
  type TelephonyState,
} from '@/telephony/states/telephonyState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

export const useTelephony = () => {
  const [state, setState] = useAtomState(telephonyState);
  const activeCallRef = useRef<Call | null>(null);
  const deviceRef = useRef<Device | null>(null);

  // Pre-fills the softphone drawer in IDLE mode for user confirmation
  const openDialer = (phoneNumber: string, contactName?: string) => {
    setState((prev: TelephonyState) => ({
      ...prev,
      isDrawerOpen: true,
      callState: 'IDLE',
      phoneNumber,
      contactName: contactName || 'Contact',
      durationSeconds: 0,
      isMuted: false,
    }));
  };

  // Initiates the actual WebRTC call (Mock Mode or Live Twilio Voice Mode)
  const dial = async (phoneNumber: string, contactName?: string) => {
    setState((prev: TelephonyState) => ({
      ...prev,
      isDrawerOpen: true,
      callState: 'DIALING', // Set status to Ringing...
      phoneNumber,
      contactName: contactName || 'Contact',
      durationSeconds: 0,
      isMuted: false,
    }));

    if (state.isMockMode) {
      // Mock Mode Simulation
      setTimeout(() => {
        setState((prev: TelephonyState) => {
          if (prev.callState === 'DIALING') {
            return {
              ...prev,
              callState: 'CONNECTED',
            };
          }
          return prev;
        });
      }, 2000);
    } else {
      // Live Twilio Mode: Fetch WebRTC Access Token & Connect WebRTC Device
      try {
        const response = await fetch('/telephony/twilio/token');
        const data = await response.json();

        if (!data.token) {
          console.error('Failed to receive Twilio Voice Token:', data);
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'ENDED',
          }));
          return;
        }

        // Instantiate Twilio WebRTC Device directly from npm package
        const device = new Device(data.token, {
          codecPreferences: ['opus', 'pcmu'],
        });
        deviceRef.current = device;

        device.on('error', (error: any) => {
          console.error('Twilio Voice Device Error:', error);
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'ENDED',
          }));
        });

        // Place WebRTC outbound call to Twilio Gateway
        const call = await device.connect({
          params: {
            To: phoneNumber,
          },
        });
        activeCallRef.current = call;

        // Fired when recipient actually picks up the call
        call.on('accept', () => {
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'CONNECTED',
          }));
        });

        // Fired when call is hung up or rejected
        call.on('disconnect', () => {
          activeCallRef.current = null;
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'ENDED',
          }));
          setTimeout(() => {
            setState((prev: TelephonyState) => ({
              ...prev,
              callState: 'IDLE',
              isDrawerOpen: false,
              durationSeconds: 0,
            }));
          }, 1000);
        });

        call.on('cancel', () => {
          activeCallRef.current = null;
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'ENDED',
          }));
        });

        call.on('error', (err: any) => {
          console.error('Twilio WebRTC Call Error:', err);
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'ENDED',
          }));
        });
      } catch (error) {
        console.error('Twilio WebRTC Error:', error);
        setState((prev: TelephonyState) => ({
          ...prev,
          callState: 'ENDED',
        }));
      }
    }
  };

  const hangUp = () => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
      activeCallRef.current = null;
    } else if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
    }

    setState((prev: TelephonyState) => ({
      ...prev,
      callState: 'ENDED',
    }));

    setTimeout(() => {
      setState((prev: TelephonyState) => ({
        ...prev,
        callState: 'IDLE',
        isDrawerOpen: false,
        durationSeconds: 0,
      }));
    }, 1000);
  };

  const toggleMute = () => {
    if (activeCallRef.current) {
      const currentMute = activeCallRef.current.isMuted();
      activeCallRef.current.mute(!currentMute);
      setState((prev: TelephonyState) => ({
        ...prev,
        isMuted: !currentMute,
      }));
    } else {
      setState((prev: TelephonyState) => ({
        ...prev,
        isMuted: !prev.isMuted,
      }));
    }
  };

  const toggleDrawer = () => {
    setState((prev: TelephonyState) => ({
      ...prev,
      isDrawerOpen: !prev.isDrawerOpen,
    }));
  };

  const setMockMode = (isMock: boolean) => {
    setState((prev: TelephonyState) => ({
      ...prev,
      isMockMode: isMock,
    }));
  };

  const formatDuration = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    isDrawerOpen: state.isDrawerOpen,
    callState: state.callState,
    phoneNumber: state.phoneNumber,
    contactName: state.contactName,
    durationSeconds: state.durationSeconds,
    isMuted: state.isMuted,
    isMockMode: state.isMockMode,
    openDialer,
    dial,
    hangUp,
    toggleMute,
    toggleDrawer,
    setMockMode,
    formatDuration,
    setState,
  };
};
