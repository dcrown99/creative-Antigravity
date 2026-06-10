'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger, TabsContent } from '@repo/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { Asset } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface SectorPerformanceChartProps {
    assets: Asset[];
    usdJpy: number;
}

interface SectorData {
    sector: string;
    sectorLabel: string;
    totalValue: number;
    totalCost: number;
    profit: number;
    profitPercent: number;
    percent: number;  // ポートフォリオに占める割合
    assetCount: number;
}

// セクター（タイプ）ラベル - types/index.tsのAssetTypeに対応
const TYPE_LABELS: Record<string, string> = {
    'JP_STOCK': '日本株',
    'US_STOCK': '米国株',
    'STOCK': '個別株',
    'TRUST': '投資信託',
    'ETF': 'ETF',
    'CRYPTO': '暗号資産',
    'CASH': '現金',
    'BANK': '銀行口座',
    'CREDIT': 'クレジット',
    'BOND': '債券',
    'OTHER': 'その他',
};

// セクターごとの色
const SECTOR_COLORS: Record<string, string> = {
    'JP_STOCK': '#f97316',    // オレンジ
    'US_STOCK': '#3b82f6',    // 青
    'STOCK': '#adfa1d',       // 明るい緑
    'TRUST': '#10b981',       // エメラルド
    'ETF': '#34d399',         // 薄い緑
    'CRYPTO': '#f59e0b',      // 黄色
    'CASH': '#60a5fa',        // 水色
    'BANK': '#8b5cf6',        // 紫
    'CREDIT': '#ec4899',      // ピンク
    'BOND': '#a855f7',        // 薄紫
    'OTHER': '#9ca3af',       // グレー
};

// 口座ラベル
const ACCOUNT_LABELS: Record<string, string> = {
    'NISA_GROWTH': 'NISA成長投資枠',
    'NISA_TSUMITATE': 'NISAつみたて投資枠',
    'TOKUTEI': '特定口座',
    'IDECO': 'iDeCo',
    'NISA': 'NISA口座',
    'BANK_ACCOUNT': '銀行口座',
    'Unknown': '不明',
};

// 口座ごとの色
const ACCOUNT_COLORS: Record<string, string> = {
    'NISA_GROWTH': '#3b82f6',    // 青
    'NISA_TSUMITATE': '#10b981', // エメラルド
    'TOKUTEI': '#f97316',        // オレンジ
    'IDECO': '#8b5cf6',          // 紫
    'NISA': '#60a5fa',           // 水色
    'BANK_ACCOUNT': '#6b7280',   // グレー
    'Unknown': '#9ca3af',        // 薄グレー
};


export function SectorPerformanceChart({ assets, usdJpy }: SectorPerformanceChartProps) {
    // セクター別データを計算
    const sectorData = useMemo(() => {
        const sectorMap = new Map<string, SectorData>();

        assets.forEach(asset => {
            const sector = asset.type.toUpperCase();

            let currentValue = 0;
            let cost = 0;

            // bank/cashタイプはbalanceを使用（損益なし）
            if (asset.type === 'bank' || asset.type === 'cash') {
                currentValue = asset.balance || 0;
                cost = currentValue; // 損益は0
            } else {
                // 株式、ETF、投資信託の場合
                const price = asset.currentPrice || asset.manualPrice || asset.avgCost || 0;
                const avgCost = asset.avgCost || 0;
                const quantity = asset.quantity || 0;
                // 投資信託(TRUST)はpriceが1万口あたり
                const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;

                currentValue = price * actualQuantity;
                cost = avgCost * actualQuantity;

                // USD→JPY変換
                if (asset.currency === 'USD') {
                    currentValue *= usdJpy;
                    cost *= usdJpy;
                }
            }

            const existing = sectorMap.get(sector) || {
                sector,
                sectorLabel: TYPE_LABELS[sector] || sector,
                totalValue: 0,
                totalCost: 0,
                profit: 0,
                profitPercent: 0,
                percent: 0,
                assetCount: 0,
            };

            existing.totalValue += currentValue;
            existing.totalCost += cost;
            existing.assetCount += 1;

            sectorMap.set(sector, existing);
        });

        // 損益と割合を計算
        const result: SectorData[] = [];
        const grandTotal = Array.from(sectorMap.values()).reduce((sum, d) => sum + d.totalValue, 0);
        sectorMap.forEach(data => {
            data.profit = data.totalValue - data.totalCost;
            data.profitPercent = data.totalCost > 0
                ? ((data.totalValue - data.totalCost) / data.totalCost) * 100
                : 0;
            data.percent = grandTotal > 0 ? (data.totalValue / grandTotal) * 100 : 0;
            result.push(data);
        });

        // 金額順でソート
        return result.sort((a, b) => b.totalValue - a.totalValue);
    }, [assets, usdJpy]);

    // 口座別データを計算
    const accountData = useMemo(() => {
        const accountMap = new Map<string, SectorData>();

        assets.forEach(asset => {
            // bank/cash タイプで account が空の場合は「銀行口座」として扱う
            let account = asset.account || 'Unknown';
            if (!asset.account && (asset.type === 'bank' || asset.type === 'cash')) {
                account = 'BANK_ACCOUNT';
            }

            let currentValue = 0;
            let cost = 0;

            // bank/cashタイプはbalanceを使用（損益なし）
            if (asset.type === 'bank' || asset.type === 'cash') {
                currentValue = asset.balance || 0;
                cost = currentValue;
            } else {
                const price = asset.currentPrice || asset.manualPrice || asset.avgCost || 0;
                const avgCost = asset.avgCost || 0;
                const quantity = asset.quantity || 0;
                const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;

                currentValue = price * actualQuantity;
                cost = avgCost * actualQuantity;

                if (asset.currency === 'USD') {
                    currentValue *= usdJpy;
                    cost *= usdJpy;
                }
            }

            const existing = accountMap.get(account) || {
                sector: account,
                sectorLabel: ACCOUNT_LABELS[account] || account,
                totalValue: 0,
                totalCost: 0,
                profit: 0,
                profitPercent: 0,
                percent: 0,
                assetCount: 0,
            };

            existing.totalValue += currentValue;
            existing.totalCost += cost;
            existing.assetCount += 1;

            accountMap.set(account, existing);
        });

        const result: SectorData[] = [];
        const grandTotal = Array.from(accountMap.values()).reduce((sum, d) => sum + d.totalValue, 0);
        accountMap.forEach(data => {
            data.profit = data.totalValue - data.totalCost;
            data.profitPercent = data.totalCost > 0
                ? ((data.totalValue - data.totalCost) / data.totalCost) * 100
                : 0;
            data.percent = grandTotal > 0 ? (data.totalValue / grandTotal) * 100 : 0;
            result.push(data);
        });

        return result.sort((a, b) => b.totalValue - a.totalValue);
    }, [assets, usdJpy]);

    // カスタムツールチップ
    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: SectorData }[] }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-background border rounded-lg p-3 shadow-lg">
                    <p className="font-medium">{data.sectorLabel}</p>
                    <p className="text-sm">評価額: {formatCurrency(data.totalValue)}</p>
                    <p className="text-sm">取得額: {formatCurrency(data.totalCost)}</p>
                    <p className={`text-sm ${data.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        損益: {data.profit >= 0 ? '+' : ''}{formatCurrency(data.profit)} ({data.profitPercent.toFixed(1)}%)
                    </p>
                    <p className="text-xs text-muted-foreground">{data.assetCount}銘柄</p>
                </div>
            );
        }
        return null;
    };

    // 総合損益
    const totalProfit = sectorData.reduce((sum, d) => sum + d.profit, 0);
    const totalCost = sectorData.reduce((sum, d) => sum + d.totalCost, 0);
    const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <PieChart className="w-5 h-5" />
                        セクター別パフォーマンス
                    </CardTitle>
                    <div className={`flex items-center gap-1 text-sm ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {totalProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span>全体: {totalProfit >= 0 ? '+' : ''}{totalProfitPercent.toFixed(1)}%</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="type" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="type">種類別</TabsTrigger>
                        <TabsTrigger value="account">口座別</TabsTrigger>
                    </TabsList>
                    <TabsContent value="type">
                        {sectorData.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">資産データがありません</p>
                        ) : (
                            <>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sectorData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                            <XAxis
                                                type="number"
                                                domain={[0, 100]}
                                                tickFormatter={(value) => `${value}%`}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="sectorLabel"
                                                width={80}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
                                                {sectorData.map((entry) => (
                                                    <Cell
                                                        key={entry.sector}
                                                        fill={SECTOR_COLORS[entry.sector] || '#9ca3af'}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-4 space-y-2">
                                    {sectorData.map(sector => (
                                        <div key={sector.sector} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: SECTOR_COLORS[sector.sector] || '#9ca3af' }}
                                                />
                                                <span>{sector.sectorLabel}</span>
                                                <span className="text-muted-foreground">({sector.assetCount})</span>
                                            </div>
                                            <span className={sector.profit >= 0 ? 'text-green-600' : 'text-red-500'}>
                                                {sector.profit >= 0 ? '+' : ''}{sector.profitPercent.toFixed(1)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </TabsContent>
                    <TabsContent value="account">
                        {accountData.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">資産データがありません</p>
                        ) : (
                            <>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={accountData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                                            <XAxis
                                                type="number"
                                                domain={[0, 100]}
                                                tickFormatter={(value) => `${value}%`}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="sectorLabel"
                                                width={100}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
                                                {accountData.map((entry) => (
                                                    <Cell
                                                        key={entry.sector}
                                                        fill={ACCOUNT_COLORS[entry.sector] || '#9ca3af'}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-4 space-y-2">
                                    {accountData.map(account => (
                                        <div key={account.sector} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: ACCOUNT_COLORS[account.sector] || '#9ca3af' }}
                                                />
                                                <span>{account.sectorLabel}</span>
                                                <span className="text-muted-foreground">({account.assetCount})</span>
                                            </div>
                                            <span className={account.profit >= 0 ? 'text-green-600' : 'text-red-500'}>
                                                {account.profit >= 0 ? '+' : ''}{account.profitPercent.toFixed(1)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
