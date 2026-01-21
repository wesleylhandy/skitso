/**
 * Landing Page Component
 * 
 * Viral Neon themed landing page with clear entry points
 * for Directors and Actors.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAtom } from 'jotai';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { getButtonLabel } from '@/src/state/config/vibe-text-registry';

export function LandingPage() {
  const [currentVibe] = useAtom(vibeAtom);
  const [glitchClass, setGlitchClass] = useState('');
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Use Viral Neon styling regardless of current vibe for landing page
  const isViralNeon = currentVibe === 'VIRAL_NEON';

  // Run glitch effect 3 times on load, then switch to hover-only
  useEffect(() => {
    if (initialLoadComplete) return;

    let glitchCount = 0;
    const runGlitch = () => {
      if (glitchCount < 3) {
        setGlitchClass('glitch-active');
        setTimeout(() => {
          setGlitchClass('');
          glitchCount++;
          if (glitchCount < 3) {
            // Wait 500ms before next glitch
            setTimeout(runGlitch, 500);
          } else {
            // After 3 glitches, mark initial load complete
            setInitialLoadComplete(true);
          }
        }, 400); // Duration of one glitch cycle
      }
    };

    // Start first glitch after a brief delay
    const initialTimer = setTimeout(runGlitch, 300);
    return () => clearTimeout(initialTimer);
  }, [initialLoadComplete]);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{
        backgroundColor: '#0A0A0A',
        color: '#FFFFFF',
      }}
    >
      {/* Logo with glitch effect */}
      <div className="mb-12 text-center">
        <div
          className={`text-6xl font-black italic tracking-tight inline-block ${glitchClass} ${isViralNeon ? 'logo-pulse' : ''}`}
          style={{
            fontFamily: 'Inter Black Italic, sans-serif',
            color: '#8AFB17',
            textShadow: '0 0 20px rgba(138, 251, 23, 0.5), 0 0 40px rgba(191, 64, 191, 0.3)',
            userSelect: 'none',
          }}
          onMouseEnter={() => {
            if (initialLoadComplete && !glitchClass) {
              setGlitchClass('glitch-active');
              setTimeout(() => setGlitchClass(''), 400);
            }
          }}
        >
          SKITSO
        </div>
        <div
          className="text-sm mt-2 text-center"
          style={{
            color: '#BF40BF',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          AI-Assisted Collaborative Performance Platform
        </div>
      </div>

      {/* Main CTA Section */}
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center mb-12">
          <h1
            className="text-4xl font-black italic mb-4"
            style={{
              fontFamily: 'Inter Black Italic, sans-serif',
              color: '#8AFB17',
            }}
          >
            Transform Group Hangouts Into Performance Spaces
          </h1>
          <p
            className="text-lg"
            style={{
              color: '#FFFFFF',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Pick a vibe. Generate a script. Perform together. No cap.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Start as Director */}
          <Link
            href="/vibe-selection"
            className="group relative p-6 rounded border-2 transition-all duration-200 hover:scale-105"
            style={{
              borderColor: '#8AFB17',
              backgroundColor: 'rgba(138, 251, 23, 0.05)',
              boxShadow: '0 0 20px rgba(138, 251, 23, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 30px rgba(138, 251, 23, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(138, 251, 23, 0.3)';
            }}
          >
            <div
              className="text-2xl font-black italic mb-2"
              style={{
                fontFamily: 'Inter Black Italic, sans-serif',
                color: '#8AFB17',
              }}
            >
              Start as Director
            </div>
            <p
              className="text-sm mb-4"
              style={{
                color: '#FFFFFF',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Create a session, pick your vibe, and generate an AI-powered script for your squad.
            </p>
            <div
              className="inline-block px-4 py-2 rounded text-sm font-bold transition-all"
              style={{
                backgroundColor: '#8AFB17',
                color: '#0A0A0A',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {getButtonLabel('VIRAL_NEON', 'start')} →
            </div>
          </Link>

          {/* Join as Actor */}
          <Link
            href="/join"
            className="group relative p-6 rounded border-2 transition-all duration-200 hover:scale-105"
            style={{
              borderColor: '#BF40BF',
              backgroundColor: 'rgba(191, 64, 191, 0.05)',
              boxShadow: '0 0 20px rgba(191, 64, 191, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 30px rgba(191, 64, 191, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(191, 64, 191, 0.3)';
            }}
          >
            <div
              className="text-2xl font-black italic mb-2"
              style={{
                fontFamily: 'Inter Black Italic, sans-serif',
                color: '#BF40BF',
              }}
            >
              Join as Actor
            </div>
            <p
              className="text-sm mb-4"
              style={{
                color: '#FFFFFF',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Got a session code? Hop in and get assigned your character. It&apos;s giving main character energy.
            </p>
            <div
              className="inline-block px-4 py-2 rounded text-sm font-bold transition-all"
              style={{
                backgroundColor: '#BF40BF',
                color: '#FFFFFF',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {getButtonLabel('VIRAL_NEON', 'join')} →
            </div>
          </Link>
        </div>

        {/* Features Preview */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-4">
            <div
              className="text-3xl mb-2"
              style={{ color: '#8AFB17' }}
            >
              🎭
            </div>
            <div
              className="text-sm font-bold mb-1"
              style={{
                color: '#8AFB17',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Five Vibes
            </div>
            <p
              className="text-xs"
              style={{
                color: '#FFFFFF',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              From Viral Neon to Indie A24
            </p>
          </div>
          <div className="p-4">
            <div
              className="text-3xl mb-2"
              style={{ color: '#BF40BF' }}
            >
              🤖
            </div>
            <div
              className="text-sm font-bold mb-1"
              style={{
                color: '#BF40BF',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              AI-Powered
            </div>
            <p
              className="text-xs"
              style={{
                color: '#FFFFFF',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Scripts, characters, and visuals
            </p>
          </div>
          <div className="p-4">
            <div
              className="text-3xl mb-2"
              style={{ color: '#8AFB17' }}
            >
              🎬
            </div>
            <div
              className="text-sm font-bold mb-1"
              style={{
                color: '#8AFB17',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Real-Time Sync
            </div>
            <p
              className="text-xs"
              style={{
                color: '#FFFFFF',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Everyone stays in sync
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
