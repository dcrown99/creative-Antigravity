"use client";

import { useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@repo/ui";
import { Asset } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface DividendAssetSummaryProps {
    assets: Asset[];
    usdJpy: number;
}

export function DividendAssetSummary({ assets, usdJpy }: DividendAssetSummaryProps) {
    const dividendAssets = useMemo(() => {
        return assets
            .filter((asset) =>
                !asset.isArchived &&
                (asset.dividendRate || asset.dividendYield) &&
                asset.quantity && asset.quantity > 0
            )
            .map((asset) => {
                const currentPrice = asset.currentPrice || asset.manualPrice || asset.avgCost || 0;
                const quantity = asset.quantity || 0;

                // For mutual funds (TRUST), price is per 10000 units
                const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;
                let marketValue = currentPrice * actualQuantity;

                // Convert USD market value to JPY
                if (asset.currency === 'USD') {
                    marketValue = marketValue * usdJpy;
                }

                // Calculate annual dividend amount
                let annualDividend = asset.dividendRate ? asset.dividendRate * quantity : 0;

                // Convert USD dividends to JPY
                if (asset.currency === 'USD' && annualDividend > 0) {
                    annualDividend = annualDividend * usdJpy;
                }

                // Calculate dividend yield
                // dividendYield is stored as decimal (0.0287 = 2.87%), so multiply by 100
                let yieldRate = asset.dividendYield ? asset.dividendYield * 100 : 0;
                if (!yieldRate && annualDividend && marketValue) {
                    yieldRate = (annualDividend / marketValue) * 100;
                }

                // Parse dividend month from nextDividendDate (format: YYYY-MM-DD)
                let dividendMonth = '-';
                if (asset.nextDividendDate) {
                    try {
                        const date = new Date(asset.nextDividendDate);
                        dividendMonth = `${date.getMonth() + 1}月`;
                    } catch {
                        dividendMonth = '-';
                    }
                }

                return {
                    ...asset,
                    marketValue,
                    annualDividend,
                    yieldRate,
                    dividendMonth,
                };
            })
            .sort((a, b) => b.yieldRate - a.yieldRate); // Sort by yield descending
    }, [assets, usdJpy]);

    if (dividendAssets.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>配当資産サマリー</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>銘柄</TableHead>
                            <TableHead className="text-right">保有数</TableHead>
                            <TableHead className="text-right">評価額</TableHead>
                            <TableHead className="text-center">配当月</TableHead>
                            <TableHead className="text-right">年間配当金</TableHead>
                            <TableHead className="text-right">配当利回り</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dividendAssets.map((asset) => (
                            <TableRow key={asset.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{asset.ticker || '-'}</span>
                                        <span className="text-xs text-muted-foreground">{asset.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    {asset.quantity?.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(asset.marketValue)}
                                </TableCell>
                                <TableCell className="text-center">
                                    {asset.dividendMonth}
                                </TableCell>
                                <TableCell className="text-right text-green-600 font-medium">
                                    {asset.annualDividend > 0
                                        ? `+${formatCurrency(asset.annualDividend)}`
                                        : '-'}
                                </TableCell>
                                <TableCell className="text-right font-bold text-green-700">
                                    {asset.yieldRate > 0
                                        ? `${asset.yieldRate.toFixed(2)}%`
                                        : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={4} className="text-right">合計</TableCell>
                            <TableCell className="text-right text-green-600">
                                +{formatCurrency(dividendAssets.reduce((sum, a) => sum + a.annualDividend, 0))}
                            </TableCell>
                            <TableCell className="text-right text-green-700">
                                {dividendAssets.length > 0
                                    ? `${(
                                        dividendAssets.reduce((sum, a) => sum + a.annualDividend, 0) /
                                        dividendAssets.reduce((sum, a) => sum + a.marketValue, 0) * 100
                                    ).toFixed(2)}%`
                                    : '-'}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
