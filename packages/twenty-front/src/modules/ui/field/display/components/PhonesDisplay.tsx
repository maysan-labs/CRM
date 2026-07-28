import { t } from '@lingui/core/macro';
import React, { useMemo } from 'react';

import { type FieldPhonesValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { ExpandableList } from '@/ui/layout/expandable-list/components/ExpandableList';
import { useTelephony } from '@/telephony/hooks/useTelephony';

import { styled } from '@linaria/react';
import { parsePhoneNumber } from 'libphonenumber-js';
import { isDefined } from 'twenty-shared/utils';
import { logError } from '~/utils/logError';

type PhonesDisplayProps = {
  value?: FieldPhonesValue;
  isFocused?: boolean;
  onPhoneNumberClick?: (
    phoneNumber: string,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
};

const StyledContainer = styled.div`
  align-items: center;
  display: flex;
  gap: 4px;
  justify-content: flex-start;
  max-width: 100%;
  overflow: hidden;
  width: 100%;
`;

const StyledPhoneButton = styled.button`
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #e1e3e8;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease-in-out;
  outline: none;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.24);
    color: #ffffff;
  }
`;

export const PhonesDisplay = ({
  value,
  isFocused,
  onPhoneNumberClick,
}: PhonesDisplayProps) => {
  const { openDialer } = useTelephony();

  const phones = useMemo(
    () =>
      [
        value?.primaryPhoneNumber
          ? {
              number: value.primaryPhoneNumber,
              callingCode:
                value.primaryPhoneCallingCode ||
                value.primaryPhoneCountryCode ||
                '',
            }
          : null,
        ...parseAdditionalPhones(value?.additionalPhones),
      ]
        .filter(isDefined)
        .map(({ number, callingCode }) => {
          return {
            number,
            callingCode,
          };
        }),
    [
      value?.primaryPhoneNumber,
      value?.primaryPhoneCallingCode,
      value?.primaryPhoneCountryCode,
      value?.additionalPhones,
    ],
  );

  const parsePhoneNumberOrReturnInvalidValue = (number: string) => {
    try {
      return { parsedPhone: parsePhoneNumber(number) };
    } catch {
      return { invalidPhone: number };
    }
  };

  const handlePhoneClick = (
    phoneNum: string,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    if (onPhoneNumberClick) {
      onPhoneNumberClick(phoneNum, event);
    } else {
      openDialer(phoneNum);
    }
  };

  return isFocused ? (
    <ExpandableList isChipCountDisplayed>
      {phones.map(({ number, callingCode }, index) => {
        const fullNumber = callingCode + number;
        const { parsedPhone, invalidPhone } =
          parsePhoneNumberOrReturnInvalidValue(fullNumber);
        const label = parsedPhone ? parsedPhone.formatInternational() : invalidPhone;
        return (
          <StyledPhoneButton
            key={index}
            type="button"
            onClick={(event) => handlePhoneClick(fullNumber, event)}
          >
            📞 {label}
          </StyledPhoneButton>
        );
      })}
    </ExpandableList>
  ) : (
    <StyledContainer>
      {phones.map(({ number, callingCode }, index) => {
        const fullNumber = callingCode + number;
        const { parsedPhone, invalidPhone } =
          parsePhoneNumberOrReturnInvalidValue(fullNumber);
        const label = parsedPhone ? parsedPhone.formatInternational() : invalidPhone;
        return (
          <StyledPhoneButton
            key={index}
            type="button"
            onClick={(event) => handlePhoneClick(fullNumber, event)}
          >
            📞 {label}
          </StyledPhoneButton>
        );
      })}
    </StyledContainer>
  );
};

const parseAdditionalPhones = (additionalPhones?: any) => {
  if (!additionalPhones) {
    return [];
  }

  if (typeof additionalPhones === 'object') {
    return additionalPhones;
  }

  if (typeof additionalPhones === 'string') {
    try {
      return JSON.parse(additionalPhones);
    } catch (error) {
      logError(t`Error parsing additional phones: ${String(error)}`);
    }
  }

  return [];
};
