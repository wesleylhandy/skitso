'use client';

import type { ButtonHTMLAttributes, ReactNode, CSSProperties, FocusEvent } from 'react';
import { forwardRef } from 'react';
import { useVibe } from '@/src/lib/hooks/use-vibe';

type VibeButtonVariant = 'primary' | 'secondary' | 'ghost';

interface VibeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  labelKey?: string;
  variant?: VibeButtonVariant;
  isLoading?: boolean;
  children?: ReactNode;
}

export const VibeButton = forwardRef<HTMLButtonElement, VibeButtonProps>(
  (
    {
      labelKey,
      variant = 'primary',
      isLoading = false,
      children,
      className = '',
      disabled,
      ...buttonProps
    },
    ref
  ) => {
    const { visualTokens, getButtonLabel } = useVibe();

    const label =
      labelKey !== undefined
        ? getButtonLabel(labelKey)
        : (children as ReactNode);

    const baseStyle: CSSProperties = {
      padding: '0.75rem 1.5rem',
      borderRadius: visualTokens.borderRadius,
      fontFamily: visualTokens.bodyFont,
      fontWeight: 600,
      fontSize: '0.95rem',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      minHeight: 44,
      minWidth: 44,
      outlineOffset: 2,
      transition: 'background-color 150ms ease, color 150ms ease, transform 150ms ease, box-shadow 150ms ease',
    };

    let variantStyle: CSSProperties;

    switch (variant) {
      case 'secondary':
        variantStyle = {
          backgroundColor: 'transparent',
          color: visualTokens.primaryColor,
          border: `2px solid ${visualTokens.primaryColor}`,
        };
        break;
      case 'ghost':
        variantStyle = {
          backgroundColor: 'transparent',
          color: visualTokens.textColor,
          border: '1px solid transparent',
        };
        break;
      case 'primary':
      default:
        variantStyle = {
          backgroundColor: visualTokens.primaryColor,
          color: visualTokens.bgColor,
          border: '2px solid transparent',
        };
        break;
    }

    const finalDisabled = disabled || isLoading;

    return (
      <button
        {...buttonProps}
        ref={ref}
        type={buttonProps.type ?? 'button'}
        disabled={finalDisabled}
        className={className}
        style={{
          ...baseStyle,
          ...variantStyle,
          opacity: finalDisabled ? 0.6 : 1,
          pointerEvents: finalDisabled ? 'none' : 'auto',
        }}
        onFocus={(event: FocusEvent<HTMLButtonElement>) => {
          event.currentTarget.style.outline = `2px solid ${visualTokens.accentColor ?? visualTokens.primaryColor}`;
          event.currentTarget.style.outlineOffset = '2px';
          buttonProps.onFocus?.(event);
        }}
        onBlur={(event: FocusEvent<HTMLButtonElement>) => {
          event.currentTarget.style.outline = 'none';
          buttonProps.onBlur?.(event);
        }}
      >
        {isLoading ? getButtonLabel('submitLoading') : label}
      </button>
    );
  }
);

VibeButton.displayName = 'VibeButton';

