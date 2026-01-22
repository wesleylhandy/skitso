/**
 * The Stage Page
 * 
 * Dynamic route for the teleprompter performance view.
 * Displays synchronized teleprompter with script advancement controls.
 */

'use client';

import { useEffect, use } from 'react';
import dynamic from 'next/dynamic';
import { useAtomValue } from 'jotai';
import { useRouter } from 'next/navigation';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { ErrorMessage } from '@/src/components/ui/error-message';

// Code-split the Teleprompter component for performance
const Teleprompter = dynamic(
  () => import('@/src/components/teleprompter/teleprompter').then((mod) => ({ default: mod.Teleprompter })),
  {
    loading: () => <div className="text-center p-8">Loading teleprompter...</div>,
    ssr: false,
  }
);

interface StagePageProps {
  params: Promise<{ sessionCode: string }>;
}

export default function StagePage({ params }: StagePageProps) {
  const { sessionCode } = use(params);
  const router = useRouter();
  const storedSessionCode = useAtomValue(sessionCodeAtom);
  const participant = useAtomValue(participantAtom);
  const script = useAtomValue(currentScriptAtom);
  const sessionState = useAtomValue(sessionStateAtom);

  // Redirect if session code doesn't match or participant not joined
  useEffect(() => {
    if (!storedSessionCode || storedSessionCode !== sessionCode) {
      router.push(`/join/${sessionCode}`);
      return;
    }

    if (!participant) {
      router.push(`/join/${sessionCode}`);
      return;
    }

    if (sessionState !== 'performing') {
      // If not in performing state, redirect to casting couch
      router.push(`/director-desk`);
      return;
    }

    if (!script) {
      // If no script, redirect to director desk
      router.push(`/director-desk`);
      return;
    }
  }, [sessionCode, storedSessionCode, participant, script, sessionState, router]);

  if (!participant || !script || sessionState !== 'performing') {
    return (
      <div className="container mx-auto p-4">
        <ErrorMessage message="Loading stage..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      <Teleprompter sessionCode={sessionCode} />
    </div>
  );
}
