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
  const { visualTokens } = useVibe();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && character) {
      dialog.showModal();
    } else {
      dialog.close();
    }
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
      className="w-full max-w-4xl max-h-[90vh] rounded-lg p-0 m-auto"
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
        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto" style={{ color: visualTokens.textColor }}>
          <CharacterDossier character={character} onBack={onClose} />
        </div>
      </div>
    </dialog>
  );
}
