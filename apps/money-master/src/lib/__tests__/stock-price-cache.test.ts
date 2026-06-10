import {
    isCacheValid,
    getCachedPrice,
    setCachedPrice,
    clearCache,
    getCacheStats,
    cleanupExpiredCache,
    priceCache
} from '../stock-price-cache';

describe('StockPriceCache', () => {
    beforeEach(() => {
        clearCache();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('isCacheValid', () => {
        it('should return true if within TTL', () => {
            const now = Date.now();
            expect(isCacheValid(now)).toBe(true);
        });

        it('should return false if expired', () => {
            const now = Date.now();
            const past = now - (61 * 60 * 1000); // 61 minutes ago (TTL is 60 min)
            expect(isCacheValid(past)).toBe(false);
        });
    });

    describe('cache operations', () => {
        it('should set and get cached price', () => {
            setCachedPrice('AAPL', { price: 150, currency: 'USD' });
            const cached = getCachedPrice('AAPL');
            expect(cached?.price).toBe(150);
            expect(cached?.currency).toBe('USD');
        });

        it('should return null for non-existent key', () => {
            expect(getCachedPrice('UNKNOWN')).toBeNull();
        });

        it('should return null and delete expired cache', () => {
            setCachedPrice('AAPL', { price: 150, currency: 'USD' });

            // Advance time by 61 minutes (TTL is 60 min)
            jest.advanceTimersByTime(61 * 60 * 1000);

            expect(getCachedPrice('AAPL')).toBeNull();
            expect(priceCache.has('AAPL')).toBe(false);
        });
    });

    describe('stats and cleanup', () => {
        it('should return correct stats', () => {
            setCachedPrice('AAPL', { price: 150, currency: 'USD' });
            setCachedPrice('GOOGL', { price: 2800, currency: 'USD' });

            const stats = getCacheStats();
            expect(stats.totalEntries).toBe(2);
            expect(stats.validEntries).toBe(2);
        });

        it('should cleanup expired entries', () => {
            setCachedPrice('AAPL', { price: 150, currency: 'USD' });
            setCachedPrice('GOOGL', { price: 2800, currency: 'USD' });

            // Advance time past TTL (61 min for 60 min TTL)
            jest.advanceTimersByTime(61 * 60 * 1000);

            const removed = cleanupExpiredCache();
            expect(removed).toBe(2);
            expect(priceCache.size).toBe(0);
        });
    });
});
