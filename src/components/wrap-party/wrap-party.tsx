/**
 * Wrap Party Component
 * 
 * Main component for the wrap party screen after performance completion.
 * Displays voting interface and social sharing options.
 */

'use client';

import { useAtomValue } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';
import { VotingInterface } from './voting-interface';
import { SocialShare } from './social-share';

interface WrapPartyProps {
  sessionCode?: string;
}

/**
 * WrapParty Component
 * 
 * Main wrap party screen with voting and sharing.
 */
export function WrapParty({ sessionCode: propSessionCode }: WrapPartyProps) {
  const { visualTokens, getSectionTitle } = useVibe();
  const atomSessionCode = useAtomValue(sessionCodeAtom);
  const wrapPartyData = useAtomValue(wrapPartyDataAtom);
  
  const sessionCode = propSessionCode || atomSessionCode;

  return (
    <div 
      className="wrap-party"
      style={{
        minHeight: '100vh',
        background: visualTokens.bgColor,
        color: visualTokens.primaryColor,
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h1 
            style={{
              fontFamily: visualTokens.headerFont,
              fontSize: '3rem',
              marginBottom: '1rem',
            }}
          >
            {getSectionTitle('wrapParty')}
          </h1>
          <p style={{ fontFamily: visualTokens.bodyFont, fontSize: '1.2rem' }}>
            Performance Complete! Vote and share your experience.
          </p>
        </header>

        <main>
          <VotingInterface />
          
          {wrapPartyData && (
            <div style={{ marginTop: '3rem' }}>
              <SocialShare sessionCode={sessionCode || ''} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
