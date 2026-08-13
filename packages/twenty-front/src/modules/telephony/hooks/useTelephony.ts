import { useRef } from 'react';

import {
  telephonyState,
  type TelephonyState,
} from '@/telephony/states/telephonyState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

// Helper to translate raw Twilio / WebRTC error codes into clear human-readable explanations
const parseTwilioError = (error: any): string => {
  if (!error) return 'Call Blocked (Check Geo-Permissions / Number)';
  const code = error.code || error.status;
  const message = (error.message || error.explanation || error.description || '').toString();
  
  if (code === 21215 || message.includes('21215') || message.toLowerCase().includes('geo')) {
    return 'Geo-Permissions Blocked for destination country';
  }
  if (code === 13225 || message.includes('13225') || message.toLowerCase().includes('blacklist')) {
    return 'Profile submission pending or number restricted (Error 13225)';
  }
  if (code === 31005 || message.toLowerCase().includes('permission') || message.toLowerCase().includes('microphone')) {
    return 'Microphone permission denied by browser';
  }
  if (code === 31205 || code === 20101) {
    return 'Twilio Authentication Token Expired or Invalid';
  }
  if (code === 21210) {
    return 'Destination number unverified (Trial Account)';
  }
  if (code === 31002 || message.toLowerCase().includes('timeout')) {
    return 'Network connection timeout';
  }
  
  if (code && message) {
    return `Error ${code}: ${message}`;
  }
  return message || (code ? `Error Code ${code}` : 'Geo-Permissions Blocked or Restricted Number');
};

// Helper to get Twilio Voice WebRTC Device class safely without local IDE declaration errors
const getTwilioVoiceDeviceClass = async (): Promise<any> => {
  if ((window as any).Twilio?.Device) {
    return (window as any).Twilio.Device;
  }
  try {
    // Dynamic import to support bundler resolution & SSR safety
    // @ts-ignore
    const sdk = await import('@twilio/voice-sdk');
    return sdk.Device || (sdk as any).default?.Device;
  } catch {
    // Fallback: Dynamically load official script tag if package is not present locally
    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('twilio-voice-sdk');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve((window as any).Twilio?.Device));
        return;
      }
      const script = document.createElement('script');
      script.id = 'twilio-voice-sdk';
      script.src = 'https://sdk.twilio.com/js/voice/releases/2.10.1/twilio-voice.min.js';
      script.async = true;
      script.onload = () => resolve((window as any).Twilio?.Device);
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }
};

export const useTelephony = () => {
  const [state, setState] = useAtomState(telephonyState);
  const activeCallRef = useRef<any>(null);
  const deviceRef = useRef<any>(null);
  const isUserInitiatedHangupRef = useRef<boolean>(false);

  const openDialer = (phoneNumber: string, contactName?: string) => {
    isUserInitiatedHangupRef.current = false;
    setState((prev: TelephonyState) => ({
      ...prev,
      isDrawerOpen: true,
      callState: 'IDLE',
      phoneNumber,
      contactName: contactName || 'Contact',
      durationSeconds: 0,
      isMuted: false,
      lastErrorMessage: undefined,
    }));
  };

  const dial = async (phoneNumber: string, contactName?: string) => {
    isUserInitiatedHangupRef.current = false;
    setState((prev: TelephonyState) => ({
      ...prev,
      isDrawerOpen: true,
      callState: 'DIALING',
      phoneNumber,
      contactName: contactName || 'Contact',
      durationSeconds: 0,
      isMuted: false,
      lastErrorMessage: undefined,
    }));

    if (state.isMockMode) {
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
      try {
        const response = await fetch('/telephony/twilio/token');
        const data = await response.json();

        if (!data.token) {
          console.error('Failed to receive Twilio Voice Token:', data);
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'FAILED',
            lastErrorMessage: 'Authentication Token Missing from Backend',
          }));
          return;
        }

        const DeviceClass = await getTwilioVoiceDeviceClass();
        if (!DeviceClass) {
          throw new Error('Twilio Voice Device SDK could not be loaded');
        }

        const device = new DeviceClass(data.token, {
          codecPreferences: ['opus', 'pcmu'],
        });
        deviceRef.current = device;

        const handleTwilioError = (error: any) => {
          console.error('Twilio Error Event:', error);
          const parsed = parseTwilioError(error);
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'FAILED',
            lastErrorMessage: parsed,
          }));
        };

        device.on('error', handleTwilioError);

        const call = await device.connect({
          params: {
            To: phoneNumber,
          },
        });
        activeCallRef.current = call;

        call.on('accept', () => {
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'CONNECTED',
          }));
        });

        call.on('error', handleTwilioError);

        call.on('disconnect', (disconnectedCall: any) => {
          activeCallRef.current = null;

          setState((prev: TelephonyState) => {
            if (prev.callState === 'FAILED') {
              return prev;
            }

            // If disconnected before connect and NOT user-initiated hangup, it was rejected by Twilio
            if (!isUserInitiatedHangupRef.current && prev.durationSeconds === 0) {
              const parsed = parseTwilioError(disconnectedCall);
              return {
                ...prev,
                callState: 'FAILED',
                lastErrorMessage: parsed,
              };
            }

            const duration = prev.durationSeconds;
            let nextState: TelephonyState['callState'] = 'COMPLETED';
            if (duration === 0) {
              nextState = 'CANCELLED';
            }

            return {
              ...prev,
              callState: nextState,
            };
          });

          setTimeout(() => {
            setState((prev: TelephonyState) => {
              if (prev.callState === 'FAILED') {
                return prev;
              }
              return {
                ...prev,
                callState: 'IDLE',
                isDrawerOpen: false,
                durationSeconds: 0,
              };
            });
          }, 3000);
        });

        call.on('cancel', (cancelledCall: any) => {
          activeCallRef.current = null;
          
          setState((prev: TelephonyState) => {
            if (prev.callState === 'FAILED') {
              return prev;
            }

            // Distinguish user click vs Twilio server-side rejection (Geo-Permissions/Blacklist)
            if (!isUserInitiatedHangupRef.current) {
              const parsed = parseTwilioError(cancelledCall);
              return {
                ...prev,
                callState: 'FAILED',
                lastErrorMessage: parsed,
              };
            }

            return {
              ...prev,
              callState: 'CANCELLED',
            };
          });

          setTimeout(() => {
            setState((prev: TelephonyState) => {
              if (prev.callState === 'FAILED') {
                return prev;
              }
              return {
                ...prev,
                callState: 'IDLE',
                isDrawerOpen: false,
                durationSeconds: 0,
              };
            });
          }, 3000);
        });

        call.on('reject', () => {
          activeCallRef.current = null;
          setState((prev: TelephonyState) => ({
            ...prev,
            callState: 'BUSY',
          }));
          setTimeout(() => {
            setState((prev: TelephonyState) => ({
              ...prev,
              callState: 'IDLE',
              isDrawerOpen: false,
              durationSeconds: 0,
            }));
          }, 3000);
        });
      } catch (error: any) {
        console.error('Twilio WebRTC Error:', error);
        const parsed = parseTwilioError(error);
        setState((prev: TelephonyState) => ({
          ...prev,
          callState: 'FAILED',
          lastErrorMessage: parsed,
        }));
      }
    }
  };

  const hangUp = () => {
    isUserInitiatedHangupRef.current = true;
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
      activeCallRef.current = null;
    } else if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
    }

    setState((prev: TelephonyState) => ({
      ...prev,
      callState: prev.durationSeconds > 0 ? 'COMPLETED' : 'CANCELLED',
    }));

    setTimeout(() => {
      setState((prev: TelephonyState) => ({
        ...prev,
        callState: 'IDLE',
        isDrawerOpen: false,
        durationSeconds: 0,
      }));
    }, 2000);
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
    lastErrorMessage: state.lastErrorMessage,
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
