import { prisma } from '@/lib/prisma';
import * as AnalyticsService from '../analytics.service';
import * as AssetService from '../asset.service';

// Mock prisma and AssetService
jest.mock('@/lib/prisma', () => ({
    prisma: {
        analysisLog: {
            findFirst: jest.fn(),
        },
        historyEntry: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));

jest.mock('../asset.service');

describe('AnalyticsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getLatestAnalysis', () => {
        it('should return null if no log found', async () => {
            (prisma.analysisLog.findFirst as jest.Mock).mockResolvedValue(null);
            const result = await AnalyticsService.getLatestAnalysis();
            expect(result).toBeNull();
        });

        it('should return parsed log', async () => {
            const mockLog = {
                id: '1',
                date: '2024-01-01',
                sources: JSON.stringify(['source1']),
            };
            (prisma.analysisLog.findFirst as jest.Mock).mockResolvedValue(mockLog);

            const result = await AnalyticsService.getLatestAnalysis();
            expect(result?.sources).toEqual(['source1']);
        });

        it('should handle JSON parse error', async () => {
            const mockLog = {
                id: '1',
                date: '2024-01-01',
                sources: 'invalid-json',
            };
            (prisma.analysisLog.findFirst as jest.Mock).mockResolvedValue(mockLog);

            const result = await AnalyticsService.getLatestAnalysis();
            expect(result?.sources).toEqual([]);
        });
    });

    describe('recordDailyHistory', () => {
        const mockPortfolio = {
            portfolio: {
                assets: [
                    {
                        type: 'stock',
                        quantity: 10,
                        currentPrice: 100,
                        avgCost: 90,
                        currency: 'USD',
                    },
                    {
                        type: 'bank',
                        balance: 10000,
                        currency: 'JPY',
                    }
                ],
            },
            usdJpy: 150,
        };

        beforeEach(() => {
            (AssetService.getPortfolioWithPrices as jest.Mock).mockResolvedValue(mockPortfolio);
        });

        it('should skip if history exists and not forced', async () => {
            (prisma.historyEntry.findUnique as jest.Mock).mockResolvedValue({ id: '1' });

            await AnalyticsService.recordDailyHistory(false);

            expect(prisma.historyEntry.upsert).not.toHaveBeenCalled();
        });

        it('should record history if forced', async () => {
            await AnalyticsService.recordDailyHistory(true);

            expect(prisma.historyEntry.upsert).toHaveBeenCalled();

            const upsertCall = (prisma.historyEntry.upsert as jest.Mock).mock.calls[0][0];
            // Stock: 10 * 100 * 150 = 150,000
            // Bank: 10,000
            // Total: 160,000
            expect(upsertCall.create.totalValue).toBe(160000);
        });
    });

    describe('getAssetAllocation', () => {
        it('should calculate allocation correctly', async () => {
            const mockPortfolio = {
                portfolio: {
                    assets: [
                        {
                            type: 'stock',
                            quantity: 10,
                            currentPrice: 100,
                            currency: 'USD',
                        },
                        {
                            type: 'bank',
                            balance: 150000, // Same value as stock (10*100*150)
                            currency: 'JPY',
                        }
                    ],
                },
                usdJpy: 150,
            };

            (AssetService.getPortfolioWithPrices as jest.Mock).mockResolvedValue(mockPortfolio);

            const result = await AnalyticsService.getAssetAllocation();

            expect(result.byType).toHaveLength(2);
            // Should be roughly 50/50
            const stock = result.byType.find(i => i.name === 'stock');
            const bank = result.byType.find(i => i.name === 'bank');
            expect(stock?.percentage).toBe(50);
            expect(bank?.percentage).toBe(50);
        });
    });
});
