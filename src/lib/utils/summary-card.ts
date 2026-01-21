/**
 * Summary Card Generator
 * 
 * Generates shareable summary cards for wrap party results.
 */

import type { WrapPartyData, Award } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';

export interface SummaryCardData {
  sessionId: string;
  vibeContext: VibeType;
  overallQuality: number;
  awards: Award[];
  participantCount: number;
  createdAt: number;
}

/**
 * Generates summary card data from wrap party data
 * 
 * @param wrapPartyData - The wrap party data
 * @param vibeContext - The vibe context
 * @param participantCount - Number of participants
 * @returns Summary card data
 */
export function generateSummaryCard(
  wrapPartyData: WrapPartyData,
  vibeContext: VibeType,
  participantCount: number
): SummaryCardData {
  // Calculate overall quality average
  const qualityVotes = wrapPartyData.votes.filter((v) => v.category === 'overall_quality');
  const overallQuality = qualityVotes.length > 0
    ? qualityVotes.reduce((sum, v) => sum + v.value, 0) / qualityVotes.length
    : 0;

  return {
    sessionId: wrapPartyData.sessionId,
    vibeContext,
    overallQuality: Math.round(overallQuality * 10) / 10, // Round to 1 decimal
    awards: wrapPartyData.awards,
    participantCount,
    createdAt: wrapPartyData.createdAt,
  };
}

/**
 * Generates a text summary for sharing
 * 
 * @param summaryCard - The summary card data
 * @returns Text summary string
 */
export function generateTextSummary(summaryCard: SummaryCardData): string {
  const awardsText = summaryCard.awards.length > 0
    ? `\nAwards: ${summaryCard.awards.map((a) => a.vibeAppropriateLabel).join(', ')}`
    : '';

  return `Skitso Performance Summary
Vibe: ${summaryCard.vibeContext}
Overall Quality: ${summaryCard.overallQuality}/5
Participants: ${summaryCard.participantCount}${awardsText}`;
}

/**
 * Generates an image URL for the summary card (placeholder for future implementation)
 * 
 * @param summaryCard - The summary card data
 * @returns Image URL or data URI
 */
export function generateSummaryCardImage(summaryCard: SummaryCardData): string {
  // Placeholder: In a real implementation, this would generate an image
  // using canvas or a server-side image generation service
  // For now, return a data URI placeholder
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <rect width="1200" height="630" fill="#0A0A0A"/>
      <text x="600" y="300" font-family="Arial" font-size="48" fill="#8AFB17" text-anchor="middle">
        Skitso Performance
      </text>
      <text x="600" y="400" font-family="Arial" font-size="36" fill="#FFFFFF" text-anchor="middle">
        Quality: ${summaryCard.overallQuality}/5
      </text>
    </svg>
  `)}`;
}
