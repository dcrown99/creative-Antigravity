import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API endpoint to normalize all transaction and dividend dates to YYYY-MM-DD format.
 * 
 * The bug: Database contains mixed date formats:
 * - YYYY-MM-DD (correct): 2025-10-10
 * - YYYYMMDD (incorrect): 20251125
 * 
 * String comparison fails because '20251125' > '2025-12-01' lexically,
 * causing November data to be included in December queries.
 * 
 * This endpoint is only available in development mode.
 */
export async function POST() {
    // Production environment check
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'This endpoint is not available in production' },
            { status: 403 }
        );
    }

    try {
        console.log("Starting date normalization migration...");

        const results = {
            transactions: { checked: 0, fixed: 0, fixes: [] as Array<{ id: string; oldDate: string; newDate: string }> },
            dividends: { checked: 0, fixed: 0, fixes: [] as Array<{ id: string; oldDate: string; newDate: string }> },
        };

        // Normalize Transaction dates
        const transactions = await prisma.transaction.findMany();
        results.transactions.checked = transactions.length;

        for (const t of transactions) {
            if (/^\d{8}$/.test(t.date)) {
                const newDate = `${t.date.slice(0, 4)}-${t.date.slice(4, 6)}-${t.date.slice(6, 8)}`;
                await prisma.transaction.update({
                    where: { id: t.id },
                    data: { date: newDate },
                });
                results.transactions.fixes.push({ id: t.id, oldDate: t.date, newDate });
                results.transactions.fixed++;
            }
        }

        // Normalize Dividend dates
        const dividends = await prisma.dividend.findMany();
        results.dividends.checked = dividends.length;

        for (const d of dividends) {
            if (/^\d{8}$/.test(d.date)) {
                const newDate = `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`;
                await prisma.dividend.update({
                    where: { id: d.id },
                    data: { date: newDate },
                });
                results.dividends.fixes.push({ id: d.id, oldDate: d.date, newDate });
                results.dividends.fixed++;
            }
        }

        console.log(`Transactions: ${results.transactions.fixed}/${results.transactions.checked} fixed`);
        console.log(`Dividends: ${results.dividends.fixed}/${results.dividends.checked} fixed`);

        return NextResponse.json({
            success: true,
            message: `Normalized ${results.transactions.fixed} transactions and ${results.dividends.fixed} dividends.`,
            results,
        });
    } catch (error) {
        console.error("Migration failed:", error);
        return NextResponse.json({
            success: false,
            error: String(error),
        }, { status: 500 });
    }
}
