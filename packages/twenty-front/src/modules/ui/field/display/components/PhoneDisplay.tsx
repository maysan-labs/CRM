import { parsePhoneNumber, type PhoneNumber } from 'libphonenumber-js';
import { type MouseEvent } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { styled } from '@linaria/react';
import { useTelephony } from '@/telephony/hooks/useTelephony';

interface PhoneDisplayProps {
  value: PhoneDisplayValueProps;
}

type PhoneDisplayValueProps = {
  number: string | null | undefined;
  callingCode: string | null | undefined;
};

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

export const PhoneDisplay = ({
  value: { number, callingCode },
}: PhoneDisplayProps) => {
  const { dial } = useTelephony();

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

  const handleDialClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    const targetNumber = parsedPhoneNumber ? parsedPhoneNumber.number : number;
    if (targetNumber) {
      dial(targetNumber);
    }
  };

  return (
    <StyledPhoneButton type="button" onClick={handleDialClick}>
      {formattedPhoneNumber}
    </StyledPhoneButton>
  );
};
