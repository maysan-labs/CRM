import { useRef } from 'react';

import {
  telephonyState,
  type TelephonyState,
} from '@/telephony/states/telephonyState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

// Helper to normalize and sanitize phone numbers to E.164 format
export const normalizePhoneNumber = (raw: string): string => {
  if (!raw) return '';
  // Remove spaces, parentheses, hyphens, and periods
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');

  // If already starts with +
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If 11 digits starting with 0 followed by 6-9 (Standard Indian notation e.g. 09876543210)
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }

  // If 10 digits starting with 6, 7, 8, 9 (Standard Indian mobile numbers)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If 10 digits starting with 2-5 (US / North American numbers)
  if (/^\d{10}$/.test(cleaned)) {
    return `+1${cleaned}`;
  }

  // Fallback: ensure + prefix
  return `+${cleaned}`;
};

// Helper to translate raw Twilio / Telnyx / WebRTC error codes into clear human-readable explanations
export const parseTelephonyError = (error: any): string => {
  if (!error) return 'Call ended';

  // If error is a DOM Event (e.g. script or media error)
  if (typeof Event !== 'undefined' && error instanceof Event) {
    return 'Browser audio / media device error. Please ensure microphone access is permitted in your browser.';
  }

  // Handle Twilio Call object passed directly (extract from call.errors)
  if (Array.isArray(error?.errors) && error.errors.length > 0) {
    return parseTelephonyError(error.errors[0]);
  }

  let code = typeof error.code === 'function' ? error.code() : error.code;
  let status = typeof error.status === 'function' ? error.status() : error.status;
  let rawMessage =
    error.message ||
    error.explanation ||
    error.description ||
    error.cause ||
    error.reason ||
    (typeof error === 'string' ? error : '');
  let message = typeof rawMessage === 'function' ? rawMessage() : rawMessage;
  message = (message || '').toString();

  const errCode = code || (typeof status === 'number' ? status : undefined);

  // Twilio Error Codes
  if (errCode === 21215 || message.includes('21215') || message.toLowerCase().includes('geo')) {
    return 'Geo-Permissions Blocked: Destination country (e.g. India) is disabled in Twilio Console -> Voice -> Settings -> Geo Permissions.';
  }
  if (errCode === 13225 || message.includes('13225') || message.toLowerCase().includes('blacklist')) {
    return 'Carrier restriction or international dialing profile pending approval (Twilio Error 13225).';
  }
  if (errCode === 21210 || errCode === 21606 || message.includes('21210') || message.includes('21606')) {
    return 'Twilio Trial Account: Destination or Caller ID number is not verified in Twilio Console.';
  }
  if (errCode === 21212 || message.includes('21212')) {
    return 'Invalid Caller ID: Please configure a valid TWILIO_PHONE_NUMBER in server environment.';
  }
  if (
    errCode === 31005 ||
    errCode === 31000 ||
    message.toLowerCase().includes('permission') ||
    message.toLowerCase().includes('microphone') ||
    message.toLowerCase().includes('getusermedia')
  ) {
    return 'Microphone permission denied: Please allow browser microphone access.';
  }
  if (errCode === 31205 || errCode === 20101) {
    return 'Authentication token expired or invalid VoIP credentials.';
  }
  if (errCode === 31002 || errCode === 31003 || message.toLowerCase().includes('timeout')) {
    return 'Network connection timeout: Unable to reach VoIP gateway.';
  }
  if (errCode === 11200 || errCode === 21205) {
    return 'TwiML Webhook Error: Twilio could not reach backend voice webhook URL.';
  }

  // Telnyx Causes / Error Codes
  if (message.includes('USER_BUSY') || message.includes('486')) {
    return 'Recipient line is busy.';
  }
  if (message.includes('NO_ANSWER') || message.includes('480')) {
    return 'No answer from recipient.';
  }
  if (message.includes('CALL_REJECTED') || message.includes('603')) {
    return 'Call was rejected by carrier or recipient.';
  }
  if (
    message.includes('INCOMPATIBLE_DESTINATION') ||
    message.includes('UNALLOCATED_NUMBER') ||
    message.includes('404')
  ) {
    return 'Destination phone number is unreachable or invalid.';
  }
  if (message.includes('ORIGINATOR_CANCEL')) {
    return 'Call cancelled.';
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

  return 'Call ended (Check destination number format with +country code and VoIP permissions)';
};

// Helper to get Twilio Voice WebRTC Device class safely
const getTwilioVoiceDeviceClass = async (): Promise<any> => {
  try {
    // @ts-ignore
    const mod = await import('@twilio/voice-sdk');
    return mod.Device || (mod as any).default?.Device || (window as any).Twilio?.Device;
  } catch {
    if ((window as any).Twilio?.Device) {
      return (window as any).Twilio.Device;
    }
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
      script.onerror = () => reject(new Error('Failed to load Twilio Voice SDK script from CDN'));
      document.head.appendChild(script);
    });
  }
};

// Helper to get Telnyx WebRTC Device class safely
const getTelnyxVoiceDeviceClass = async (): Promise<any> => {
  try {
    // @ts-ignore
    const mod = await import('@telnyx/webrtc');
    return mod.TelnyxRTC || (mod as any).default?.TelnyxRTC || (window as any).TelnyxRTC || (window as any).Telnyx?.TelnyxRTC;
  } catch {
    if ((window as any).TelnyxRTC || (window as any).Telnyx?.TelnyxRTC) {
      return (window as any).TelnyxRTC || (window as any).Telnyx?.TelnyxRTC;
    }
    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('telnyx-webrtc-sdk');
      if (existingScript) {
        existingScript.addEventListener('load', () =>
          resolve((window as any).TelnyxRTC || (window as any).Telnyx?.TelnyxRTC),
        );
        return;
      }
      const script = document.createElement('script');
      script.id = 'telnyx-webrtc-sdk';
      script.src = 'https://unpkg.com/@telnyx/webrtc@2.6.2/dist/telnyx-webrtc.umd.js';
      script.async = true;
      script.onload = () =>
        resolve((window as any).TelnyxRTC || (window as any).Telnyx?.TelnyxRTC);
      script.onerror = () => reject(new Error('Failed to load Telnyx WebRTC SDK script from CDN'));
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
    const targetNumber = normalizePhoneNumber(phoneNumber);

    setState((prev: TelephonyState) => ({
      ...prev,
      isDrawerOpen: true,
      callState: 'DIALING',
      phoneNumber: targetNumber,
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
      // Request audio permission proactively to ensure microphone is ready
      try {
        if (navigator?.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop the temporary stream tracks immediately
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (micErr: any) {
        console.warn('Microphone permission warning:', micErr);
        setState((prev: TelephonyState) => ({
          ...prev,
          callState: 'FAILED',
          lastErrorMessage: 'Microphone permission denied. Please allow microphone access in your browser.',
        }));
        return;
      }

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

      const handleError = (error: any) => {
        console.error(`${provider} Error Event:`, error);
        const parsed = parseTelephonyError(error);
        setState((prev: TelephonyState) => ({
          ...prev,
          callState: 'FAILED',
          lastErrorMessage: parsed,
        }));
      };

      if (provider === 'telnyx') {
        const TelnyxRTCClass = await getTelnyxVoiceDeviceClass();
        if (!TelnyxRTCClass) throw new Error('Telnyx SDK could not be loaded');

        const client = new TelnyxRTCClass({
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
            destinationNumber: targetNumber,
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
            } else if (call.state === 'ringing' || call.state === 'early') {
              setState((prev: TelephonyState) => ({ ...prev, callState: 'DIALING' }));
            } else if (call.state === 'hangup' || call.state === 'destroy') {
              const cause = call.cause || 'Unknown';
              console.log('Telnyx Call Ended Reason:', cause);
              activeCallRef.current = null;
              setState((prev: TelephonyState) => {
                if (prev.callState === 'FAILED') return prev;
                if (!isUserInitiatedHangupRef.current && prev.durationSeconds === 0) {
                  const errorMsg = parseTelephonyError({ cause });
                  return { ...prev, callState: 'FAILED', lastErrorMessage: errorMsg };
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

        const device = new DeviceClass(data.token, {
          codecPreferences: ['opus', 'pcmu'],
          enableRingingState: true,
        });
        deviceRef.current = device;
        device.on('error', handleError);

        const call = await device.connect({ params: { To: targetNumber } });
        activeCallRef.current = call;

        call.on('ringing', () => {
          setState((prev: TelephonyState) => ({ ...prev, callState: 'DIALING' }));
        });

        call.on('accept', () => {
          setState((prev: TelephonyState) => ({ ...prev, callState: 'CONNECTED' }));
        });

        call.on('error', handleError);

        call.on('disconnect', (disconnectedCall: any) => {
          activeCallRef.current = null;
          const callErrors = disconnectedCall?.errors;
          const err = Array.isArray(callErrors) && callErrors.length > 0 ? callErrors[0] : null;

          setState((prev: TelephonyState) => {
            if (prev.callState === 'FAILED') return prev;
            if (!isUserInitiatedHangupRef.current && prev.durationSeconds === 0) {
              const errorMsg = err ? parseTelephonyError(err) : parseTelephonyError(disconnectedCall);
              return { ...prev, callState: 'FAILED', lastErrorMessage: errorMsg };
            }
            return { ...prev, callState: prev.durationSeconds > 0 ? 'COMPLETED' : 'CANCELLED' };
          });
          setTimeout(
            () =>
              setState((prev: TelephonyState) =>
                prev.callState === 'FAILED'
                  ? prev
                  : { ...prev, callState: 'IDLE', isDrawerOpen: false, durationSeconds: 0 },
              ),
            3000,
          );
        });

        call.on('cancel', (cancelledCall: any) => {
          activeCallRef.current = null;
          const callErrors = cancelledCall?.errors;
          const err = Array.isArray(callErrors) && callErrors.length > 0 ? callErrors[0] : null;

          setState((prev: TelephonyState) => {
            if (prev.callState === 'FAILED') return prev;
            if (!isUserInitiatedHangupRef.current) {
              const errorMsg = err ? parseTelephonyError(err) : parseTelephonyError(cancelledCall);
              return { ...prev, callState: 'FAILED', lastErrorMessage: errorMsg };
            }
            return { ...prev, callState: 'CANCELLED' };
          });
          setTimeout(
            () =>
              setState((prev: TelephonyState) =>
                prev.callState === 'FAILED'
                  ? prev
                  : { ...prev, callState: 'IDLE', isDrawerOpen: false, durationSeconds: 0 },
              ),
            3000,
          );
        });

        call.on('reject', () => {
          activeCallRef.current = null;
          setState((prev: TelephonyState) => ({ ...prev, callState: 'BUSY' }));
          setTimeout(
            () =>
              setState((prev: TelephonyState) => ({
                ...prev,
                callState: 'IDLE',
                isDrawerOpen: false,
                durationSeconds: 0,
              })),
            3000,
          );
        });
      }
    } catch (error: any) {
      console.error('WebRTC Error:', error);
      setState((prev: TelephonyState) => ({
        ...prev,
        callState: 'FAILED',
        lastErrorMessage: parseTelephonyError(error),
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
