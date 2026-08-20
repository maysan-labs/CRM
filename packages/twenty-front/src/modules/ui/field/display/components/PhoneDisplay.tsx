import { parsePhoneNumber, type PhoneNumber } from 'libphonenumber-js';
import { type MouseEvent } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { styled } from '@linaria/react';
import { useTelephony } from '@/telephony/hooks/useTelephony';
import { useWhatsapp } from '@/whatsapp/hooks/useWhatsapp';

interface PhoneDisplayProps {
  value: PhoneDisplayValueProps;
}

type PhoneDisplayValueProps = {
  number: string | null | undefined;
  callingCode: string | null | undefined;
};

const StyledContainer = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const StyledPhoneButton = styled.button`
  background: transparent;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: all 0.15s ease-in-out;

  &:hover {
    color: #60a5fa;
    text-decoration-color: #60a5fa;
  }
`;

const StyledWhatsappButton = styled.button`
  background: rgba(37, 211, 102, 0.12);
  border: 1px solid rgba(37, 211, 102, 0.25);
  border-radius: 4px;
  color: #25d366;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 5px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: all 0.15s ease-in-out;

  &:hover {
    background: rgba(37, 211, 102, 0.22);
    border-color: #25d366;
    color: #ffffff;
  }
`;

export const PhoneDisplay = ({
  value: { number, callingCode },
}: PhoneDisplayProps) => {
  const { dial } = useTelephony();
  const { openChat } = useWhatsapp();

  if (!isDefined(number)) return null;

  const callingCodeSanitized = callingCode?.replace('+', '');

  let parsedPhoneNumber: PhoneNumber | null = null;

  try {
    parsedPhoneNumber = parsePhoneNumber(number, {
      defaultCallingCode: callingCodeSanitized || '1',
    });
  } catch (error) {
    if (!(error instanceof Error)) return null;
  }

  const formattedPhoneNumber = parsedPhoneNumber
    ? parsedPhoneNumber.formatInternational()
    : number;

  const targetNumber = parsedPhoneNumber ? parsedPhoneNumber.number : number;

  const handleDialClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    if (targetNumber) {
      dial(targetNumber);
    }
  };

  const handleWhatsappClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    if (targetNumber) {
      openChat(targetNumber);
    }
  };

  return (
    <StyledContainer>
      <StyledPhoneButton type="button" onClick={handleDialClick} title="Click to call">
        {formattedPhoneNumber}
      </StyledPhoneButton>
      <StyledWhatsappButton
        type="button"
        onClick={handleWhatsappClick}
        title="Chat on WhatsApp"
      >
        💬 WhatsApp
      </StyledWhatsappButton>
    </StyledContainer>
  );
};
