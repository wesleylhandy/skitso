/**
 * Join Page
 * 
 * Entry point for actors to join a session.
 * Allows entering a session code or using a shareable link.
 */

'use client';

import { SessionJoinForm } from '@/src/components/actor/session-join-form';
import { BackButton } from '@/src/components/ui/back-button';

export default function JoinPage() {
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div
        style={{
          marginBottom: '2rem',
        }}
      >
        <BackButton to="/" />
      </div>
      <h1 className="text-2xl font-bold mb-4">Join Session</h1>
      <p className="mb-6 text-muted-foreground">
        Enter your session code to join an existing performance.
      </p>
      <SessionJoinForm />
    </div>
  );
}
