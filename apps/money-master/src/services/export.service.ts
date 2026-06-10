import { Asset } from '@/types';
import * as AssetService from './asset.service';
import { formatCurrency } from '@/lib/utils';

// Account type display names
const ACCOUNT_DISPLAY_NAMES: Record<string, string> = {
    nisa_growth: 'NISA成長',
    nisa_tsumitate: 'NISAつみたて',
    general: '一般',
    bank: '銀行',
    ideco: 'iDeCo',
    IDECO: 'iDeCo',
    TOKUTEI: '特定',
    NISA_GROWTH: 'NISA成長',
    NISA_TSUMITATE: 'NISAつみたて',
};

// Asset type display names and order
const TYPE_CONFIG: Record<string, { displayName: string; order: number }> = {
    JP_STOCK: { displayName: '日本株', order: 1 },
    US_STOCK: { displayName: '米国株', order: 2 },
    ETF: { displayName: 'ETF', order: 3 },
    TRUST: { displayName: '投資信託', order: 4 },
    bank: { displayName: '銀行', order: 5 },
    cash: { displayName: '現金', order: 6 },
    credit: { displayName: 'クレジット', order: 7 },
    other: { displayName: 'その他', order: 8 },
};

function getAccountDisplayName(account: string | null | undefined): string {
    if (!account) return '-';
    return ACCOUNT_DISPLAY_NAMES[account] || account;
}

function getTypeDisplayName(type: string): string {
    return TYPE_CONFIG[type]?.displayName || type;
}

function getTypeOrder(type: string): number {
    return TYPE_CONFIG[type]?.order || 99;
}

function calculateValue(asset: Asset, usdJpy: number): number {
    if (asset.type === 'bank' || asset.type === 'cash') {
        return asset.balance || 0;
    }

    const price = asset.currentPrice || asset.manualPrice || asset.avgCost || 0;
    const quantity = asset.quantity || 0;
    const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;
    const value = price * actualQuantity;

    return asset.currency === 'USD' ? value * usdJpy : value;
}

function calculateCost(asset: Asset, usdJpy: number): number {
    if (asset.type === 'bank' || asset.type === 'cash') {
        return asset.balance || 0;
    }

    const quantity = asset.quantity || 0;
    const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;
    const cost = (asset.avgCost || 0) * actualQuantity;

    return asset.currency === 'USD' ? cost * usdJpy : cost;
}

function calculateAnnualDividend(asset: Asset, usdJpy: number): number {
    if (!asset.dividendRate || !asset.quantity) return 0;

    const quantity = asset.quantity;
    const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;
    const dividend = asset.dividendRate * actualQuantity;

    return asset.currency === 'USD' ? dividend * usdJpy : dividend;
}

function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatGain(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${formatCurrency(value)}`;
}

export function generateMarkdownExport(assets: Asset[], usdJpy: number): string {
    const today = new Date().toISOString().split('T')[0];
    const lines: string[] = [];

    // Header
    lines.push('# 保有資産一覧');
    lines.push(`エクスポート日: ${today}`);
    lines.push('');

    // Calculate totals
    let totalValue = 0;
    let totalCost = 0;

    for (const asset of assets) {
        totalValue += calculateValue(asset, usdJpy);
        totalCost += calculateCost(asset, usdJpy);
    }

    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? totalGain / totalCost : 0;

    // Summary table
    lines.push('## サマリー');
    lines.push('| 項目 | 金額 |');
    lines.push('|:---|---:|');
    lines.push(`| 総資産 | ${formatCurrency(totalValue)} |`);
    lines.push(`| 総コスト | ${formatCurrency(totalCost)} |`);
    lines.push(`| 総損益 | ${formatGain(totalGain)} (${formatPercent(totalGainPercent)}) |`);
    lines.push('');

    // Group assets by type
    const grouped: Record<string, Asset[]> = {};

    for (const asset of assets) {
        const type = asset.type;
        if (!grouped[type]) {
            grouped[type] = [];
        }
        grouped[type].push(asset);
    }

    // Sort groups by type order, and assets within each group by value descending
    const sortedTypes = Object.keys(grouped).sort((a, b) => getTypeOrder(a) - getTypeOrder(b));

    for (const type of sortedTypes) {
        const typeAssets = grouped[type].sort((a, b) => calculateValue(b, usdJpy) - calculateValue(a, usdJpy));
        const typeName = getTypeDisplayName(type);
        const count = typeAssets.length;

        lines.push(`## ${typeName} (${count}銘柄)`);
        lines.push('');

        for (const asset of typeAssets) {
            const value = calculateValue(asset, usdJpy);
            const cost = calculateCost(asset, usdJpy);
            const gain = value - cost;
            const gainPercent = cost > 0 ? gain / cost : 0;

            // Asset header
            const ticker = asset.ticker ? ` (${asset.ticker})` : '';
            lines.push(`### ${asset.name}${ticker}`);

            // Details differ by asset type
            if (asset.type === 'bank' || asset.type === 'cash') {
                lines.push(`- 残高: ${formatCurrency(value)}`);
            } else {
                const account = getAccountDisplayName(asset.account);
                lines.push(`- 口座: ${account}`);
                lines.push(`- 保有: ${asset.quantity?.toLocaleString() || 0}${asset.type === 'TRUST' ? '口' : '株'}`);

                const priceDisplay = asset.currentPrice
                    ? `${formatCurrency(asset.avgCost || 0, asset.currency)} → ${formatCurrency(asset.currentPrice, asset.currency)}`
                    : `${formatCurrency(asset.avgCost || 0, asset.currency)}`;
                lines.push(`- 単価: ${priceDisplay}`);

                lines.push(`- 評価額: ${formatCurrency(value)} | 損益: ${formatGain(gain)} (${formatPercent(gainPercent)})`);

                // Dividend info
                const annualDividend = calculateAnnualDividend(asset, usdJpy);
                if (annualDividend > 0 && asset.dividendYield) {
                    lines.push(`- 年間配当: ${formatCurrency(annualDividend)} (利回り ${(asset.dividendYield * 100).toFixed(1)}%)`);
                }
            }

            lines.push('');
        }
    }

    return lines.join('\n');
}

/**
 * Export all active assets as Markdown
 */
export async function exportAssets(): Promise<string> {
    const { portfolio, usdJpy } = await AssetService.getPortfolioWithPrices();
    const activeAssets = portfolio.assets.filter(a => !a.isArchived);
    return generateMarkdownExport(activeAssets, usdJpy);
}
