/**
 * Voting Interface Component
 * 
 * Allows participants to vote on overall quality, favorite moments,
 * best actor, and funniest moments. Displays real-time results.
 */

'use client';

import { useEffect, useState } from 'react';
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
}

/**
 * VotingInterface Component
 * 
 * Provides voting interface for wrap party with real-time synchronization.
 */
export function VotingInterface({ onVoteSubmitted }: VotingInterfaceProps) {
  const { visualTokens, getSectionTitle, getErrorMessage } = useVibe();
  const participant = useAtomValue(participantAtom);
  const sessionCode = useAtomValue(sessionCodeAtom);
  const cast = useAtomValue(castAtom);
  const [wrapPartyData, setWrapPartyData] = useAtom(wrapPartyDataAtom);

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

  const qualityResults = getVoteResults('overall_quality');
  const bestActorResults = getVoteResults('best_actor');
  const favoriteMomentResults = getVoteResults('favorite_moment');
  const funniestMomentResults = getVoteResults('funniest_moment');

  if (!participant || !sessionCode) {
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

  return (
    <div className="voting-interface" style={{ color: visualTokens.primaryColor }}>
      <h2 style={{ fontFamily: visualTokens.headerFont, marginBottom: '2rem' }}>
        {getSectionTitle('wrapParty')}
      </h2>

      {/* Overall Quality Voting */}
      <section className="voting-section" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem' }}>
          Overall Quality
        </h3>
        <div className="star-rating" style={{ display: 'flex', gap: '0.5rem' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
              onClick={() => handleVote('overall_quality', 'overall', star)}
              style={{
                background: 'transparent',
                border: `2px solid ${visualTokens.primaryColor}`,
                color: selectedQuality && selectedQuality >= star ? visualTokens.primaryColor : visualTokens.accentColor,
                padding: '0.5rem 1rem',
                borderRadius: visualTokens.borderRadius,
                cursor: 'pointer',
                fontSize: '1.5rem',
                minWidth: '44px',
                minHeight: '44px',
              }}
            >
              ★
            </button>
          ))}
        </div>
        {qualityResults.count > 0 && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Average: {qualityResults.average.toFixed(1)} ({qualityResults.count} votes)
          </p>
        )}
      </section>

      {/* Best Actor Voting */}
      <section className="voting-section" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem' }}>
          Best Actor
        </h3>
        <div className="character-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {cast.map((character: Character) => (
            <button
              key={character.id}
              type="button"
              onClick={() => handleVote('best_actor', character.id, 1)}
              style={{
                background: selectedBestActor === character.id ? visualTokens.primaryColor : 'transparent',
                border: `2px solid ${visualTokens.primaryColor}`,
                color: selectedBestActor === character.id ? visualTokens.bgColor : visualTokens.primaryColor,
                padding: '0.75rem 1.5rem',
                borderRadius: visualTokens.borderRadius,
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
              }}
            >
              {character.name}
              {bestActorResults.distribution[character.id] !== undefined && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                  ({bestActorResults.distribution[character.id]})
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Favorite Moment Voting */}
      <section className="voting-section" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem' }}>
          Favorite Moment
        </h3>
        <div className="moment-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {['opening', 'middle', 'climax', 'ending'].map((moment) => (
            <button
              key={moment}
              type="button"
              onClick={() => handleVote('favorite_moment', moment, 1)}
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
              }}
            >
              {moment}
              {favoriteMomentResults.distribution[moment] !== undefined && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                  ({favoriteMomentResults.distribution[moment]})
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Funniest Moment Voting */}
      <section className="voting-section" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontFamily: visualTokens.headerFont, marginBottom: '1rem' }}>
          Funniest Moment
        </h3>
        <div className="moment-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {['opening', 'middle', 'climax', 'ending'].map((moment) => (
            <button
              key={moment}
              type="button"
              onClick={() => handleVote('funniest_moment', moment, 1)}
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
              }}
            >
              {moment}
              {funniestMomentResults.distribution[moment] !== undefined && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                  ({funniestMomentResults.distribution[moment]})
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
