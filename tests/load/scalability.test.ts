import { describe, it, expect } from 'vitest';
import { OpenAiQueueManager } from '@/src/lib/openai/queue-manager';

/**
 * T181a: Load testing scaffold for concurrent sessions.
 *
 * This is a lightweight approximation that stresses the in-process
 * queue manager with many concurrent tasks. For full 1,000-session
 * validation, run this in an environment where PartyKit is also
 * exercised under load.
 */

describe('T181a: Queue scalability under load', () => {
  it('handles many queued tasks without starvation', async () => {
    const queue = new OpenAiQueueManager({ maxConcurrent: 10 });
    const tasks = 200;
    let completed = 0;

    const promises = Array.from({ length: tasks }, (_, index) =>
      queue.enqueue(`task-${index}`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        completed += 1;
        return index;
      }),
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(tasks);
    expect(completed).toBe(tasks);
  }, 30_000);
});

