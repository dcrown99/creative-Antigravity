import { prisma } from '@/lib/prisma'
import * as AssetService from '../asset.service'
import { Asset } from '@/types'

// Type assertion for mocked prisma
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('AssetService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('addAsset', () => {
        it('should create a new asset successfully', async () => {
            const mockAssetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> = {
                name: 'Test Stock',
                ticker: 'TEST',
                type: 'STOCK' as any,
                quantity: 100,
                avgCost: 50,
                currency: 'USD',
                currentPrice: 55,
                dividendRate: 0,
                dividendYield: 0,
                isArchived: false,
                balance: 0,
                manualPrice: null,
            }

            const mockCreatedAsset = {
                id: '1',
                ...mockAssetData,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

                ; (mockPrisma.asset.create as jest.Mock).mockResolvedValue(mockCreatedAsset as any)

            const result = await AssetService.addAsset(mockAssetData)

            expect(mockPrisma.asset.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    name: 'Test Stock',
                    ticker: 'TEST',
                    type: 'STOCK',
                }),
            })
            expect(result).toEqual(mockCreatedAsset)
        })
    })

    describe('updateAsset', () => {
        it('should update an existing asset', async () => {
            const assetId = '1'
            const updateData: Partial<Asset> = {
                quantity: 150,
                avgCost: 48,
            }

            const mockUpdatedAsset = {
                id: assetId,
                name: 'Test Stock',
                ticker: 'TEST',
                type: 'STOCK',
                quantity: 150,
                avgCost: 48,
                currency: 'USD',
                currentPrice: 55,
                dividendRate: 0,
                dividendYield: 0,
                isArchived: false,
                balance: 0,
                manualPrice: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

                ; (mockPrisma.asset.update as jest.Mock).mockResolvedValue(mockUpdatedAsset as any)

            const result = await AssetService.updateAsset(assetId, updateData)

            expect(mockPrisma.asset.update).toHaveBeenCalledWith({
                where: { id: assetId },
                data: expect.objectContaining({
                    quantity: 150,
                    avgCost: 48,
                }),
            })
            expect(result).toEqual(mockUpdatedAsset)
        })
    })

    describe('deleteAsset', () => {
        it('should delete an asset by id', async () => {
            const assetId = '1'
            const mockDeletedAsset = {
                id: assetId,
                name: 'Test Stock',
            }

                ; (mockPrisma.dividend.deleteMany as jest.Mock).mockResolvedValue({ count: 0 } as any)
                ; (mockPrisma.transaction.updateMany as jest.Mock).mockResolvedValue({ count: 0 } as any)
                ; (mockPrisma.asset.delete as jest.Mock).mockResolvedValue(mockDeletedAsset as any)

            const result = await AssetService.deleteAsset(assetId)

            expect(mockPrisma.dividend.deleteMany).toHaveBeenCalledWith({
                where: { assetId: assetId },
            })
            expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
                where: { assetId: assetId },
                data: { assetId: null },
            })
            expect(mockPrisma.asset.delete).toHaveBeenCalledWith({
                where: { id: assetId },
            })
            expect(result).toEqual(mockDeletedAsset)
        })
    })

    describe('getAsset', () => {
        it('should return an asset if found', async () => {
            const assetId = '1'
            const mockAsset = {
                id: assetId,
                name: 'Test Stock',
                ticker: 'TEST',
                type: 'stock',
                quantity: 100,
                avgCost: 50,
                currency: 'USD',
                currentPrice: 55,
                dividendRate: 0,
                dividendYield: 0,
                isArchived: false,
                balance: 0,
                manualPrice: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

                ; (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue(mockAsset as any)

            const result = await AssetService.getAsset(assetId)

            expect(mockPrisma.asset.findUnique).toHaveBeenCalledWith({
                where: { id: assetId },
            })
            expect(result).toBeTruthy()
            expect(result?.id).toBe(assetId)
        })

        it('should return null if asset not found', async () => {
            const assetId = 'non-existent'

                ; (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue(null)

            const result = await AssetService.getAsset(assetId)

            expect(result).toBeNull()
        })
    })

    describe('updateAllAssetPrices', () => {
        it('should update prices for multiple assets concurrently', async () => {
            const mockAssets = [
                {
                    id: '1',
                    ticker: 'AAPL',
                    name: 'Apple',
                    type: 'STOCK',
                    quantity: 10,
                    avgCost: 150,
                    currency: 'USD',
                    currentPrice: 170,
                    isArchived: false,
                },
                {
                    id: '2',
                    ticker: 'GOOGL',
                    name: 'Google',
                    type: 'STOCK',
                    quantity: 5,
                    avgCost: 2500,
                    currency: 'USD',
                    currentPrice: 2700,
                    isArchived: false,
                },
            ]

                ; (mockPrisma.asset.findMany as jest.Mock).mockResolvedValue(mockAssets as any)
                ; (mockPrisma.asset.update as jest.Mock).mockResolvedValue({} as any)

            // Mock getStockInfo to return successful price data
            jest.mock('@/services/stock.service', () => ({
                getStockInfo: jest.fn().mockResolvedValue({
                    success: true,
                    price: 175,
                    dividendRate: 0.5,
                    dividendYield: 0.01,
                }),
            }))

            const result = await AssetService.updateAllAssetPrices()

            expect(mockPrisma.asset.findMany).toHaveBeenCalled()
            expect(result).toHaveProperty('updated')
            expect(result).toHaveProperty('failed')
        })
    })
})
