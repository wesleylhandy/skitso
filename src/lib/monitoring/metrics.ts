/**
 * Custom application metrics (T180).
 *
 * This module provides a thin abstraction for recording key
 * performance metrics such as script generation time, sync latency,
 * and theme switch time. For now, metrics are logged in development
 * and exposed via an in-memory buffer for tests and future exporters.
 */

export type MetricName =
  | 'script_generation_ms'
  | 'sync_latency_ms'
  | 'theme_switch_ms';

export interface AppMetric {
  name: MetricName;
  value: number;
  sessionId?: string;
  timestamp: number;
  metadata?: Record<string, string | number | boolean | null>;
}

const inMemoryBuffer: AppMetric[] = [];

export function recordMetric(metric: AppMetric): void {
  inMemoryBuffer.push(metric);

  if (process.env.NODE_ENV === 'development') {
     
    console.log('[Metrics]', metric);
  }
}

export function getBufferedMetrics(): AppMetric[] {
  return [...inMemoryBuffer];
}

export function clearBufferedMetrics(): void {
  inMemoryBuffer.length = 0;
}

export function withTiming<T>(
  name: MetricName,
  fn: () => Promise<T> | T,
  sessionId?: string,
  metadata?: AppMetric['metadata'],
): Promise<T> | T {
  const start = performance.now();
  const result = fn();

  if (result instanceof Promise) {
    return result.then((value) => {
      recordMetric({
        name,
        value: performance.now() - start,
        sessionId,
        timestamp: Date.now(),
        metadata,
      });
      return value;
    });
  }

  recordMetric({
    name,
    value: performance.now() - start,
    sessionId,
    timestamp: Date.now(),
    metadata,
  });

  return result;
}

