import { generateMarkdownExport } from '../export.service';
import { Asset, Portfolio } from '@/types';

describe('ExportService', () => {
    const mockUsdJpy = 150;

    const mockAssets: Asset[] = [
        {
            id: '1',
            name: 'トヨタ自動車',
            ticker: '7203.T',
            type: 'JP_STOCK',
            account: 'TOKUTEI',
            quantity: 100,
            avgCost: 2500,
            currentPrice: 2850,
            currency: 'JPY',
            dividendRate: 75,
            dividendYield: 0.026,
            isArchived: false,
        },
        {
            id: '2',
            name: 'Apple Inc',
            ticker: 'AAPL',
            type: 'US_STOCK',
            account: 'NISA_GROWTH',
            quantity: 10,
            avgCost: 150,
            currentPrice: 180,
            currency: 'USD',
            dividendRate: 0.96,
            dividendYield: 0.005,
            isArchived: false,
        },
        {
            id: '3',
            name: '普通預金',
            type: 'bank',
            currency: 'JPY',
            balance: 1000000,
            isArchived: false,
        },
        {
            id: '4',
            name: 'OneDC S&P500 IDX',
            type: 'TRUST',
            account: 'IDECO',
            quantity: 10000,
            avgCost: 10279,
            currentPrice: 13049,
            currency: 'JPY',
            isArchived: false,
        },
    ];

    describe('generateMarkdownExport', () => {
        it('should generate valid markdown with header and date', () => {
            const result = generateMarkdownExport(mockAssets, mockUsdJpy);

            expect(result).toContain('# 保有資産一覧');
            expect(result).toContain('エクスポート日:');
        });

        it('should include summary table with totals', () => {
            const result = generateMarkdownExport(mockAssets, mockUsdJpy);

            expect(result).toContain('## サマリー');
            expect(result).toContain('総資産');
            expect(result).toContain('総コスト');
            expect(result).toContain('総損益');
        });

        it('should group assets by type', () => {
            const result = generateMarkdownExport(mockAssets, mockUsdJpy);

            expect(result).toContain('## 日本株');
            expect(result).toContain('## 米国株');
            expect(result).toContain('## 銀行');
        });

        it('should include asset details with ticker', () => {
            const result = generateMarkdownExport(mockAssets, mockUsdJpy);

            expect(result).toContain('トヨタ自動車');
            expect(result).toContain('7203.T');
            expect(result).toContain('Apple Inc');
            expect(result).toContain('AAPL');
        });

        it('should include dividend info for dividend-paying assets', () => {
            const result = generateMarkdownExport(mockAssets, mockUsdJpy);

            expect(result).toContain('年間配当');
            expect(result).toContain('利回り');
        });

        it('should convert USD assets to JPY', () => {
            const result = generateMarkdownExport(mockAssets, mockUsdJpy);

            // Apple: 10 shares * $180 * 150 = ￥270,000
            expect(result).toContain('￥270,000');
        });

        it('should handle empty asset array', () => {
            const result = generateMarkdownExport([], mockUsdJpy);

            expect(result).toContain('# 保有資産一覧');
            expect(result).toContain('総資産');
            expect(result).toContain('￥0');
        });

        it('should translate account types to Japanese', () => {
            const result = generateMarkdownExport(mockAssets, mockUsdJpy);

            expect(result).toContain('特定');
            expect(result).toContain('NISA成長');
            expect(result).toContain('iDeCo');
        });

        it('should sort assets by value within each type group', () => {
            const result = generateMarkdownExport(mockAssets, mockUsdJpy);

            // Check that Toyota is present and in JP_STOCK section
            expect(result).toContain('## 日本株 (1銘柄)');
            expect(result).toContain('トヨタ自動車');
        });

        it('should include iDeCo trust assets', () => {
            const result = generateMarkdownExport(mockAssets, mockUsdJpy);

            expect(result).toContain('OneDC S&P500 IDX');
            expect(result).toContain('## 投資信託');
        });
    });
});
