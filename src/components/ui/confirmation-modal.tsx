/**
 * Confirmation Modal Component
 * 
 * A reusable confirmation dialog modal that matches the app's vibe system.
 * Replaces browser confirm() prompts with a styled modal.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useVibe } from '@/src/lib/hooks/use-vibe';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

/**
 * ConfirmationModal Component
 * 
 * Modal dialog for user confirmations. Uses native <dialog> element
 * with vibe-aware styling.
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: ConfirmationModalProps) {
  const { visualTokens, getButtonLabel } = useVibe();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Handle dialog open/close and body scroll lock
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      // Lock body scroll when modal is open
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Close if clicking the backdrop (not the content)
    if (e.target === dialog) {
      onClose();
    }
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  // Add backdrop styling (only once)
  useEffect(() => {
    const existingStyle = document.getElementById('dialog-backdrop-style');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'dialog-backdrop-style';
    style.textContent = `
      dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (!isOpen) {
    return null;
  }

  const confirmButtonStyle =
    variant === 'danger'
      ? {
          backgroundColor: 'var(--color-error, #ef4444)',
          color: 'var(--color-bg)',
        }
      : {
          backgroundColor: visualTokens.primaryColor,
          color: visualTokens.bgColor,
        };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-full max-w-md rounded-lg p-0 m-auto overflow-hidden"
      style={{
        backgroundColor: visualTokens.bgColor,
        color: visualTokens.textColor,
        borderColor: visualTokens.primaryColor,
        borderWidth: '2px',
        borderStyle: 'solid',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        margin: 0,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: visualTokens.primaryColor }}>
          <h2
            className="text-2xl font-bold"
            style={{
              color: visualTokens.primaryColor,
              fontFamily: visualTokens.headerFont,
            }}
          >
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <p
            className="text-base leading-relaxed"
            style={{
              color: visualTokens.textColor,
              fontFamily: visualTokens.bodyFont,
            }}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div
          className="flex gap-3 p-6 border-t justify-end"
          style={{ borderColor: visualTokens.primaryColor }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded font-semibold transition-opacity hover:opacity-90"
            style={{
              borderColor: visualTokens.primaryColor,
              color: visualTokens.primaryColor,
              backgroundColor: 'transparent',
              borderWidth: '1px',
              borderStyle: 'solid',
              fontFamily: visualTokens.headerFont,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 rounded font-semibold transition-opacity hover:opacity-90"
            style={{
              ...confirmButtonStyle,
              fontFamily: visualTokens.headerFont,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
