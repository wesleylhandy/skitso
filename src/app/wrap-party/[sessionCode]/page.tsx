/**
 * Wrap Party Page
 * 
 * Page route for the wrap party screen after performance completion.
 */

import { WrapParty } from '@/src/components/wrap-party/wrap-party';

interface WrapPartyPageProps {
  params: {
    sessionCode: string;
  };
}

/**
 * Wrap Party Page Component
 * 
 * Server component that renders the wrap party screen.
 */
export default function WrapPartyPage({ params }: WrapPartyPageProps) {
  return <WrapParty sessionCode={params.sessionCode} />;
}
