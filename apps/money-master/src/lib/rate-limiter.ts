/**
 * Rate Limiter Utility for Yahoo Finance API
 * Implements exponential backoff retry logic for 429 errors
 */

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 1, baseDelay = 1000, maxDelay = 3000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const is429 = errorMessage.includes('429') ||
        errorMessage.includes('Too Many Requests') ||
        errorMessage.includes('crumb');

      if (!is429 || attempt === maxRetries) {
        throw error;
      }

      const waitTime = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      console.warn(`[RateLimiter] 429 detected, retry ${attempt + 1}/${maxRetries} after ${waitTime}ms`);
      await delay(waitTime);
    }
  }

  throw new Error('Unreachable');
}
