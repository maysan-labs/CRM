import { styled } from '@linaria/react';
import React, { useEffect, useRef, useState } from 'react';

import { useWhatsapp } from '@/whatsapp/hooks/useWhatsapp';

const StyledContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 370px;
  width: 360px;
  height: 520px;
  background: #14161a;
  border: 1px solid #2d3139;
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  color: #e1e3e8;
  font-family: Inter, system-ui, -apple-system, sans-serif;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 768px) {
    right: 10px;
    left: 10px;
    width: auto;
    bottom: 10px;
    height: 80vh;
  }
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #1c1f26;
  border-bottom: 1px solid #2d3139;
`;

const StyledHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const StyledIconWrapper = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(37, 211, 102, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #25d366;
`;

const StyledHeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledTitle = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #f3f4f6;
`;

const StyledSubtitle = styled.span`
  font-size: 11px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StyledStatusDot = styled.span<{ status: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ status }) =>
    status === 'CONNECTED'
      ? '#25D366'
      : status === 'QR_READY' || status === 'CONNECTING'
        ? '#f59e0b'
        : '#ef4444'};
  box-shadow: 0 0 6px
    ${({ status }) =>
      status === 'CONNECTED'
        ? 'rgba(37, 211, 102, 0.6)'
        : status === 'QR_READY'
          ? 'rgba(245, 158, 11, 0.6)'
          : 'rgba(239, 68, 68, 0.6)'};
`;

const StyledHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StyledIconButton = styled.button`
  background: transparent;
  border: none;
  color: #9ca3af;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }
`;

const StyledBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0f1115;
`;

const StyledMessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: #2d3139;
    border-radius: 3px;
  }
`;

const StyledMessageBubble = styled.div<{ sender: 'me' | 'contact' }>`
  align-self: ${({ sender }) => (sender === 'me' ? 'flex-end' : 'flex-start')};
  max-width: 80%;
  padding: 8px 12px;
  border-radius: ${({ sender }) =>
    sender === 'me' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};
  background: ${({ sender }) => (sender === 'me' ? '#005c4b' : '#1f242d')};
  color: #f3f4f6;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const StyledMessageMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
`;

const StyledEmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 24px;
  color: #6b7280;
`;

const StyledTemplateChips = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  width: 100%;
`;

const StyledChip = styled.button`
  background: #1a1d24;
  border: 1px solid #2d3139;
  border-radius: 8px;
  color: #9ca3af;
  font-size: 11px;
  padding: 6px 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #252932;
    border-color: #3b82f6;
    color: #e1e3e8;
  }
`;

const StyledFooter = styled.div`
  padding: 12px;
  background: #1c1f26;
  border-top: 1px solid #2d3139;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledInput = styled.input`
  flex: 1;
  background: #121418;
  border: 1px solid #2d3139;
  border-radius: 20px;
  padding: 8px 14px;
  color: #ffffff;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;

  &:focus {
    border-color: #25d366;
  }

  &::placeholder {
    color: #6b7280;
  }
`;

const StyledSendButton = styled.button`
  background: #25d366;
  border: none;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0c1a10;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.1s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    background: #20ba59;
    transform: scale(1.05);
  }

  &:disabled {
    background: #2d3139;
    color: #6b7280;
    cursor: not-allowed;
  }
`;

const StyledQRContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  text-align: center;
  gap: 12px;
  height: 100%;
`;

const StyledQRImage = styled.img`
  width: 190px;
  height: 190px;
  border-radius: 8px;
  border: 4px solid #ffffff;
  background: #ffffff;
`;

export const WhatsappDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    phoneNumber,
    contactName,
    connectionStatus,
    qrCode,
    phoneConnected,
    messages,
    isSending,
    errorMessage,
    closeChat,
    sendMessage,
    fetchStatus,
  } = useWhatsapp();

  const [inputVal, setInputVal] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDrawerOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isDrawerOpen]);

  if (!isDrawerOpen) return null;

  const handleSend = () => {
    if (!inputVal.trim() || isSending) return;
    sendMessage(inputVal);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledHeaderLeft>
          <StyledIconWrapper>💬</StyledIconWrapper>
          <StyledHeaderInfo>
            <StyledTitle>{contactName || 'WhatsApp Chat'}</StyledTitle>
            <StyledSubtitle>
              <StyledStatusDot status={connectionStatus} />
              {connectionStatus === 'CONNECTED'
                ? phoneConnected
                  ? `Linked: ${phoneConnected}`
                  : 'Connected'
                : connectionStatus === 'QR_READY'
                  ? 'Pairing Required'
                  : connectionStatus}
              {phoneNumber && ` • ${phoneNumber}`}
            </StyledSubtitle>
          </StyledHeaderInfo>
        </StyledHeaderLeft>

        <StyledHeaderActions>
          <StyledIconButton onClick={fetchStatus} title="Refresh connection">
            🔄
          </StyledIconButton>
          <StyledIconButton onClick={closeChat} title="Close">
            ✕
          </StyledIconButton>
        </StyledHeaderActions>
      </StyledHeader>

      <StyledBody>
        {connectionStatus === 'QR_READY' && qrCode ? (
          <StyledQRContainer>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f3f4f6' }}>
              Pair WhatsApp to CRM
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              1. Open WhatsApp on your phone
              <br />
              2. Go to <b>Settings &gt; Linked Devices</b>
              <br />
              3. Scan this QR Code
            </span>
            <StyledQRImage
              src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="Scan WhatsApp QR"
            />
            <StyledIconButton
              onClick={fetchStatus}
              style={{
                background: '#1f242d',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            >
              🔄 Refresh QR Code
            </StyledIconButton>
          </StyledQRContainer>
        ) : (
          <>
            <StyledMessagesContainer>
              {messages.length === 0 ? (
                <StyledEmptyState>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>💬</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#d1d5db' }}>
                    Start conversation with {contactName || phoneNumber}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    Messages sent here are delivered instantly via Evolution Go.
                  </div>

                  <StyledTemplateChips>
                    <StyledChip
                      onClick={() =>
                        sendMessage(`Hi ${contactName || ''}, following up on our recent discussion.`)
                      }
                    >
                      💡 "Hi, following up on our recent discussion."
                    </StyledChip>
                    <StyledChip
                      onClick={() =>
                        sendMessage(
                          `Hello! Are you available for a brief call regarding your inquiry?`,
                        )
                      }
                    >
                      💡 "Are you available for a brief call?"
                    </StyledChip>
                  </StyledTemplateChips>
                </StyledEmptyState>
              ) : (
                messages.map((msg) => (
                  <StyledMessageBubble key={msg.id} sender={msg.sender}>
                    {msg.text}
                    <StyledMessageMeta>
                      <span>{msg.timestamp}</span>
                      {msg.sender === 'me' && (
                        <span>
                          {msg.status === 'pending'
                            ? '⏳'
                            : msg.status === 'read'
                              ? '✓✓'
                              : '✓'}
                        </span>
                      )}
                    </StyledMessageMeta>
                  </StyledMessageBubble>
                ))
              )}
              <div ref={messagesEndRef} />
            </StyledMessagesContainer>

            {errorMessage && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  padding: '6px 12px',
                  fontSize: '11px',
                  borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                ⚠️ {errorMessage}
              </div>
            )}

            <StyledFooter>
              <StyledInput
                type="text"
                placeholder={phoneNumber ? 'Type a WhatsApp message...' : 'No phone number selected'}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!phoneNumber}
              />
              <StyledSendButton
                onClick={handleSend}
                disabled={!inputVal.trim() || isSending || !phoneNumber}
                title="Send message"
              >
                ➤
              </StyledSendButton>
            </StyledFooter>
          </>
        )}
      </StyledBody>
    </StyledContainer>
  );
};
