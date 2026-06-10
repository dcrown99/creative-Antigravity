'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { getMonthlyTransactionSummary } from '@/lib/actions';
import { formatCurrency } from '@/lib/utils';

interface MonthlySummaryData {
    income: number;
    expense: number;
    balance: number;
}

export function MonthlySummaryWidget() {
    const [currentMonth, setCurrentMonth] = useState<MonthlySummaryData | null>(null);
    const [previousMonth, setPreviousMonth] = useState<MonthlySummaryData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1; // 1-12

            // 前月の計算
            const prevYear = month === 1 ? year - 1 : year;
            const prevMonth = month === 1 ? 12 : month - 1;

            try {
                const [current, previous] = await Promise.all([
                    getMonthlyTransactionSummary(year, month),
                    getMonthlyTransactionSummary(prevYear, prevMonth),
                ]);
                setCurrentMonth(current);
                setPreviousMonth(previous);
            } catch (error) {
                console.error('Failed to fetch monthly summary:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // 前月比の計算
    const getChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };

    const formatMonthYear = () => {
        const now = new Date();
        return `${now.getFullYear()}年${now.getMonth() + 1}月`;
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">月次サマリー</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-muted rounded w-1/2" />
                        <div className="h-8 bg-muted rounded w-1/2" />
                        <div className="h-8 bg-muted rounded w-1/2" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!currentMonth) return null;

    const incomeChange = previousMonth ? getChange(currentMonth.income, previousMonth.income) : 0;
    const expenseChange = previousMonth ? getChange(currentMonth.expense, previousMonth.expense) : 0;
    const balanceChange = previousMonth ? getChange(currentMonth.balance, previousMonth.balance) : 0;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    月次サマリー - {formatMonthYear()}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 収入 */}
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">収入</span>
                            <ArrowUpCircle className="w-4 h-4 text-green-500" />
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                            +{formatCurrency(currentMonth.income)}
                        </div>
                        {previousMonth && (
                            <div className={`text-xs mt-1 flex items-center gap-1 ${incomeChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {incomeChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                前月比 {incomeChange >= 0 ? '+' : ''}{incomeChange}%
                            </div>
                        )}
                    </div>

                    {/* 支出 */}
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">支出</span>
                            <ArrowDownCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="text-2xl font-bold text-red-600">
                            -{formatCurrency(currentMonth.expense)}
                        </div>
                        {previousMonth && (
                            <div className={`text-xs mt-1 flex items-center gap-1 ${expenseChange <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {expenseChange <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                前月比 {expenseChange >= 0 ? '+' : ''}{expenseChange}%
                            </div>
                        )}
                    </div>

                    {/* 差引 */}
                    <div className={`p-4 rounded-lg ${currentMonth.balance >= 0 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-orange-500/10 border border-orange-500/20'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">差引</span>
                            <Wallet className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className={`text-2xl font-bold ${currentMonth.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {currentMonth.balance >= 0 ? '+' : ''}{formatCurrency(currentMonth.balance)}
                        </div>
                        {previousMonth && (
                            <div className={`text-xs mt-1 flex items-center gap-1 ${balanceChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {balanceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                前月比 {balanceChange >= 0 ? '+' : ''}{balanceChange}%
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
