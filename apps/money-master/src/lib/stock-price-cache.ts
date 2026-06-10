/**
 * Stock Price Cache Module
 * 
 * Provides in-memory caching for stock prices and USD/JPY rates
 * to reduce API calls and improve performance.
 * 
 * TTL: 15 minutes (configurable)
 */

export interface CachedPrice {
    price: number;
    timestamp: number;
    currency: string;
    dividendRate?: number;
    dividendYield?: number;
    nextDividendDate?: string;
}

// In-memory cache store
export const priceCache = new Map<string, CachedPrice>();


// Cache TTL in milliseconds (default: 60 minutes to match update frequency)
const DEFAULT_TTL_MINUTES = 60;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _TTL_MS = DEFAULT_TTL_MINUTES * 60 * 1000;

/**
 * Check if a cached entry is still valid
 */
export function isCacheValid(timestamp: number, ttlMinutes: number = DEFAULT_TTL_MINUTES): boolean {
    const now = Date.now();
    const ttlMs = ttlMinutes * 60 * 1000;
    return (now - timestamp) < ttlMs;
}

/**
 * Get cached price data for a ticker
 */
export function getCachedPrice(ticker: string): CachedPrice | null {
    const cached = priceCache.get(ticker);

    if (!cached) {
        return null;
    }

    // Check if cache is still valid
    if (isCacheValid(cached.timestamp)) {
        return cached;
    }

    // Cache expired, remove it
    priceCache.delete(ticker);
    return null;
}

/**
 * Set cached price data for a ticker
 */
export function setCachedPrice(ticker: string, data: Omit<CachedPrice, 'timestamp'>): void {
    priceCache.set(ticker, {
        ...data,
        timestamp: Date.now(),
    });
}

/**
 * Clear entire cache (useful for testing or manual refresh)
 */
export function clearCache(): void {
    priceCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
    let validEntries = 0;
    let expiredEntries = 0;

    priceCache.forEach((value) => {
        if (isCacheValid(value.timestamp)) {
            validEntries++;
        } else {
            expiredEntries++;
        }
    });

    return {
        totalEntries: priceCache.size,
        validEntries,
        expiredEntries,
        ttlMinutes: DEFAULT_TTL_MINUTES,
    };
}

/**
 * Clean up expired cache entries (call periodically if needed)
 */
export function cleanupExpiredCache(): number {
    let removedCount = 0;

    priceCache.forEach((value, key) => {
        if (!isCacheValid(value.timestamp)) {
            priceCache.delete(key);
            removedCount++;
        }
    });

    return removedCount;
}
