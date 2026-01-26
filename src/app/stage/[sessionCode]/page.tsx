/**
 * The Stage Page
 * 
 * Dynamic route for the teleprompter performance view.
 * Displays synchronized teleprompter with script advancement controls.
 */

'use client';

import { useEffect, use, useState } from 'react';
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
  const setSessionState = useSetAtom(sessionStateAtom);
  const setVibe = useSetAtom(vibeAtom);
  const { visualTokens } = useVibe();
  const [participantsCount, setParticipantsCount] = useState<number | null>(null);

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
          if (fetched && mounted) {
            if (fetched.vibeContext) setVibe(fetched.vibeContext as never);
            const list = fetched.participants as unknown[];
            setParticipantsCount(Array.isArray(list) ? list.length : 0);
          }
          return;
        }
        if (data.vibeContext) setVibe(data.vibeContext as never);
      } catch {
        // ignore parse errors
      }
    };

    client.addEventListener('message', handleStateRecovered);

    const unsubscribeState = onSessionStateUpdate((data) => {
      if (data.sessionId !== sessionCode || !mounted) return;
      if (data.status) {
        setSessionState(data.status);
        // If state changes to 'casting', redirect participants back to casting couch
        if (data.status === 'casting') {
          if (participant?.role !== 'director') {
            // Participants redirect to join page where casting couch will be shown
            router.push(`/join/${sessionCode}`);
          } else {
            // Director redirects to director-desk
            router.push('/director-desk');
          }
        }
      }
      if (data.vibeContext) {
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
  }, [sessionCode, setSessionState, setVibe, router, participant]);

  // Fetch participant count when performing (e.g. director navigated from casting without state:recovered)
  useEffect(() => {
    if (!sessionCode || sessionState !== 'performing' || participantsCount !== null) return;
    let mounted = true;
    fetchSessionState(sessionCode).then((fetched) => {
      if (!mounted || !fetched) return;
      const list = fetched.participants as unknown[];
      setParticipantsCount(Array.isArray(list) ? list.length : 0);
    });
    return () => { mounted = false; };
  }, [sessionCode, sessionState, participantsCount]);

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
      className="h-screen overflow-hidden w-full flex flex-col"
      style={{
        backgroundColor: visualTokens.bgColor,
        color: visualTokens.textColor,
        fontFamily: visualTokens.bodyFont,
      }}
    >
      <div className="flex-1 min-h-0 flex flex-col">
        <Teleprompter sessionCode={sessionCode} participantsCount={participantsCount ?? undefined} />
      </div>
    </div>
  );
}
