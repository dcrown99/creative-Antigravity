import { calculateTotalAssets } from '../portfolio-logic';
import { Asset } from '../../types';

describe('calculateTotalAssets', () => {
    const USD_JPY_RATE = 150;

    describe('bank and cash assets', () => {
        it('should sum bank account balances', () => {
            const assets: Asset[] = [
                { id: '1', name: 'Bank A', type: 'bank', balance: 1000000, quantity: 0, avgCost: 0, currency: 'JPY' },
                { id: '2', name: 'Bank B', type: 'bank', balance: 500000, quantity: 0, avgCost: 0, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(1500000);
        });

        it('should sum cash balances', () => {
            const assets: Asset[] = [
                { id: '1', name: 'Cash on hand', type: 'cash', balance: 50000, quantity: 0, avgCost: 0, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(50000);
        });

        it('should handle undefined balance as 0', () => {
            const assets: Asset[] = [
                { id: '1', name: 'Bank', type: 'bank', quantity: 0, avgCost: 0, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(0);
        });
    });

    describe('stock assets', () => {
        it('should calculate JP stock value from currentPrice * quantity', () => {
            const assets: Asset[] = [
                { id: '1', name: 'Stock A', type: 'JP_STOCK', currentPrice: 1000, quantity: 100, avgCost: 800, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(100000);
        });

        it('should use manualPrice when currentPrice is not available', () => {
            const assets: Asset[] = [
                { id: '1', name: 'Stock A', type: 'JP_STOCK', manualPrice: 1500, quantity: 100, avgCost: 800, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(150000);
        });

        it('should use avgCost when no price is available', () => {
            const assets: Asset[] = [
                { id: '1', name: 'Stock A', type: 'JP_STOCK', quantity: 100, avgCost: 500, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(50000);
        });

        it('should convert US stocks to JPY', () => {
            const assets: Asset[] = [
                { id: '1', name: 'US Stock', type: 'US_STOCK', currentPrice: 100, quantity: 10, avgCost: 80, currency: 'USD' },
            ];

            // 100 * 10 = 1000 USD, 1000 * 150 = 150000 JPY
            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(150000);
        });
    });

    describe('ETF assets', () => {
        it('should calculate ETF value the same as stocks', () => {
            const assets: Asset[] = [
                { id: '1', name: 'ETF A', type: 'ETF', currentPrice: 2000, quantity: 50, avgCost: 1800, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(100000);
        });
    });

    describe('mutual fund (TRUST) assets', () => {
        it('should divide TRUST quantity by 10000 for calculation', () => {
            const assets: Asset[] = [
                // 100000 units at 15000 yen per 10000 units = 10 * 15000 = 150000
                { id: '1', name: 'Trust Fund', type: 'TRUST', currentPrice: 15000, quantity: 100000, avgCost: 14000, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(150000);
        });

        it('should handle small TRUST quantities correctly', () => {
            const assets: Asset[] = [
                // 5000 units at 20000 yen per 10000 units = 0.5 * 20000 = 10000
                { id: '1', name: 'Trust Fund', type: 'TRUST', currentPrice: 20000, quantity: 5000, avgCost: 18000, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(10000);
        });
    });

    describe('mixed portfolio', () => {
        it('should correctly sum all asset types', () => {
            const assets: Asset[] = [
                { id: '1', name: 'Bank', type: 'bank', balance: 1000000, quantity: 0, avgCost: 0, currency: 'JPY' },
                { id: '2', name: 'Cash', type: 'cash', balance: 100000, quantity: 0, avgCost: 0, currency: 'JPY' },
                { id: '3', name: 'JP Stock', type: 'JP_STOCK', currentPrice: 1000, quantity: 100, avgCost: 800, currency: 'JPY' },
                { id: '4', name: 'US Stock', type: 'US_STOCK', currentPrice: 50, quantity: 20, avgCost: 40, currency: 'USD' },
                { id: '5', name: 'Trust', type: 'TRUST', currentPrice: 10000, quantity: 50000, avgCost: 9000, currency: 'JPY' },
            ];

            // Bank: 1000000
            // Cash: 100000
            // JP Stock: 1000 * 100 = 100000
            // US Stock: 50 * 20 * 150 = 150000
            // Trust: 10000 * (50000/10000) = 10000 * 5 = 50000
            // Total: 1400000
            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(1400000);
        });
    });

    describe('edge cases', () => {
        it('should return 0 for empty array', () => {
            expect(calculateTotalAssets([], USD_JPY_RATE)).toBe(0);
        });

        it('should handle undefined quantity as 0', () => {
            const assets: Asset[] = [
                { id: '1', name: 'Stock', type: 'JP_STOCK', currentPrice: 1000, avgCost: 800, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(0);
        });

        it('should handle zero prices correctly', () => {
            const assets: Asset[] = [
                { id: '1', name: 'Stock', type: 'JP_STOCK', currentPrice: 0, quantity: 100, avgCost: 0, currency: 'JPY' },
            ];

            expect(calculateTotalAssets(assets, USD_JPY_RATE)).toBe(0);
        });

        it('should handle different USD/JPY rates', () => {
            const assets: Asset[] = [
                { id: '1', name: 'US Stock', type: 'US_STOCK', currentPrice: 100, quantity: 1, avgCost: 80, currency: 'USD' },
            ];

            expect(calculateTotalAssets(assets, 100)).toBe(10000);
            expect(calculateTotalAssets(assets, 200)).toBe(20000);
        });
    });
});
