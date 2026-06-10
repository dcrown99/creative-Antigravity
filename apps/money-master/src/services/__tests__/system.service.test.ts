import { prisma } from '@/lib/prisma';
import * as SystemService from '../system.service';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        analysisLog: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
    },
}));

describe('SystemService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAnalysisLogs', () => {
        it('should fetch and parse analysis logs', async () => {
            const mockLogs = [
                {
                    id: '1',
                    date: '2024-01-01',
                    title: 'Test Analysis',
                    summary: 'Summary',
                    script: 'Script',
                    sources: ['source1'] as any,
                },
            ];

            (prisma.analysisLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

            const result = await SystemService.getAnalysisLogs();

            expect(prisma.analysisLog.findMany).toHaveBeenCalledWith({
                orderBy: { date: 'desc' },
            });
            expect(result[0].sources).toEqual(['source1']);
        });
    });

    describe('saveAnalysisLog', () => {
        it('should save analysis log', async () => {
            const logData = {
                date: '2024-01-01',
                title: 'Test Analysis',
                summary: 'Summary',
                script: 'Script',
                sources: ['source1'] as any,
            };

            const mockCreated = {
                id: '1',
                ...logData,
                sources: JSON.stringify(logData.sources),
            };

            (prisma.analysisLog.create as jest.Mock).mockResolvedValue(mockCreated);

            const result = await SystemService.saveAnalysisLog(logData);

            expect(prisma.analysisLog.create).toHaveBeenCalledWith({
                data: {
                    ...logData,
                    sources: JSON.stringify(logData.sources),
                },
            });
            expect(result.sources).toEqual(['source1']);
        });
    });

    // Placeholder tests
    describe('placeholders', () => {
        it('getHistory should return empty array', async () => {
            expect(await SystemService.getHistory()).toEqual([]);
        });
        it('getCategoryRules should return empty array', async () => {
            expect(await SystemService.getCategoryRules()).toEqual([]);
        });
        it('saveCategoryRules should resolve', async () => {
            await expect(SystemService.saveCategoryRules([])).resolves.toBeUndefined();
        });
        it('resetAllData should resolve', async () => {
            await expect(SystemService.resetAllData()).resolves.toBeUndefined();
        });
    });
});
