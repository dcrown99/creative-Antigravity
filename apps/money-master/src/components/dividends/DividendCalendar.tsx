'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { CalendarDays, Coins } from 'lucide-react';
import { Asset } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface DividendCalendarProps {
    assets: Asset[];
    usdJpy: number;
}

interface ScheduledDividend {
    assetName: string;
    ticker: string | null;
    date: string;  // YYYY-MM-DD
    estimatedAmount: number;
    currency: 'JPY' | 'USD';
}

export function DividendCalendar({ assets, usdJpy }: DividendCalendarProps) {
    // 配当予定を計算
    const scheduledDividends = useMemo(() => {
        const now = new Date();
        const sixMonthsLater = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());

        const dividends: ScheduledDividend[] = [];

        // 配当頻度に応じた月間隔と回数を取得
        const getFrequencyConfig = (frequency: string | undefined | null) => {
            switch (frequency) {
                case 'monthly': return { intervalMonths: 1, divisor: 12 };
                case 'quarterly': return { intervalMonths: 3, divisor: 4 };
                case 'semiannual': return { intervalMonths: 6, divisor: 2 };
                case 'annual': return { intervalMonths: 12, divisor: 1 };
                default: return { intervalMonths: 3, divisor: 4 }; // デフォルト: 四半期
            }
        };

        assets.forEach(asset => {
            if (!asset.nextDividendDate || !asset.dividendRate || !asset.quantity) return;

            // 次回配当日をパース
            const nextDate = new Date(asset.nextDividendDate);
            if (isNaN(nextDate.getTime())) return;

            const { intervalMonths, divisor } = getFrequencyConfig(asset.dividendFrequency);

            // 今後6ヶ月以内の配当を追加
            let currentDate = new Date(nextDate);
            while (currentDate <= sixMonthsLater) {
                if (currentDate >= now) {
                    dividends.push({
                        assetName: asset.name,
                        ticker: asset.ticker || null,
                        date: currentDate.toISOString().split('T')[0],
                        estimatedAmount: asset.dividendRate * asset.quantity / divisor,
                        currency: asset.currency as 'JPY' | 'USD',
                    });
                }
                // 次の配当日へ
                currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + intervalMonths));
            }
        });

        // 日付順にソート
        return dividends.sort((a, b) => a.date.localeCompare(b.date));
    }, [assets]);

    // 月ごとにグループ化
    const dividendsByMonth = useMemo(() => {
        const grouped = new Map<string, ScheduledDividend[]>();

        scheduledDividends.forEach(dividend => {
            const monthKey = dividend.date.substring(0, 7); // YYYY-MM
            if (!grouped.has(monthKey)) {
                grouped.set(monthKey, []);
            }
            grouped.get(monthKey)!.push(dividend);
        });

        return grouped;
    }, [scheduledDividends]);

    // 月合計を計算（JPYに換算）
    const calculateMonthTotal = (dividends: ScheduledDividend[]): number => {
        return dividends.reduce((sum, d) => {
            const amountInJpy = d.currency === 'USD' ? d.estimatedAmount * usdJpy : d.estimatedAmount;
            return sum + amountInJpy;
        }, 0);
    };

    // 月のラベルをフォーマット
    const formatMonth = (monthKey: string): string => {
        const [year, month] = monthKey.split('-');
        return `${year}年${parseInt(month)}月`;
    };

    if (scheduledDividends.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" />
                        配当予定カレンダー
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-4">
                        配当予定のある資産がありません。<br />
                        資産に「次回配当日」を設定すると、ここに表示されます。
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" />
                    配当予定カレンダー（今後6ヶ月）
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {Array.from(dividendsByMonth.entries()).map(([monthKey, dividends]) => (
                        <div key={monthKey} className="space-y-2">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-semibold text-lg">{formatMonth(monthKey)}</h3>
                                <span className="text-sm text-muted-foreground">
                                    予想合計: {formatCurrency(calculateMonthTotal(dividends))}
                                </span>
                            </div>
                            <div className="grid gap-2">
                                {dividends.map((dividend, idx) => (
                                    <div
                                        key={`${dividend.ticker}-${dividend.date}-${idx}`}
                                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-full bg-green-500/10">
                                                <Coins className="w-4 h-4 text-green-500" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{dividend.ticker || dividend.assetName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {dividend.date.split('-').slice(1).join('/')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium text-green-600">
                                                +{dividend.currency === 'JPY'
                                                    ? formatCurrency(dividend.estimatedAmount)
                                                    : `$${dividend.estimatedAmount.toFixed(2)}`}
                                            </p>
                                            {dividend.currency === 'USD' && (
                                                <p className="text-xs text-muted-foreground">
                                                    ≈ {formatCurrency(dividend.estimatedAmount * usdJpy)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
