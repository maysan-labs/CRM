import {
  telephonyState,
  type TelephonyState,
} from '@/telephony/states/telephonyState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

export const useTelephony = () => {
  const [state, setState] = useAtomState(telephonyState);

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

  // Initiates the actual call (Mock Mode or Live Twilio Mode)
  const dial = async (phoneNumber: string, contactName?: string) => {
    setState((prev: TelephonyState) => ({
      ...prev,
      isDrawerOpen: true,
      callState: 'DIALING',
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
      }, 1500);
    } else {
      // Live Twilio Mode: Fetch WebRTC Access Token from backend
      try {
        const response = await fetch('/telephony/twilio/token');
        const data = await response.json();
        if (data.token) {
          // Token received successfully
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'CONNECTED',
          }));
        } else {
          console.error('Failed to get Twilio Voice Token:', data);
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'ENDED',
          }));
        }
      } catch (error) {
        console.error('Twilio Voice Token Error:', error);
        setState((prev: TelephonyState) => ({
          ...prev,
          callState: 'ENDED',
        }));
      }
    }
  };

  const hangUp = () => {
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
    setState((prev: TelephonyState) => ({
      ...prev,
      isMuted: !prev.isMuted,
    }));
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
