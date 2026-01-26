/**
 * Voting Interface Component
 * 
 * Allows participants to vote on overall quality, favorite moments,
 * best actor, and funniest moments. Displays real-time results.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAtom, useAtomValue } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import {
  initializePartyKitClient,
  onWrapPartyVote,
  onWrapPartyData,
  submitVote,
  updateWrapPartyData,
} from '@/src/lib/partykit/client';
import type { Vote, VoteCategory, Character } from '@/src/state/types/session';

interface VotingInterfaceProps {
  onVoteSubmitted?: (vote: Vote) => void;
  /** Session code from URL (wrap party page). Avoids atom sync delay. */
  sessionCode?: string | null;
}

/**
 * VotingInterface Component
 *
 * Provides voting interface for wrap party with real-time synchronization.
 * When we have sessionCode but no participant (e.g. new tab, refresh), show
 * "Rejoin to vote" instead of "unavailable" — we're in the session, just not identified.
 */
export function VotingInterface({ onVoteSubmitted, sessionCode: propSessionCode }: VotingInterfaceProps) {
  const { visualTokens, getSectionTitle, getErrorMessage, getButtonLabel } = useVibe();
  const topIndicator = getSectionTitle('wrapPartyTopIndicator');
  const participant = useAtomValue(participantAtom);
  const atomSessionCode = useAtomValue(sessionCodeAtom);
  const cast = useAtomValue(castAtom);
  const [wrapPartyData, setWrapPartyData] = useAtom(wrapPartyDataAtom);

  const sessionCode = propSessionCode ?? atomSessionCode;

  const [selectedQuality, setSelectedQuality] = useState<number | null>(null);
  const [selectedBestActor, setSelectedBestActor] = useState<string | null>(null);
  const [selectedFavoriteMoment, setSelectedFavoriteMoment] = useState<string | null>(null);
  const [selectedFunniestMoment, setSelectedFunniestMoment] = useState<string | null>(null);

  // Initialize wrap party data if needed
  useEffect(() => {
    if (!wrapPartyData && sessionCode) {
      setWrapPartyData({
        sessionId: sessionCode,
        votes: [],
        awards: [],
        feedback: [],
        sharedLinks: [],
        createdAt: Date.now(),
      });
    }
  }, [wrapPartyData, sessionCode, setWrapPartyData]);

  // Set up PartyKit listeners for real-time vote updates
  useEffect(() => {
    if (!sessionCode || !participant) return;

    initializePartyKitClient(sessionCode);
    const unsubscribeVote = onWrapPartyVote((data) => {
      if (data.sessionId === sessionCode) {
        // Update local state with new vote
        setWrapPartyData((current) => {
          if (!current) return current;
          
          // Check if participant already voted in this category
          const existingVoteIndex = current.votes.findIndex(
            (v) => v.participantId === data.vote.participantId && v.category === data.vote.category
          );

          const updatedVotes = [...current.votes];
          if (existingVoteIndex >= 0) {
            updatedVotes[existingVoteIndex] = data.vote;
          } else {
            updatedVotes.push(data.vote);
          }

          return {
            ...current,
            votes: updatedVotes,
          };
        });
      }
    });

    const unsubscribeData = onWrapPartyData((data) => {
      if (data.sessionId === sessionCode) {
        setWrapPartyData(data.wrapPartyData);
      }
    });

    return () => {
      unsubscribeVote();
      unsubscribeData();
    };
  }, [sessionCode, participant, setWrapPartyData]);

  // Load existing votes for this participant
  useEffect(() => {
    if (!wrapPartyData || !participant) return;

    const myVotes = wrapPartyData.votes.filter((v) => v.participantId === participant.id);
    
    myVotes.forEach((vote) => {
      switch (vote.category) {
        case 'overall_quality':
          setSelectedQuality(vote.value);
          break;
        case 'best_actor':
          setSelectedBestActor(vote.targetId);
          break;
        case 'favorite_moment':
          setSelectedFavoriteMoment(vote.targetId);
          break;
        case 'funniest_moment':
          setSelectedFunniestMoment(vote.targetId);
          break;
      }
    });
  }, [wrapPartyData, participant]);

  const handleVote = async (category: VoteCategory, targetId: string, value: number) => {
    if (!participant || !sessionCode || !wrapPartyData) return;

    // eslint-disable-next-line react-hooks/purity -- Event handler, not render code
    const now = Date.now();
    const vote: Vote = {
      id: `vote-${now}-${participant.id}-${category}`,
      participantId: participant.id,
      category,
      targetId,
      value,
      createdAt: now,
    };

    // Update local state optimistically and sync to PartyKit
    let nextData: typeof wrapPartyData | null = null;
    setWrapPartyData((current) => {
      if (!current) return current;

      // Remove existing vote in this category from this participant
      const filteredVotes = current.votes.filter(
        (v) => !(v.participantId === participant.id && v.category === category)
      );

      nextData = {
        ...current,
        votes: [...filteredVotes, vote],
      };

      return nextData;
    });

    if (nextData) {
      updateWrapPartyData(sessionCode, nextData);
    }

    // Broadcast vote via socket
    submitVote(sessionCode, vote);

    // Update local selection state
    switch (category) {
      case 'overall_quality':
        setSelectedQuality(value);
        break;
      case 'best_actor':
        setSelectedBestActor(targetId);
        break;
      case 'favorite_moment':
        setSelectedFavoriteMoment(targetId);
        break;
      case 'funniest_moment':
        setSelectedFunniestMoment(targetId);
        break;
    }

    onVoteSubmitted?.(vote);
  };

  // Calculate vote results
  const getVoteResults = (category: VoteCategory): {
    count: number;
    average: number;
    distribution: Record<string | number, number>;
  } => {
    if (!wrapPartyData) return { count: 0, average: 0, distribution: {} };
    
    const categoryVotes = wrapPartyData.votes.filter((v) => v.category === category);
    const count = categoryVotes.length;
    
    if (category === 'overall_quality') {
      const sum = categoryVotes.reduce((acc, v) => acc + v.value, 0);
      const average = count > 0 ? sum / count : 0;
      const distribution: Record<string | number, number> = {};
      categoryVotes.forEach((v) => {
        distribution[v.value] = (distribution[v.value] || 0) + 1;
      });
      return { count, average, distribution };
    }
    
    // For other categories, count votes per target
    const distribution: Record<string | number, number> = {};
    categoryVotes.forEach((v) => {
      distribution[v.targetId] = (distribution[v.targetId] || 0) + 1;
    });
    
    return { count, average: 0, distribution };
  };

  /** Keys with the highest vote count; ties all included. */
  const getTopKeys = (distribution: Record<string | number, number>): (string | number)[] => {
    const entries = Object.entries(distribution).filter(([, c]) => c > 0) as [string, number][];
    if (entries.length === 0) return [];
    const max = Math.max(...entries.map(([, c]) => c));
    return entries
      .filter(([, c]) => c === max)
      .map(([k]) => {
        const n = Number(k);
        return Number.isNaN(n) ? k : n;
      });
  };

  const qualityResults = getVoteResults('overall_quality');
  const bestActorResults = getVoteResults('best_actor');
  const favoriteMomentResults = getVoteResults('favorite_moment');
  const funniestMomentResults = getVoteResults('funniest_moment');

  const bestActorTopKeys = getTopKeys(bestActorResults.distribution);
  const favoriteTopKeys = getTopKeys(favoriteMomentResults.distribution);
  const funniestTopKeys = getTopKeys(funniestMomentResults.distribution);

  if (!sessionCode) {
    return (
      <div className="voting-interface" style={{ color: visualTokens.primaryColor }}>
        <h2 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem' }}>
          {getSectionTitle('wrapParty')}
        </h2>
        <p style={{ fontFamily: visualTokens.bodyFont }}>
          {getErrorMessage('wrapPartyUnavailable')}
        </p>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="voting-interface" style={{ color: visualTokens.primaryColor }}>
        <h2 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem' }}>
          {getSectionTitle('wrapParty')}
        </h2>
        <p style={{ fontFamily: visualTokens.bodyFont, marginBottom: '1rem' }}>
          {getSectionTitle('wrapPartyRejoinToVote')}
        </p>
        <Link
          href={`/join/${sessionCode}`}
          style={{
            display: 'inline-block',
            fontFamily: visualTokens.bodyFont,
            padding: '0.5rem 1rem',
            borderRadius: visualTokens.borderRadius,
            border: `2px solid ${visualTokens.primaryColor}`,
            color: visualTokens.primaryColor,
            backgroundColor: 'transparent',
            textDecoration: 'none',
            minWidth: '44px',
            minHeight: '44px',
            lineHeight: '2.25',
          }}
        >
          {getButtonLabel('join')}
        </Link>
      </div>
    );
  }

  const sectionColor = { color: visualTokens.primaryColor };

  return (
    <div className="voting-interface" style={sectionColor}>
      <h2 style={{ fontFamily: visualTokens.headerFont, marginBottom: '2rem', color: visualTokens.textColor }}>
        {getSectionTitle('wrapParty')}
      </h2>

      {/* Overall Quality Voting */}
      <section className="voting-section" style={{ marginBottom: '2rem', ...sectionColor }}>
        <h3 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem', color: visualTokens.accentColor }}>
          Overall Quality
        </h3>
        <div
          className="star-rating"
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '2px',
          }}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const isSelected = Boolean(selectedQuality && selectedQuality >= star);
            return (
              <button
                key={star}
                type="button"
                aria-label={`${star} star${star !== 1 ? 's' : ''}${isSelected ? ' — your rating' : ''}`}
                aria-pressed={isSelected}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVote('overall_quality', 'overall', star);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVote('overall_quality', 'overall', star);
                }}
                style={{
                  background: isSelected ? visualTokens.primaryColor : 'transparent',
                  border: `2px solid ${isSelected ? visualTokens.primaryColor : visualTokens.accentColor}`,
                  color: isSelected ? visualTokens.bgColor : visualTokens.accentColor,
                  padding: 0,
                  width: '44px',
                  height: '44px',
                  flexShrink: 0,
                  borderRadius: visualTokens.borderRadius,
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isSelected ? 1 : 0.85,
                  touchAction: 'manipulation',
                }}
              >
                {isSelected ? '★' : '☆'}
              </button>
            );
          })}
        </div>
        {qualityResults.count > 0 && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', ...sectionColor }}>
            Average: {qualityResults.average.toFixed(1)} ({qualityResults.count} votes)
          </p>
        )}
      </section>

      {/* Best Actor Voting */}
      <section className="voting-section" style={{ marginBottom: '2rem', ...sectionColor }}>
        <h3 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem', color: visualTokens.accentColor }}>
          Best Actor
        </h3>
        <div className="character-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {cast.map((character: Character) => {
            const isTop = bestActorTopKeys.includes(character.id);
            return (
              <button
                key={character.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVote('best_actor', character.id, 1);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVote('best_actor', character.id, 1);
                }}
                style={{
                  background: selectedBestActor === character.id ? visualTokens.primaryColor : 'transparent',
                  border: `2px solid ${visualTokens.primaryColor}`,
                  color: selectedBestActor === character.id ? visualTokens.bgColor : visualTokens.primaryColor,
                  padding: '0.75rem 1.5rem',
                  borderRadius: visualTokens.borderRadius,
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  touchAction: 'manipulation',
                }}
              >
                {isTop && (
                  <span role="img" aria-label="Top vote" style={{ fontSize: '1.1rem' }}>
                    {topIndicator}
                  </span>
                )}
                {character.name}
                {bestActorResults.distribution[character.id] !== undefined && (
                  <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    ({bestActorResults.distribution[character.id]})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Favorite Moment Voting */}
      <section className="voting-section" style={{ marginBottom: '2rem', ...sectionColor }}>
        <h3 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem', color: visualTokens.accentColor }}>
          Favorite Moment
        </h3>
        <div className="moment-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {['opening', 'middle', 'climax', 'ending'].map((moment) => {
            const isTop = favoriteTopKeys.includes(moment);
            return (
              <button
                key={moment}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVote('favorite_moment', moment, 1);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVote('favorite_moment', moment, 1);
                }}
                style={{
                  background: selectedFavoriteMoment === moment ? visualTokens.primaryColor : 'transparent',
                  border: `2px solid ${visualTokens.primaryColor}`,
                  color: selectedFavoriteMoment === moment ? visualTokens.bgColor : visualTokens.primaryColor,
                  padding: '0.75rem 1.5rem',
                  borderRadius: visualTokens.borderRadius,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  touchAction: 'manipulation',
                }}
              >
                {isTop && (
                  <span role="img" aria-label="Top vote" style={{ fontSize: '1.1rem' }}>
                    {topIndicator}
                  </span>
                )}
                {moment}
                {favoriteMomentResults.distribution[moment] !== undefined && (
                  <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    ({favoriteMomentResults.distribution[moment]})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Funniest Moment Voting */}
      <section className="voting-section" style={{ marginBottom: '2rem', ...sectionColor }}>
        <h3 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem', color: visualTokens.accentColor }}>
          Funniest Moment
        </h3>
        <div className="moment-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {['opening', 'middle', 'climax', 'ending'].map((moment) => {
            const isTop = funniestTopKeys.includes(moment);
            return (
              <button
                key={moment}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVote('funniest_moment', moment, 1);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVote('funniest_moment', moment, 1);
                }}
                style={{
                  background: selectedFunniestMoment === moment ? visualTokens.primaryColor : 'transparent',
                  border: `2px solid ${visualTokens.primaryColor}`,
                  color: selectedFunniestMoment === moment ? visualTokens.bgColor : visualTokens.primaryColor,
                  padding: '0.75rem 1.5rem',
                  borderRadius: visualTokens.borderRadius,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  touchAction: 'manipulation',
                }}
              >
                {isTop && (
                  <span role="img" aria-label="Top vote" style={{ fontSize: '1.1rem' }}>
                    {topIndicator}
                  </span>
                )}
                {moment}
                {funniestMomentResults.distribution[moment] !== undefined && (
                  <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    ({funniestMomentResults.distribution[moment]})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
