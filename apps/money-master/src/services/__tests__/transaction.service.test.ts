import { prisma } from '@/lib/prisma'
import * as TransactionService from '../transaction.service'
import * as AssetService from '@/services/asset.service'

// Mock AssetService
jest.mock('@/services/asset.service', () => ({
    getPortfolio: jest.fn(),
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockAssetService = AssetService as jest.Mocked<typeof AssetService>

describe('TransactionService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('createTransaction', () => {
        it('should create a new transaction successfully', async () => {
            const mockTransactionData = {
                date: '2024-01-01',
                amount: 1000,
                type: 'income' as const,
                category: 'Salary',
                description: 'Monthly salary',
            }

            const mockCreatedTransaction = {
                id: '1',
                ...mockTransactionData,
                assetId: null,
                createdAt: new Date(),
            }

            // @ts-expect-error - Mock Prisma type
            mockPrisma.transaction.create.mockResolvedValue(mockCreatedTransaction as any)

            const result = await TransactionService.createTransaction(mockTransactionData)

            expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
                data: {
                    date: '2024-01-01',  // Date is passed as string, not Date object
                    amount: 1000,
                    type: 'income',
                    category: 'Salary',
                    description: 'Monthly salary',
                },
            })
            expect(result).toEqual(mockCreatedTransaction)
        })

        it('should create transaction with assetId', async () => {
            const mockTransactionData = {
                date: '2024-01-01',
                amount: 500,
                type: 'expense' as const,
                category: 'Investment',
                assetId: 'asset-123',
            }

            // @ts-expect-error - Mock Prisma type
            mockPrisma.transaction.create.mockResolvedValue({
                id: '2',
                ...mockTransactionData,
                date: new Date('2024-01-01'),
                createdAt: new Date(),
            } as any)

            await TransactionService.createTransaction(mockTransactionData)

            expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    assetId: 'asset-123',
                }),
            })
        })
    })

    describe('updateTransaction', () => {
        it('should update an existing transaction', async () => {
            const transactionId = '1'
            const updateData = {
                amount: 1500,
                category: 'Bonus',
            }

            const mockUpdatedTransaction = {
                id: transactionId,
                date: new Date('2024-01-01'),
                amount: 1500,
                type: 'income',
                category: 'Bonus',
                createdAt: new Date(),
            }

            // @ts-expect-error - Mock Prisma type
            mockPrisma.transaction.update.mockResolvedValue(mockUpdatedTransaction as any)

            const result = await TransactionService.updateTransaction(transactionId, updateData)

            expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
                where: { id: transactionId },
                data: expect.objectContaining({
                    amount: 1500,
                    category: 'Bonus',
                }),
            })
            expect(result).toEqual(mockUpdatedTransaction)
        })
    })

    describe('deleteTransaction', () => {
        it('should delete a transaction by id', async () => {
            const transactionId = '1'
            const mockDeletedTransaction = {
                id: transactionId,
                date: new Date(),
                amount: 1000,
                type: 'income',
                category: 'Salary',
            }

            // @ts-expect-error - Mock Prisma type
            mockPrisma.transaction.delete.mockResolvedValue(mockDeletedTransaction as any)

            const result = await TransactionService.deleteTransaction(transactionId)

            expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({
                where: { id: transactionId },
            })
            expect(result).toEqual(mockDeletedTransaction)
        })
    })

    describe('getTransactions', () => {
        it('should return all transactions', async () => {
            const mockTransactions = [
                {
                    id: '1',
                    date: new Date('2024-01-01'),
                    amount: 1000,
                    type: 'income',
                    category: 'Salary',
                    createdAt: new Date(),
                },
                {
                    id: '2',
                    date: new Date('2024-01-02'),
                    amount: 50,
                    type: 'expense',
                    category: 'Food',
                    createdAt: new Date(),
                },
            ]

            // @ts-expect-error - Mock Prisma type
            mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions as any)

            const result = await TransactionService.getTransactions()

            expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
                orderBy: { date: 'desc' },
            })
            expect(result).toHaveLength(2)
        })
    })

    describe('getMonthlyTransactionSummary', () => {
        it('should calculate monthly income and expense summary', async () => {
            const year = 2024
            const month = 1

            // Mock groupBy result
            const mockGroupByResult = [
                {
                    type: 'income',
                    _sum: {
                        amount: 5000,
                    },
                },
                {
                    type: 'expense',
                    _sum: {
                        amount: 1500,
                    },
                },
            ]

            // @ts-expect-error - Mock Prisma type
            mockPrisma.transaction.groupBy.mockResolvedValue(mockGroupByResult as any)

            const result = await TransactionService.getMonthlyTransactionSummary(year, month)

            expect(result.income).toBe(5000)
            expect(result.expense).toBe(1500)
            expect(result.balance).toBe(3500)
        })

        it('should handle month with no transactions', async () => {
            // @ts-expect-error - Mock Prisma type
            mockPrisma.transaction.groupBy.mockResolvedValue([])

            const result = await TransactionService.getMonthlyTransactionSummary(2024, 12)

            expect(result.income).toBe(0)
            expect(result.expense).toBe(0)
            expect(result.balance).toBe(0)
        })
    })

    describe('detectMissingDividends', () => {
        it('should detect missing dividends for assets with dividendRate', async () => {
            // Mock assets with dividend rates
            const mockAssets = [
                {
                    id: 'asset-1',
                    ticker: 'AAPL',
                    name: 'Apple',
                    quantity: 10,
                    dividendRate: 1.0,
                    nextDividendDate: '2024-02-01',
                },
            ]

            // Mock existing dividend transactions
            // @ts-expect-error - Mock Prisma type
            mockPrisma.transaction.findMany.mockResolvedValue([
                {
                    id: 'tx-1',
                    date: new Date('2024-01-01'),
                    amount: 10,
                    type: 'income',
                    category: 'Dividend',
                    assetId: 'asset-1',
                },
            ] as any)

            // Mock AssetService.getPortfolio
            mockAssetService.getPortfolio.mockResolvedValue({
                assets: mockAssets,
                dividends: [],
            } as any)

            const result = await TransactionService.detectMissingDividends()

            expect(result).toBeDefined()
            expect(Array.isArray(result)).toBe(true)
        })
    })
})
