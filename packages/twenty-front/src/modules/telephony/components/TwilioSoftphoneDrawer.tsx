import { styled } from '@linaria/react';
import React, { useEffect, useState } from 'react';

import { useTelephony } from '@/telephony/hooks/useTelephony';

const StyledContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 330px;
  background: #1e1f23;
  border: 1px solid #33353d;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  color: #ffffff;
  font-family: Inter, system-ui, -apple-system, sans-serif;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.2s ease-in-out;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #282a30;
  border-bottom: 1px solid #33353d;
`;

const StyledTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #e1e3e8;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledStatusBadge = styled.span`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
`;

const StyledCloseButton = styled.button`
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 16px;
  cursor: pointer;
  &:hover {
    color: #ffffff;
  }
`;

const StyledBody = styled.div`
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StyledPhoneNumberInput = styled.input`
  width: 100%;
  background: #141518;
  border: 1px solid #33353d;
  border-radius: 8px;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  padding: 10px;
  margin-bottom: 12px;
  outline: none;
  &:focus {
    border-color: #3b82f6;
  }
`;

const StyledTimer = styled.div`
  font-size: 14px;
  color: #a1a5b7;
  margin-bottom: 14px;
`;

const StyledErrorBanner = styled.div`
  width: 100%;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  color: #fca5a5;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
`;

const StyledKeypadGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
  margin-bottom: 16px;
`;

const StyledKeypadButton = styled.button`
  background: #282a30;
  border: 1px solid #33353d;
  border-radius: 8px;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  padding: 12px;
  cursor: pointer;
  &:hover {
    background: #33353d;
  }
  &:active {
    transform: scale(0.96);
  }
`;

const StyledActionsRow = styled.div`
  display: flex;
  gap: 12px;
  width: 100%;
  justify-content: center;
`;

const StyledCallButton = styled.button`
  flex: 1;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  &:hover {
    opacity: 0.9;
  }
`;

const StyledMuteButton = styled.button`
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
`;

export const TwilioSoftphoneDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    callState,
    phoneNumber,
    contactName,
    durationSeconds,
    isMuted,
    lastErrorMessage,
    dial,
    hangUp,
    toggleMute,
    toggleDrawer,
    formatDuration,
    setState,
  } = useTelephony();

  const [inputNumber, setInputNumber] = useState(phoneNumber || '');

  useEffect(() => {
    if (phoneNumber) {
      setInputNumber(phoneNumber);
    }
  }, [phoneNumber]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (callState === 'CONNECTED') {
      intervalId = setInterval(() => {
        setState((prev) => ({
          ...prev,
          durationSeconds: prev.durationSeconds + 1,
        }));
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [callState, setState]);

  if (!isDrawerOpen) {
    return null;
  }

  const handleKeyClick = (char: string) => {
    setInputNumber((prev: string) => prev + char);
  };

  const handleDialClick = () => {
    if (callState === 'CONNECTED' || callState === 'DIALING') {
      hangUp();
    } else {
      const target = inputNumber || phoneNumber || '+1234567890';
      dial(target, contactName);
    }
  };

  const getStatusColor = () => {
    switch (callState) {
      case 'CONNECTED':
        return '#22c55e'; // Green (Connected)
      case 'DIALING':
        return '#eab308'; // Yellow (Ringing)
      case 'BUSY':
        return '#f97316'; // Amber Orange (Busy)
      case 'CANCELLED':
        return '#6b7280'; // Gray (Cancelled)
      case 'COMPLETED':
        return '#10b981'; // Emerald (Completed)
      case 'FAILED':
        return '#ef4444'; // Red (Failed)
      case 'NO_ANSWER':
        return '#3b82f6'; // Blue (No Answer)
      default:
        return '#9ca3af'; // Neutral Gray (Ready)
    }
  };

  const getStatusLabel = () => {
    switch (callState) {
      case 'DIALING':
        return 'Ringing...';
      case 'CONNECTED':
        return 'Connected';
      case 'BUSY':
        return 'Busy';
      case 'CANCELLED':
        return 'Cancelled';
      case 'COMPLETED':
        return 'Completed';
      case 'FAILED':
        return 'Failed';
      case 'NO_ANSWER':
        return 'No Answer';
      default:
        return 'Ready';
    }
  };

  const isCallActive = callState === 'CONNECTED' || callState === 'DIALING';

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledTitle>
          <StyledStatusBadge style={{ backgroundColor: getStatusColor() }} />
          Twilio Softphone ({getStatusLabel()})
        </StyledTitle>
        <StyledCloseButton onClick={toggleDrawer}>✕</StyledCloseButton>
      </StyledHeader>

      <StyledBody>
        <StyledPhoneNumberInput
          value={callState !== 'IDLE' ? phoneNumber : inputNumber}
          onChange={(e) => setInputNumber(e.target.value)}
          placeholder="+1 (555) 000-0000"
          disabled={callState !== 'IDLE'}
        />

        {callState === 'CONNECTED' && (
          <StyledTimer>Call Duration: {formatDuration(durationSeconds)}</StyledTimer>
        )}

        {callState === 'DIALING' && (
          <StyledTimer style={{ color: '#eab308' }}>🔔 Dialing recipient...</StyledTimer>
        )}

        {callState === 'BUSY' && (
          <StyledErrorBanner style={{ borderColor: '#f97316', color: '#fdba74' }}>
            ⚠️ Line is currently busy (Busy)
          </StyledErrorBanner>
        )}

        {callState === 'CANCELLED' && (
          <StyledTimer style={{ color: '#9ca3af' }}>⏹️ Call cancelled before pickup</StyledTimer>
        )}

        {callState === 'COMPLETED' && (
          <StyledTimer style={{ color: '#10b981' }}>✅ Call completed</StyledTimer>
        )}

        {callState === 'NO_ANSWER' && (
          <StyledTimer style={{ color: '#3b82f6' }}>📞 No answer from recipient</StyledTimer>
        )}

        {callState === 'FAILED' && (
          <StyledErrorBanner>
            ⚠️ Call Failed: {lastErrorMessage || 'Check number format or permissions'}
          </StyledErrorBanner>
        )}

        {callState === 'IDLE' && (
          <StyledKeypadGrid>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
              <StyledKeypadButton key={key} onClick={() => handleKeyClick(key)}>
                {key}
              </StyledKeypadButton>
            ))}
          </StyledKeypadGrid>
        )}

        <StyledActionsRow>
          {callState === 'CONNECTED' && (
            <StyledMuteButton
              style={{ backgroundColor: isMuted ? '#ef4444' : '#374151' }}
              onClick={toggleMute}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </StyledMuteButton>
          )}

          <StyledCallButton
            style={{ backgroundColor: isCallActive ? '#ef4444' : '#22c55e' }}
            onClick={handleDialClick}
          >
            {isCallActive ? 'End Call' : 'Call'}
          </StyledCallButton>
        </StyledActionsRow>
      </StyledBody>
    </StyledContainer>
  );
};
