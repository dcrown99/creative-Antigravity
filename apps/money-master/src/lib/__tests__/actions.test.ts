/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from 'next/cache'
import * as AssetService from '@/services/asset.service'
import * as TransactionService from '@/services/transaction.service'
import * as SystemService from '@/services/system.service'
import {
    addAssetAction,
    updateAssetJson,
    deleteAssetAction,
    addTransactionAction,
    updateTransactionAction,
    deleteTransactionAction,
    triggerAnalysisAction,
} from '../actions'

// Mock the services
jest.mock('@/services/asset.service')
jest.mock('@/services/transaction.service')
jest.mock('@/services/system.service')
jest.mock('@/services/dividend.service')

const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>
const mockAssetService = AssetService as jest.Mocked<typeof AssetService>
const mockTransactionService = TransactionService as jest.Mocked<typeof TransactionService>
const mockSystemService = SystemService as jest.Mocked<typeof SystemService>

describe('Server Actions', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('addAssetAction', () => {
        it('should add asset and return success', async () => {
            const mockAssetData = {
                name: 'Test Stock',
                ticker: 'TEST',
                type: 'stock',
                quantity: 100,
                avgCost: 50,
                currency: 'USD',
            }

            mockAssetService.addAsset.mockResolvedValue({} as any)

            const result = await addAssetAction(mockAssetData)

            expect(mockAssetService.addAsset).toHaveBeenCalledWith(mockAssetData)
            expect(mockRevalidatePath).toHaveBeenCalledWith('/assets')
            expect(mockRevalidatePath).toHaveBeenCalledWith('/')
            expect(result).toEqual({ success: true })
        })

        it('should return error when adding asset fails', async () => {
            const mockAssetData = {
                name: 'Test Stock',
                ticker: 'TEST',
                type: 'stock',
                quantity: 100,
                avgCost: 50,
                currency: 'USD',
            }

            mockAssetService.addAsset.mockRejectedValue(new Error('Database error'))

            const result = await addAssetAction(mockAssetData)

            expect(result).toEqual({
                success: false,
                error: 'Failed to add asset',
            })
        })
    })

    describe('updateAssetJson', () => {
        it('should update asset and revalidate paths', async () => {
            const assetId = '1'
            const updateData = {
                quantity: 150,
                avgCost: 48,
            }

            mockAssetService.updateAsset.mockResolvedValue({} as any)

            const result = await updateAssetJson(assetId, updateData)

            expect(mockAssetService.updateAsset).toHaveBeenCalledWith(assetId, updateData)
            expect(mockRevalidatePath).toHaveBeenCalledWith('/assets')
            expect(result.success).toBe(true)
        })
    })

    describe('deleteAssetAction', () => {
        it('should delete asset successfully', async () => {
            const assetId = '1'

            mockAssetService.deleteAsset.mockResolvedValue({} as any)

            const result = await deleteAssetAction(assetId)

            expect(mockAssetService.deleteAsset).toHaveBeenCalledWith(assetId)
            expect(result.success).toBe(true)
        })
    })

    describe('addTransactionAction', () => {
        it('should parse FormData and create transaction', async () => {
            const formData = new FormData()
            formData.append('date', '2024-01-01')
            formData.append('amount', '1000')
            formData.append('type', 'income')
            formData.append('category', 'Salary')
            formData.append('description', 'Monthly salary')

            mockTransactionService.createTransaction.mockResolvedValue({} as any)

            const result = await addTransactionAction(formData)

            expect(mockTransactionService.createTransaction).toHaveBeenCalledWith({
                date: '2024-01-01',
                amount: 1000,
                type: 'income',
                category: 'Salary',
                description: 'Monthly salary',
                assetId: undefined,
            })
            expect(result.success).toBe(true)
        })

        it('should handle transaction creation error', async () => {
            const formData = new FormData()
            formData.append('date', '2024-01-01')
            formData.append('amount', '1000')
            formData.append('type', 'income')
            formData.append('category', 'Salary')

            mockTransactionService.createTransaction.mockRejectedValue(
                new Error('Database error')
            )

            const result = await addTransactionAction(formData)

            expect(result).toEqual({
                success: false,
                error: 'Failed to add transaction',
            })
        })
    })

    describe('updateTransactionAction', () => {
        it('should parse FormData and update transaction', async () => {
            const transactionId = '1'
            const formData = new FormData()
            formData.append('amount', '1500')
            formData.append('category', 'Bonus')

            mockTransactionService.updateTransaction.mockResolvedValue({} as any)

            const result = await updateTransactionAction(transactionId, formData)

            expect(mockTransactionService.updateTransaction).toHaveBeenCalledWith(
                transactionId,
                expect.objectContaining({
                    amount: 1500,
                    category: 'Bonus',
                })
            )
            expect(result.success).toBe(true)
        })
    })

    describe('deleteTransactionAction', () => {
        it('should delete transaction successfully', async () => {
            const transactionId = '1'

            mockTransactionService.deleteTransaction.mockResolvedValue({} as any)

            const result = await deleteTransactionAction(transactionId)

            expect(mockTransactionService.deleteTransaction).toHaveBeenCalledWith(transactionId)
            expect(result.success).toBe(true)
        })
    })

    describe('triggerAnalysisAction', () => {
        it('should call market-watcher API and save analysis', async () => {
            const mockPortfolio = {
                portfolio: {
                    assets: [],
                    dividends: [],
                },
                usdJpy: 150,
            }

            const mockAnalysisResult = {
                title: 'Market Analysis',
                summary: 'Test summary',
                script: 'Test script',
                sources: [],
            }

            mockAssetService.getPortfolioWithPrices.mockResolvedValue(mockPortfolio as any)
            mockSystemService.saveAnalysisLog.mockResolvedValue({} as any)

            // Mock fetch
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockAnalysisResult,
            }) as any

            const result = await triggerAnalysisAction()

            expect(mockAssetService.getPortfolioWithPrices).toHaveBeenCalled()
            expect(global.fetch).toHaveBeenCalledWith(
                'http://market-watcher:8000/analyze/daily',
                expect.any(Object)
            )
            expect(mockSystemService.saveAnalysisLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Market Analysis',
                    summary: 'Test summary',
                })
            )
            expect(result.success).toBe(true)
        })

        it('should handle market-watcher API error', async () => {
            mockAssetService.getPortfolioWithPrices.mockResolvedValue({
                portfolio: { assets: [], dividends: [] },
                usdJpy: 150,
            } as any)

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            }) as any

            const result = await triggerAnalysisAction()

            expect(result.success).toBe(false)
            expect(result.error).toContain('Market Watcher API failed')
        })
    })
})

describe('Dividend Actions', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('getDividends', () => {
        it('should fetch all dividends', async () => {
            const mockDividends = [
                { id: '1', assetId: 'asset1', date: '2024-01-01', amount: 100, currency: 'JPY', asset: { name: 'Test', ticker: 'TEST' } }
            ]

            jest.requireMock('@/services/dividend.service').getDividends = jest.fn().mockResolvedValue(mockDividends)
            const { getDividends } = await import('../actions')

            const result = await getDividends()
            expect(result).toEqual(mockDividends)
        })
    })

    describe('addDividend', () => {
        it('should add dividend and return success', async () => {
            const formData = new FormData()
            formData.append('assetId', 'asset1')
            formData.append('date', '2024-01-01')
            formData.append('amount', '100')
            formData.append('currency', 'JPY')

            jest.requireMock('@/services/dividend.service').addDividend = jest.fn().mockResolvedValue({})
            const { addDividend } = await import('../actions')

            const result = await addDividend(formData)
            expect(result.success).toBe(true)
        })
    })

    describe('deleteDividend', () => {
        it('should delete dividend successfully', async () => {
            jest.requireMock('@/services/dividend.service').deleteDividend = jest.fn().mockResolvedValue({})
            const { deleteDividend } = await import('../actions')

            const result = await deleteDividend('1')
            expect(result.success).toBe(true)
        })
    })
})

describe('System Actions', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('getHistory', () => {
        it('should fetch portfolio history', async () => {
            const mockHistory = [{ date: '2024-01-01', value: 10000 }]
            mockSystemService.getHistory.mockResolvedValue(mockHistory as any)

            const { getHistory } = await import('../actions')
            const result = await getHistory()

            expect(result).toEqual(mockHistory)
        })
    })

    describe('resetAllData', () => {
        it('should reset all data and revalidate paths', async () => {
            mockSystemService.resetAllData.mockResolvedValue(undefined as any)

            const { resetAllData } = await import('../actions')
            await resetAllData()

            expect(mockSystemService.resetAllData).toHaveBeenCalled()
            expect(mockRevalidatePath).toHaveBeenCalledWith('/')
            expect(mockRevalidatePath).toHaveBeenCalledWith('/assets')
        })
    })
})
