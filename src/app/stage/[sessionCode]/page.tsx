/**
 * The Stage Page
 * 
 * Dynamic route for the teleprompter performance view.
 * Displays synchronized teleprompter with script advancement controls.
 */

'use client';

import { useEffect, use } from 'react';
import dynamic from 'next/dynamic';
import { useAtomValue, useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { ErrorMessage } from '@/src/components/ui/error-message';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { initializePartyKitClient, getPartyKitClient, onSessionStateUpdate, fetchSessionState } from '@/src/lib/partykit/client';
import { useVibe } from '@/src/lib/hooks/use-vibe';

// Code-split the Teleprompter component for performance
const Teleprompter = dynamic(
  () => import('@/src/components/teleprompter/teleprompter').then((mod) => ({ default: mod.Teleprompter })),
  {
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-3xl space-y-4 animate-pulse" aria-hidden="true">
          <div className="h-6 w-1/3 rounded bg-gray-700/60" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-gray-700/40" />
            <div className="h-4 w-5/6 rounded bg-gray-700/40" />
            <div className="h-4 w-2/3 rounded bg-gray-700/40" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-4/5 rounded bg-gray-700/30" />
            <div className="h-4 w-3/5 rounded bg-gray-700/30" />
            <div className="h-4 w-2/5 rounded bg-gray-700/30" />
          </div>
        </div>
      </div>
    ),
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
  const setVibe = useSetAtom(vibeAtom);
  const { visualTokens } = useVibe();

  // Hydrate vibe from PartyKit (state:recovered + session:state:updated) so stage respects Director's vibe
  useEffect(() => {
    if (!sessionCode) return;

    let mounted = true;
    const client = initializePartyKitClient(sessionCode);

    const requestStateRecovery = () => {
      const currentClient = getPartyKitClient();
      if (currentClient && currentClient.readyState === WebSocket.OPEN) {
        currentClient.send(JSON.stringify({
          type: 'state:recover',
          data: {
            sessionId: sessionCode,
            timestamp: Date.now(),
          },
        }));
      }
    };

    const handleStateRecovered = async (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'state:recovered' || !mounted) return;
        const data = message.data as { sessionId?: string; recovered?: boolean; vibeContext?: string };
        if (data.sessionId !== sessionCode) return;
        if (data.recovered) {
          const fetched = await fetchSessionState(sessionCode);
          if (fetched?.vibeContext && mounted) setVibe(fetched.vibeContext as never);
          return;
        }
        if (data.vibeContext) setVibe(data.vibeContext as never);
      } catch {
        // ignore parse errors
      }
    };

    client.addEventListener('message', handleStateRecovered);

    const unsubscribeState = onSessionStateUpdate((data) => {
      if (data.sessionId === sessionCode && mounted && data.vibeContext) {
        setVibe(data.vibeContext as never);
      }
    });

    if (client.readyState === WebSocket.OPEN) {
      requestStateRecovery();
    } else {
      client.addEventListener('open', requestStateRecovery, { once: true });
    }

    return () => {
      mounted = false;
      client.removeEventListener('message', handleStateRecovered);
      unsubscribeState();
    };
  }, [sessionCode, setVibe]);

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

    if (sessionState === 'completed') {
      // Smoothly move everyone to Wrap Party once the Director ends the performance (T192).
      router.push(`/wrap-party/${sessionCode}`);
      return;
    }

    if (sessionState !== 'performing') {
      // If not in performing state, redirect based on role
      // Actors go to join page (shows CastingCouch), director goes to director-desk
      if (participant?.role === 'director') {
        router.push(`/director-desk`);
      } else {
        router.push(`/join/${sessionCode}`);
      }
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
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: visualTokens.bgColor, color: visualTokens.textColor }}
      >
        <ErrorMessage message="Loading stage..." />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: visualTokens.bgColor,
        color: visualTokens.textColor,
        fontFamily: visualTokens.bodyFont,
      }}
    >
      <Teleprompter sessionCode={sessionCode} />
    </div>
  );
}
