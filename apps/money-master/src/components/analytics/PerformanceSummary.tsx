'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { HistoryEntry } from "@/services/analytics.service";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PerformanceSummaryProps {
    history: HistoryEntry[];
    currentTotalValue?: number;
}

export function PerformanceSummary({ history, currentTotalValue }: PerformanceSummaryProps) {
    if (!history || history.length === 0) return null;

    // Use live value if available, otherwise fallback to history
    const current = currentTotalValue !== undefined ? currentTotalValue : history[history.length - 1].totalValue;
    const start = history[0].totalValue;
    const change = current - start;
    const changePercent = start !== 0 ? (change / start) * 100 : 0;
    const isPositive = change >= 0;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">総資産額</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(current)}</div>
                    <p className="text-xs text-muted-foreground">
                        現在の評価額
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">月間変動</CardTitle>
                    {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(change)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        過去30日間: {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
