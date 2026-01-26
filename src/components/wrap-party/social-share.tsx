/**
 * Social Share Component
 * 
 * Provides social media sharing links for Twitter, Instagram, and TikTok.
 */

'use client';

import { useAtomValue } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';
import { generateShareableLink } from '@/src/lib/utils/session-code';

interface SocialShareProps {
  sessionCode?: string;
}

/**
 * SocialShare Component
 * 
 * Displays social media sharing buttons.
 */
export function SocialShare({ sessionCode: propSessionCode }: SocialShareProps) {
  const { visualTokens, getButtonLabel } = useVibe();
  const atomSessionCode = useAtomValue(sessionCodeAtom);
  const wrapPartyData = useAtomValue(wrapPartyDataAtom);
  
  const sessionCode = propSessionCode || atomSessionCode;

  if (!sessionCode) {
    return null;
  }

  const shareUrl = generateShareableLink(sessionCode);
  const shareText = 'Check out this amazing performance on Skitso!';
  const encodedShareText = encodeURIComponent(shareText);

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodeURIComponent(shareUrl)}`,
    instagram: `https://www.instagram.com/`, // Instagram doesn't support direct link sharing
    tiktok: `https://www.tiktok.com/upload?lang=en`, // TikTok requires upload, not link sharing
  };

  // Check if Web Share API is available (mobile devices)
  const canUseNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const handleNativeShare = async () => {
    if (!canUseNativeShare) return;

    try {
      await navigator.share({
        title: 'Skitso Performance',
        text: shareText,
        url: shareUrl,
      });
    } catch (error) {
      // User cancelled or share failed - ignore silently
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  };

  const handleShare = async (platform: 'twitter' | 'instagram' | 'tiktok') => {
    if (platform === 'twitter') {
      window.open(shareLinks.twitter, '_blank', 'width=550,height=420');
    } else if (platform === 'instagram') {
      // Instagram requires manual sharing
      alert('Copy the link and share it on Instagram!');
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } else if (platform === 'tiktok') {
      // TikTok requires manual sharing
      alert('Copy the link and share it on TikTok!');
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    }

    // Track shared link
    if (wrapPartyData) {
      // This would be handled by the parent component or via socket
      // For now, we'll just open the share dialog
    }
  };

  return (
    <section 
      className="social-share"
      style={{
        marginTop: '2rem',
        padding: '2rem',
        border: `2px solid ${visualTokens.primaryColor}`,
        borderRadius: visualTokens.borderRadius,
      }}
    >
      <h3 
        style={{
          fontFamily: visualTokens.headerFont,
          marginBottom: '1.5rem',
        }}
      >
        Share the Performance
      </h3>
      
      <div 
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        {canUseNativeShare && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNativeShare();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNativeShare();
            }}
            style={{
              background: visualTokens.primaryColor,
              color: visualTokens.bgColor,
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: visualTokens.borderRadius,
              cursor: 'pointer',
              fontFamily: visualTokens.bodyFont,
              fontSize: '1rem',
              minWidth: '44px',
              minHeight: '44px',
              touchAction: 'manipulation',
            }}
          >
            {getButtonLabel('share')}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleShare('twitter');
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleShare('twitter');
          }}
          style={{
            background: visualTokens.primaryColor,
            color: visualTokens.bgColor,
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: visualTokens.borderRadius,
            cursor: 'pointer',
            fontFamily: visualTokens.bodyFont,
            fontSize: '1rem',
            minWidth: '44px',
            minHeight: '44px',
            touchAction: 'manipulation',
          }}
        >
          {getButtonLabel('share')} on Twitter
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleShare('instagram');
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleShare('instagram');
          }}
          style={{
            background: visualTokens.primaryColor,
            color: visualTokens.bgColor,
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: visualTokens.borderRadius,
            cursor: 'pointer',
            fontFamily: visualTokens.bodyFont,
            fontSize: '1rem',
            minWidth: '44px',
            minHeight: '44px',
            touchAction: 'manipulation',
          }}
        >
          {getButtonLabel('share')} on Instagram
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleShare('tiktok');
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleShare('tiktok');
          }}
          style={{
            background: visualTokens.primaryColor,
            color: visualTokens.bgColor,
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: visualTokens.borderRadius,
            cursor: 'pointer',
            fontFamily: visualTokens.bodyFont,
            fontSize: '1rem',
            minWidth: '44px',
            minHeight: '44px',
            touchAction: 'manipulation',
          }}
        >
          {getButtonLabel('share')} on TikTok
        </button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <p style={{ fontFamily: visualTokens.bodyFont, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Or copy the link:
        </p>
        <input
          type="text"
          readOnly
          value={shareUrl}
          style={{
            width: '100%',
            padding: '0.5rem',
            background: visualTokens.bgColor,
            border: `1px solid ${visualTokens.primaryColor}`,
            color: visualTokens.primaryColor,
            borderRadius: visualTokens.borderRadius,
            fontFamily: visualTokens.bodyFont,
          }}
          onClick={(e) => {
            (e.target as HTMLInputElement).select();
            navigator.clipboard?.writeText(shareUrl);
          }}
        />
      </div>
    </section>
  );
}
