/**
 * Performance monitoring utilities (T179).
 *
 * This module wires Core Web Vitals and basic navigation timing
 * into a simple callback API. In production you can forward these
 * metrics to your observability stack (e.g. sendBeacon to an API).
 *
 * The implementation is intentionally lightweight so it can be
 * safely imported from a small client component without impacting
 * bundle size significantly.
 */

import type { Metric } from 'web-vitals';
import { onCLS, onFID, onINP, onLCP, onTTFB } from 'web-vitals';

export type WebVitalId =
  | 'CLS'
  | 'FID'
  | 'INP'
  | 'LCP'
  | 'TTFB'
  | 'NAVIGATION';

export interface WebVitalMetric {
  id: WebVitalId;
  name: string;
  value: number;
  rating?: Metric['rating'];
  // Extra fields for navigation timing
  navigationType?: string;
}

export type WebVitalReporter = (metric: WebVitalMetric) => void;

/**
 * Default reporter: logs metrics in development, no-ops in production.
 */
export const defaultReporter: WebVitalReporter = (metric) => {
  if (process.env.NODE_ENV !== 'development') return;
   
  console.log('[Performance] Web Vital', metric);
};

/**
 * Initialize Core Web Vitals monitoring on the client.
 *
 * Call this once from a small client component mounted at the root.
 */
export function initPerformanceMonitoring(
  reporter: WebVitalReporter = defaultReporter,
): void {
  if (typeof window === 'undefined') return;

  const wrap = (id: WebVitalId) => (metric: Metric) => {
    reporter({
      id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    });
  };

  onCLS(wrap('CLS'));
  onFID(wrap('FID'));
  onINP(wrap('INP'));
  onLCP(wrap('LCP'));
  onTTFB(wrap('TTFB'));

  // Basic navigation timing (not a Core Web Vital but useful).
  if ('performance' in window && 'getEntriesByType' in window.performance) {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const nav = entries[0];
    if (nav) {
      reporter({
        id: 'NAVIGATION',
        name: 'navigation',
        value: nav.loadEventEnd,
        navigationType: nav.type,
      });
    }
  }
}

