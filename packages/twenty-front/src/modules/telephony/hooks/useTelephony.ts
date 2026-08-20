import { useRef } from 'react';

import {
  telephonyState,
  type TelephonyState,
} from '@/telephony/states/telephonyState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

// Helper to translate raw Twilio / WebRTC error codes into clear human-readable explanations
const parseTwilioError = (error: any): string => {
  if (!error) return 'Call Blocked (Check Geo-Permissions / Number)';
  
  // Safely extract code, status, and message, handling cases where they might be functions on the Call object
  let code = typeof error.code === 'function' ? error.code() : error.code;
  let status = typeof error.status === 'function' ? error.status() : error.status;
  
  let rawMessage = error.message || error.explanation || error.description;
  let message = typeof rawMessage === 'function' ? rawMessage() : rawMessage;
  message = (message || '').toString();

  // Use code if it's a number/string, otherwise use status if it's a number
  const errCode = code || (typeof status === 'number' ? status : undefined);

  if (errCode === 21215 || message.includes('21215') || message.toLowerCase().includes('geo')) {
    return 'Geo-Permissions Blocked for destination country';
  }
  if (errCode === 13225 || message.includes('13225') || message.toLowerCase().includes('blacklist')) {
    return 'Profile submission pending or number restricted (Error 13225)';
  }
  if (errCode === 31005 || message.toLowerCase().includes('permission') || message.toLowerCase().includes('microphone')) {
    return 'Microphone permission denied by browser';
  }
  if (errCode === 31205 || errCode === 20101) {
    return 'Authentication Token Expired or Invalid';
  }
  if (errCode === 21210) {
    return 'Destination number unverified (Trial Account)';
  }
  if (errCode === 31002 || message.toLowerCase().includes('timeout')) {
    return 'Network connection timeout';
  }
  
  if (errCode && message && !message.includes('[object Object]')) {
    return `Error ${errCode}: ${message}`;
  }
  
  if (message && !message.includes('[object Object]')) {
    return message;
  }
  
  if (errCode) {
    return `Error Code ${errCode}`;
  }

  return 'Call Blocked (Check Geo-Permissions / Number)';
};

// Helper to get Twilio Voice WebRTC Device class safely
const getTwilioVoiceDeviceClass = async (): Promise<any> => {
  if ((window as any).Twilio?.Device) {
    return (window as any).Twilio.Device;
  }
  try {
    // @ts-ignore
    const sdk = await import('@twilio/voice-sdk');
    return sdk.Device || (sdk as any).default?.Device;
  } catch {
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

// Helper to get Telnyx WebRTC Device class safely
const getTelnyxVoiceDeviceClass = async (): Promise<any> => {
  try {
    // @ts-ignore
    const sdk = await import('@telnyx/webrtc');
    return sdk.TelnyxRTC || (sdk as any).default?.TelnyxRTC;
  } catch (error) {
    console.error('Failed to load @telnyx/webrtc', error);
    throw error;
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
      return;
    }

    try {
      const provider = state.activeProvider;
      const endpoint = provider === 'telnyx' ? '/telephony/telnyx/token' : '/telephony/twilio/token';
      
      const response = await fetch(endpoint);
      const data = await response.json();

      if (!data.token) {
        console.error(`Failed to receive ${provider} Token:`, data);
        setState((prev: TelephonyState) => ({
          ...prev,
          callState: 'FAILED',
          lastErrorMessage: 'Authentication Token Missing from Backend',
        }));
        return;
      }

      console.error('================================================');
      console.error('RECEIVED TOKEN FROM BACKEND:', data.token);
      console.error('================================================');

      const handleError = (error: any) => {
        console.error(`${provider} Error Event:`, error);
        const parsed = parseTwilioError(error);
        setState((prev: TelephonyState) => ({
          ...prev,
          callState: 'FAILED',
          lastErrorMessage: parsed,
        }));
      };

      if (provider === 'telnyx') {
        const TelnyxRTC = await getTelnyxVoiceDeviceClass();
        if (!TelnyxRTC) throw new Error('Telnyx SDK could not be loaded');

        const client = new TelnyxRTC({
          login_token: data.token,
        });
        deviceRef.current = client;

        client.on('telnyx.error', handleError);
        client.on('telnyx.socket.error', handleError);

        client.connect();

        client.on('telnyx.ready', () => {
          let audioEl = document.getElementById('telnyx-audio') as HTMLAudioElement;
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'telnyx-audio';
            audioEl.autoplay = true;
            document.body.appendChild(audioEl);
          }

          const call = client.newCall({
            destinationNumber: phoneNumber,
            audio: true,
            video: false,
          });
          
          activeCallRef.current = call;
        });

        // Handle all call events at the client level
        client.on('telnyx.notification', (notification: any) => {
          if (notification.type === 'callUpdate') {
            const call = notification.call;
            
            if (call.state === 'active') {
              setState((prev: TelephonyState) => ({ ...prev, callState: 'CONNECTED' }));
            }
            
            if (call.state === 'hangup' || call.state === 'destroy') {
              activeCallRef.current = null;
              setState((prev: TelephonyState) => {
                if (prev.callState === 'FAILED') return prev;
                if (!isUserInitiatedHangupRef.current && prev.durationSeconds === 0) {
                  return { ...prev, callState: 'FAILED', lastErrorMessage: 'Call Ended' };
                }
                return { ...prev, callState: prev.durationSeconds > 0 ? 'COMPLETED' : 'CANCELLED' };
              });
              setTimeout(() => {
                setState((prev: TelephonyState) => {
                  if (prev.callState === 'FAILED') return prev;
                  return { ...prev, callState: 'IDLE', isDrawerOpen: false, durationSeconds: 0 };
                });
              }, 3000);
            }
          }
        });
      } else {
        // TWILIO
        const DeviceClass = await getTwilioVoiceDeviceClass();
        if (!DeviceClass) throw new Error('Twilio Voice Device SDK could not be loaded');

        const device = new DeviceClass(data.token, { codecPreferences: ['opus', 'pcmu'] });
        deviceRef.current = device;
        device.on('error', handleError);

        const call = await device.connect({ params: { To: phoneNumber } });
        activeCallRef.current = call;

        call.on('accept', () => setState((prev: TelephonyState) => ({ ...prev, callState: 'CONNECTED' })));
        call.on('error', handleError);

        call.on('disconnect', (disconnectedCall: any) => {
          activeCallRef.current = null;
          setState((prev: TelephonyState) => {
            if (prev.callState === 'FAILED') return prev;
            if (!isUserInitiatedHangupRef.current && prev.durationSeconds === 0) {
              return { ...prev, callState: 'FAILED', lastErrorMessage: parseTwilioError(disconnectedCall) };
            }
            return { ...prev, callState: prev.durationSeconds > 0 ? 'COMPLETED' : 'CANCELLED' };
          });
          setTimeout(() => setState((prev: TelephonyState) => (prev.callState === 'FAILED' ? prev : { ...prev, callState: 'IDLE', isDrawerOpen: false, durationSeconds: 0 })), 3000);
        });

        call.on('cancel', (cancelledCall: any) => {
          activeCallRef.current = null;
          setState((prev: TelephonyState) => {
            if (prev.callState === 'FAILED') return prev;
            if (!isUserInitiatedHangupRef.current) {
              return { ...prev, callState: 'FAILED', lastErrorMessage: parseTwilioError(cancelledCall) };
            }
            return { ...prev, callState: 'CANCELLED' };
          });
          setTimeout(() => setState((prev: TelephonyState) => (prev.callState === 'FAILED' ? prev : { ...prev, callState: 'IDLE', isDrawerOpen: false, durationSeconds: 0 })), 3000);
        });

        call.on('reject', () => {
          activeCallRef.current = null;
          setState((prev: TelephonyState) => ({ ...prev, callState: 'BUSY' }));
          setTimeout(() => setState((prev: TelephonyState) => ({ ...prev, callState: 'IDLE', isDrawerOpen: false, durationSeconds: 0 })), 3000);
        });
      }
    } catch (error: any) {
      console.error('WebRTC Error:', error);
      setState((prev: TelephonyState) => ({
        ...prev,
        callState: 'FAILED',
        lastErrorMessage: parseTwilioError(error),
      }));
    }
  };

  const hangUp = () => {
    isUserInitiatedHangupRef.current = true;
    if (activeCallRef.current) {
      if (state.activeProvider === 'telnyx' && typeof activeCallRef.current.hangup === 'function') {
        activeCallRef.current.hangup();
      } else if (typeof activeCallRef.current.disconnect === 'function') {
        activeCallRef.current.disconnect();
      }
      activeCallRef.current = null;
    } else if (deviceRef.current) {
      if (state.activeProvider === 'telnyx' && typeof deviceRef.current.disconnect === 'function') {
        deviceRef.current.disconnect();
      } else if (typeof deviceRef.current.destroy === 'function') {
        deviceRef.current.destroy();
      }
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
      if (state.activeProvider === 'telnyx') {
         if (state.isMuted) {
           activeCallRef.current.unmuteAudio();
         } else {
           activeCallRef.current.muteAudio();
         }
      } else {
        const currentMute = activeCallRef.current.isMuted();
        activeCallRef.current.mute(!currentMute);
      }
      setState((prev: TelephonyState) => ({
        ...prev,
        isMuted: !prev.isMuted,
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
  
  const setProvider = (provider: 'telnyx' | 'twilio') => {
    setState((prev: TelephonyState) => ({
      ...prev,
      activeProvider: provider,
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
    activeProvider: state.activeProvider,
    lastErrorMessage: state.lastErrorMessage,
    openDialer,
    dial,
    hangUp,
    toggleMute,
    toggleDrawer,
    setMockMode,
    setProvider,
    formatDuration,
    setState,
  };
};
