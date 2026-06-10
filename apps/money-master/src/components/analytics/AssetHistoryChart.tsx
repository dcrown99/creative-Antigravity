"use client";

import { Card, CardContent, CardHeader, CardTitle, Button } from "@repo/ui";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HistoryEntry } from "@/services/analytics.service";
import { formatCurrency } from "@/lib/utils";
import { useMemo } from "react";

export type PeriodOption = 7 | 30 | 90 | 365;

interface AssetHistoryChartProps {
    data: HistoryEntry[];
    currentTotalValue?: number;
    period?: PeriodOption;
    onPeriodChange?: (period: PeriodOption) => void;
}

// シンプルなツールチップ: 総資産のみ表示
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const dateStr = new Date(label).toLocaleDateString('ja-JP');
    const totalValue = payload[0]?.value;

    return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-lg">
            <p className="text-gray-300 text-sm mb-1">{dateStr}</p>
            <p className="text-white font-semibold">
                総資産: {formatCurrency(totalValue)}
            </p>
        </div>
    );
};

export function AssetHistoryChart({ data, currentTotalValue, period = 30, onPeriodChange }: AssetHistoryChartProps) {
    // グラフ用にデータを変換（シンプルに totalValue のみ使用）
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const formattedData = data.map(entry => ({
            date: entry.date,
            totalValue: entry.totalValue,
        }));

        // 今日のライブ値を追加
        if (currentTotalValue !== undefined) {
            const today = new Date().toISOString().split('T')[0];
            const lastEntry = formattedData[formattedData.length - 1];

            if (lastEntry.date !== today) {
                formattedData.push({
                    date: today,
                    totalValue: currentTotalValue,
                });
            } else {
                // 今日のデータがすでにある場合は上書き
                formattedData[formattedData.length - 1] = {
                    date: today,
                    totalValue: currentTotalValue,
                };
            }
        }

        return formattedData;
    }, [data, currentTotalValue]);

    // 期間ラベル
    const periodLabel = period === 7 ? '7日' : period === 30 ? '30日' : period === 90 ? '90日' : '1年';

    // 期間選択ボタン
    const periodOptions: { value: PeriodOption; label: string }[] = [
        { value: 7, label: '7日' },
        { value: 30, label: '30日' },
        { value: 90, label: '90日' },
        { value: 365, label: '1年' },
    ];

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>資産推移 (過去{periodLabel})</CardTitle>
                {onPeriodChange && (
                    <div className="flex gap-1">
                        {periodOptions.map(opt => (
                            <Button
                                key={opt.value}
                                variant={period === opt.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onPeriodChange(opt.value)}
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </div>
                )}
            </CardHeader>

            <CardContent className="pl-2">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#adfa1d" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#adfa1d" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="date"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getMonth() + 1}/${date.getDate()}`;
                                }}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `¥${(value / 10000).toFixed(0)}万`}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="totalValue"
                                stroke="#adfa1d"
                                fill="url(#colorTotal)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
