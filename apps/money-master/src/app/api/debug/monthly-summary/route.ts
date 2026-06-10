import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Calculator } from '@/lib/calculator';

export async function GET() {
    const year = 2025;
    const month = 12;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Get ALL transactions to understand the data
    const allTransactions = await prisma.transaction.findMany({
        orderBy: { date: 'desc' },
    });

    // Group by month for analysis
    const monthlyBreakdown: Record<string, { income: number; expense: number; count: number }> = {};
    allTransactions.forEach((t) => {
        const monthKey = t.date.substring(0, 7);
        if (!monthlyBreakdown[monthKey]) {
            monthlyBreakdown[monthKey] = { income: 0, expense: 0, count: 0 };
        }
        const amount = Calculator.toNumber(t.amount);
        monthlyBreakdown[monthKey].count++;
        if (t.type === 'income') {
            monthlyBreakdown[monthKey].income += amount;
        } else if (t.type === 'expense') {
            monthlyBreakdown[monthKey].expense += amount;
        }
    });

    // Query December transactions - check what the filter returns
    const decemberTransactions = await prisma.transaction.findMany({
        where: {
            date: {
                gte: startDate,
                lt: endDate,
            },
        },
        orderBy: { date: 'desc' },
    });

    // Calculate aggregation the same way as the service
    const aggregations = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
            date: {
                gte: startDate,
                lt: endDate,
            },
        },
        _sum: {
            amount: true,
        },
    });

    let income = 0;
    let expense = 0;

    aggregations.forEach(agg => {
        const amount = Calculator.toNumber(agg._sum.amount);
        if (agg.type === 'income') {
            income = amount;
        } else if (agg.type === 'expense') {
            expense = amount;
        }
    });

    // Get income transactions only
    const incomeTransactions = await prisma.transaction.findMany({
        where: {
            type: 'income',
        },
        orderBy: { date: 'desc' },
    });

    return NextResponse.json({
        query: { startDate, endDate },
        rawDates: {
            sampleRawDates: allTransactions.slice(0, 5).map(t => t.date),
            incomeRawDates: incomeTransactions.slice(0, 10).map(t => ({ date: t.date, amount: Calculator.toNumber(t.amount), desc: t.description })),
        },
        monthlyBreakdown,
        decemberTransactionCount: decemberTransactions.length,
        decemberIncomeTransactions: decemberTransactions.filter(t => t.type === 'income').map(t => ({
            date: t.date,
            amount: Calculator.toNumber(t.amount),
            description: t.description,
        })),
        decemberSummary: { income, expense, balance: income - expense },
    });
}
