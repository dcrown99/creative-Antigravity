import { prisma } from '@/lib/prisma';
import * as DividendService from '../dividend.service';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        dividend: {
            findMany: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
            createMany: jest.fn(),
        },
    },
}));

describe('DividendService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getDividends', () => {
        it('should fetch all dividends with asset info', async () => {
            const mockDividends = [
                {
                    id: '1',
                    assetId: 'asset1',
                    date: '2024-01-01',
                    amount: 100,
                    currency: 'JPY',
                    asset: { name: 'Test Stock', ticker: 'TEST' },
                },
            ];

            (prisma.dividend.findMany as jest.Mock).mockResolvedValue(mockDividends);

            const result = await DividendService.getDividends();

            expect(prisma.dividend.findMany).toHaveBeenCalledWith({
                orderBy: { date: 'desc' },
                include: {
                    asset: {
                        select: {
                            name: true,
                            ticker: true,
                        },
                    },
                },
            });
            expect(result).toHaveLength(1);
            expect(result[0].asset.name).toBe('Test Stock');
        });
    });

    describe('addDividend', () => {
        it('should create a new dividend', async () => {
            const mockDividend = {
                assetId: 'asset1',
                date: '2024-01-01',
                amount: 100,
                currency: 'JPY' as const,
            };

            const mockCreated = {
                id: '1',
                ...mockDividend,
            };

            (prisma.dividend.create as jest.Mock).mockResolvedValue(mockCreated);

            const result = await DividendService.addDividend(mockDividend);

            expect(prisma.dividend.create).toHaveBeenCalledWith({
                data: mockDividend,
            });
            expect(result.id).toBe('1');
        });
    });

    describe('deleteDividend', () => {
        it('should delete a dividend by id', async () => {
            const mockDeleted = {
                id: '1',
                assetId: 'asset1',
                date: '2024-01-01',
                amount: 100,
                currency: 'JPY',
            };

            (prisma.dividend.delete as jest.Mock).mockResolvedValue(mockDeleted);

            const result = await DividendService.deleteDividend('1');

            expect(prisma.dividend.delete).toHaveBeenCalledWith({
                where: { id: '1' },
            });
            expect(result.id).toBe('1');
        });
    });

    describe('updateDividend', () => {
        it('should update dividend date and amount', async () => {
            const mockUpdated = {
                id: '1',
                assetId: 'asset1',
                date: '2024-01-15',
                amount: 150,
                currency: 'JPY',
            };

            (prisma.dividend.update as jest.Mock).mockResolvedValue(mockUpdated);

            const result = await DividendService.updateDividend('1', {
                date: '2024-01-15',
                amount: 150,
            });

            expect(prisma.dividend.update).toHaveBeenCalledWith({
                where: { id: '1' },
                data: {
                    date: '2024-01-15',
                    amount: 150,
                },
            });
            expect(result.amount).toBe(150);
        });
    });

    describe('addDividendsBulk', () => {
        it('should create multiple dividends at once', async () => {
            const mockDividends = [
                {
                    assetId: 'asset1',
                    date: '2024-01-01',
                    amount: 100,
                    currency: 'JPY' as const,
                },
                {
                    assetId: 'asset2',
                    date: '2024-01-02',
                    amount: 200,
                    currency: 'USD' as const,
                },
            ];

            (prisma.dividend.createMany as jest.Mock).mockResolvedValue({ count: 2 });

            const result = await DividendService.addDividendsBulk(mockDividends);

            expect(prisma.dividend.createMany).toHaveBeenCalledWith({
                data: mockDividends,
            });
            expect(result.count).toBe(2);
        });
    });
});
