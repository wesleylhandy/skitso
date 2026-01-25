/**
 * Wrap Party Page
 * 
 * Page route for the wrap party screen after performance completion.
 */

import { WrapParty } from '@/src/components/wrap-party/wrap-party';

interface WrapPartyPageProps {
  params: Promise<{ sessionCode: string }>;
}

/**
 * Wrap Party Page Component
 * 
 * Server component that renders the wrap party screen.
 * Next.js 16+ passes params as a Promise; must await before use.
 */
export default async function WrapPartyPage({ params }: WrapPartyPageProps) {
  const { sessionCode } = await params;
  return <WrapParty sessionCode={sessionCode} />;
}
