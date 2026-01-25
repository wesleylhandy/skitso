/**
 * Character Dossier Modal Component
 * 
 * Modal wrapper for CharacterDossier to allow Directors to view
 * full character information including hidden motivations for assignment decisions.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { CharacterDossier } from '@/src/components/actor/character-dossier';
import type { Character } from '@/src/state/types/session';

interface CharacterDossierModalProps {
  character: Character | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CharacterDossierModal Component
 * 
 * Modal dialog for viewing character dossiers. Directors can see
 * hidden motivations to help with assignment decisions.
 */
export function CharacterDossierModal({ character, isOpen, onClose }: CharacterDossierModalProps) {
  const { visualTokens, getSectionTitle } = useVibe();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Handle dialog open/close and body scroll lock
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && character) {
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
  }, [isOpen, character]);

  // Prevent scroll propagation to background
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen || !character) return;

    const scrollableContent = dialog.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
    if (!scrollableContent) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollableContent;
      const isAtTop = scrollTop === 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // Prevent scroll propagation if not at boundaries
      if (!isAtTop && !isAtBottom) {
        e.stopPropagation();
      } else if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        // At boundary and trying to scroll further - prevent background scroll
        e.preventDefault();
        e.stopPropagation();
      }
    };

    scrollableContent.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      scrollableContent.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen, character]);

  // Handle ESC key and backdrop click
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

  if (!character) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-full max-w-4xl max-h-[90vh] rounded-lg p-0 m-auto overflow-hidden"
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
      <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
        {/* Fixed Header with Close Button */}
        <div 
          className="flex justify-between items-center p-6 border-b shrink-0" 
          style={{ borderColor: visualTokens.primaryColor }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 
            className="text-2xl font-bold" 
            style={{ color: visualTokens.primaryColor }}
          >
            {getSectionTitle('characterDossier')}
          </h2>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-semibold transition-opacity hover:opacity-90 cursor-pointer"
            style={{
              backgroundColor: visualTokens.primaryColor,
              color: visualTokens.bgColor,
              pointerEvents: 'auto',
            }}
          >
            Close
          </button>
        </div>
        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ color: visualTokens.textColor }}>
          <CharacterDossier character={character} onBack={onClose} />
        </div>
      </div>
    </dialog>
  );
}
