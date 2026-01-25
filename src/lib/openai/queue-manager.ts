/**
 * AI queue manager (T181e, T181f).
 *
 * Provides a simple in-memory queue with concurrency limiting and
 * basic FIFO prioritization for OpenAI requests. This is designed
 * for a single process and is not a distributed queue.
 */

type QueueTask = {
  id: string;
  priority: number;
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

interface QueueOptions {
  maxConcurrent?: number;
}

export class OpenAiQueueManager {
  private readonly maxConcurrent: number;
  private running = 0;
  private readonly queue: QueueTask[] = [];

  constructor(options: QueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 5;
  }

  enqueue<T>(id: string, run: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        priority,
        run,
        // Cast to unknown to avoid generic variance issues while still preserving
        // the caller's Promise<T> resolve contract.
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.running >= this.maxConcurrent) return;
    const next = this.queue.shift();
    if (!next) return;

    this.running += 1;

    next
      .run()
      .then((result) => {
        next.resolve(result);
      })
      .catch((error) => {
        next.reject(error);
      })
      .finally(() => {
        this.running -= 1;
        this.processQueue();
      });
  }
}

// Default singleton instance for app-wide use.
export const openAiQueue = new OpenAiQueueManager({ maxConcurrent: 5 });

