import { describe, it, expect } from 'vitest';
import { openAiQueue } from '@/src/lib/openai/queue-manager';

/**
 * T181b: AI generation queue load test.
 */

describe('T181b: AI queue under concurrent load', () => {
  it('respects concurrency limits and completes all jobs', async () => {
    const jobs = 100;
    let running = 0;
    let peak = 0;

    const promises = Array.from({ length: jobs }, (_, index) =>
      openAiQueue.enqueue(`job-${index}`, async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 2));
        running -= 1;
        return index;
      }),
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(jobs);
    expect(peak).toBeLessThanOrEqual(5);
  }, 20_000);
});

