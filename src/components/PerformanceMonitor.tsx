'use client';

/**
 * Root-level performance monitor component.
 *
 * This is a tiny client component that initializes Core Web Vitals
 * monitoring once on mount. It is safe to include in the root
 * layout without impacting server rendering.
 */

import { useEffect } from 'react';
import { initPerformanceMonitoring } from '@/src/lib/monitoring/performance';

export function PerformanceMonitor() {
  useEffect(() => {
    initPerformanceMonitoring();
  }, []);

  return null;
}

