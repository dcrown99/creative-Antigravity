'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge } from '@repo/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DividendWithAsset {
    id: string;
    assetId: string;
    date: string;
    amount: number;
    currency: 'JPY' | 'USD';
    asset: {
        name: string;
        ticker: string | null;
    };
}

interface DividendYearlySummaryProps {
    dividends: DividendWithAsset[];
    usdJpy: number;
}

interface MonthlyData {
    month: string;
    monthLabel: string;
    amount: number;
    count: number;
}

export function DividendYearlySummary({ dividends, usdJpy }: DividendYearlySummaryProps) {
    // 利用可能な年を取得
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        dividends.forEach(d => {
            const year = parseInt(d.date.substring(0, 4));
            if (!isNaN(year)) years.add(year);
        });
        const sortedYears = Array.from(years).sort((a, b) => b - a);
        if (sortedYears.length === 0) sortedYears.push(new Date().getFullYear());
        return sortedYears;
    }, [dividends]);

    const [selectedYear, setSelectedYear] = useState<number>(availableYears[0]);
    const previousYear = selectedYear - 1;

    // 月別データを計算
    const calculateYearlyData = (year: number): MonthlyData[] => {
        const monthlyMap = new Map<string, { amount: number; count: number }>();

        // 1-12月を初期化
        for (let i = 1; i <= 12; i++) {
            monthlyMap.set(`${year}-${String(i).padStart(2, '0')}`, { amount: 0, count: 0 });
        }

        dividends.forEach(d => {
            const dateYear = parseInt(d.date.substring(0, 4));
            if (dateYear !== year) return;

            const monthKey = d.date.substring(0, 7);
            const current = monthlyMap.get(monthKey) || { amount: 0, count: 0 };
            const amountInJpy = d.currency === 'USD' ? d.amount * usdJpy : d.amount;

            monthlyMap.set(monthKey, {
                amount: current.amount + amountInJpy,
                count: current.count + 1,
            });
        });

        return Array.from(monthlyMap.entries()).map(([month, data]) => ({
            month,
            monthLabel: `${parseInt(month.split('-')[1])}月`,
            amount: Math.round(data.amount),
            count: data.count,
        }));
    };

    const currentYearData = useMemo(() => calculateYearlyData(selectedYear), [selectedYear, dividends, usdJpy]);
    const previousYearData = useMemo(() => calculateYearlyData(previousYear), [previousYear, dividends, usdJpy]);

    // 年間合計
    const currentYearTotal = currentYearData.reduce((sum, d) => sum + d.amount, 0);
    const previousYearTotal = previousYearData.reduce((sum, d) => sum + d.amount, 0);

    // 前年比
    const yearOverYearChange = previousYearTotal > 0
        ? Math.round(((currentYearTotal - previousYearTotal) / previousYearTotal) * 100)
        : 0;

    // カスタムツールチップ
    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background border rounded-lg p-3 shadow-lg">
                    <p className="font-medium">{label}</p>
                    <p className="text-green-600">{formatCurrency(payload[0].value)}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        年間配当サマリー
                    </CardTitle>
                    <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {availableYears.map(year => (
                                <SelectItem key={year} value={String(year)}>{year}年</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* サマリー */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                        <p className="text-sm text-muted-foreground">{selectedYear}年 合計</p>
                        <p className="text-2xl font-bold text-green-600">
                            +{formatCurrency(currentYearTotal)}
                        </p>
                    </div>
                    {previousYearTotal > 0 && (
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">前年比</p>
                            <div className={`flex items-center gap-1 ${yearOverYearChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {yearOverYearChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                <span className="text-lg font-semibold">
                                    {yearOverYearChange >= 0 ? '+' : ''}{yearOverYearChange}%
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                ({previousYear}年: {formatCurrency(previousYearTotal)})
                            </p>
                        </div>
                    )}
                </div>

                {/* 月別グラフ */}
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={currentYearData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis
                                dataKey="monthLabel"
                                tick={{ fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                {currentYearData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.amount > 0 ? '#22c55e' : '#e5e7eb'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 月別詳細（配当がある月のみ） */}
                <div className="flex flex-wrap gap-2">
                    {currentYearData.filter(d => d.count > 0).map(d => (
                        <Badge key={d.month} variant="outline" className="text-xs">
                            {d.monthLabel}: {d.count}件
                        </Badge>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
