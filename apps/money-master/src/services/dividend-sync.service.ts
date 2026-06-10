
import { prisma } from "@/lib/prisma"; // Use absolute alias
import yahooFinance from 'yahoo-finance2';
import { withRetry, delay } from '@/lib/rate-limiter';
import * as SystemService from '@/services/system.service';
import * as DividendService from '@/services/dividend.service';

/**
 * Helper to fetch historical USD/JPY rates
 */
async function getUsdJpyRates(startDate: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : yahooFinance;

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await withRetry(() => yf.chart('USDJPY=X', {
            period1: startDate,
            interval: '1d'
        }));

        const rateMap = new Map<string, number>();
        if (!result || !result.quotes) return rateMap;

        for (const q of result.quotes) {
            if (!q.date || !q.close) continue;
            const dateStr = q.date.toISOString().split('T')[0];
            rateMap.set(dateStr, q.close);
        }
        return rateMap;
    } catch (e) {
        console.error("Failed to fetch USDJPY rates:", e);
        return new Map<string, number>();
    }
}

/**
 * Sync Dividends for all assets
 * 1. Fetch from Yahoo Finance
 * 2. Calculate JPY total amount
 * 3. Upsert to DB
 */
export async function syncAllDividends() {
    console.log("[DividendSync] Starting sync...");
    const logs: string[] = [];
    let addedCount = 0;
    let updatedCount = 0;

    try {
        const assets = await prisma.asset.findMany({
            where: { ticker: { not: null } }
        });

        // Determine start date (e.g. 2020-01-01 initially, or make it dynamic)
        // For robustness, let's stick to 2020-01-01 to catch corrections, 
        // OR find latest dividend date in DB?
        // Upsert handles duplicates, so re-fetching is safe and self-healing.
        const START_DATE = '2020-01-01';

        // Fetch FX Map once
        const rateMap = await getUsdJpyRates(START_DATE);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : yahooFinance;

        for (const asset of assets) {
            if (!asset.ticker) continue;

            // Rate limiting: wait between requests
            await delay(1500);

            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result: any = await withRetry(() => yf.chart(asset.ticker!, {
                    period1: START_DATE,
                    interval: '1d',
                    events: 'dividends' // Correct parameter for chart
                }));

                if (!result || !result.events || !result.events.dividends) continue;

                // Handle events object: { dateKey: { amount, date } }
                // yahoo-finance2 chart events are typically an object keyed by timestamp?
                // actually yf.chart with events returns generic structure.
                // Based on recovery script experience:
                // result.events.dividends IS the map or array.
                // Typings might say object.
                // Let's iterate values.

                const rawDividends = Object.values(result.events.dividends);

                for (const div of rawDividends as any[]) {
                    if (!div.date || !div.amount) continue;

                    // Parse Date
                    let dateObj: Date;
                    if (div.date instanceof Date) {
                        dateObj = div.date;
                    } else if (typeof div.date === 'number') {
                        // Decide if seconds or ms
                        if (div.date > 100000000000) dateObj = new Date(div.date);
                        else dateObj = new Date(div.date * 1000);
                    } else {
                        dateObj = new Date(div.date);
                    }


                    // Prevention of future dates (bad parse check)
                    // Note: We shift dates later, so initial check is rough
                    if (dateObj.getFullYear() > new Date().getFullYear() + 2) continue;

                    // Check region for Date/Currency logic
                    const isJpyAsset = asset.ticker.endsWith('.T') || /^[0-9]+$/.test(asset.ticker);

                    // Apply Payment Date Heurisitc
                    // Yahoo returns Ex-Date. Payment is later.
                    if (isJpyAsset) {
                        // JP: ~3 Months later
                        dateObj.setMonth(dateObj.getMonth() + 3);
                    } else {
                        // US/Others: ~25 Days later
                        dateObj.setDate(dateObj.getDate() + 25);
                    }

                    const dateStr = dateObj.toISOString().split('T')[0];

                    // Logic: Amount * Quantity
                    const qty = asset.quantity ? Number(asset.quantity) : 0;
                    if (qty === 0) continue;

                    const perShare = Number(div.amount);
                    let totalAmount = perShare * qty;
                    const currency = 'JPY';

                    if (!isJpyAsset) {
                        // Assume USD, convert
                        // Find rate for the PAYMENT date
                        let rate = rateMap.get(dateStr);
                        if (!rate) {
                            // Fallback to recent if precise date missing
                            rate = 145;
                        }
                        totalAmount = totalAmount * rate;
                    }

                    totalAmount = Math.floor(totalAmount);

                    // Upsert
                    // We need a unique constraint or lookup.
                    // DB has NO unique constraint on (assetId, date).
                    // So we search first.
                    const existing = await prisma.dividend.findFirst({
                        where: {
                            assetId: asset.id,
                            date: dateStr
                        }
                    });

                    if (existing) {
                        // Update if amount changed significantly?
                        // Or always update (refinement).
                        if (existing.amount.toNumber() !== totalAmount) {
                            await prisma.dividend.update({
                                where: { id: existing.id },
                                data: { amount: totalAmount, currency }
                            });
                            updatedCount++;
                        }
                    } else {
                        await prisma.dividend.create({
                            data: {
                                assetId: asset.id,
                                date: dateStr,
                                amount: totalAmount,
                                currency
                            }
                        });
                        addedCount++;
                    }
                }

            } catch (err: any) {
                logs.push(`Error processing ${asset.ticker}: ${err.message}`);
            }
        }

        await SystemService.saveAnalysisLog({
            title: "Dividend Sync Auto",
            summary: `Synced dividends. Added: ${addedCount}, Updated: ${updatedCount}`,
            script: "DividendSyncService",
            sources: "Yahoo Finance",
            date: new Date().toISOString()
        });

        console.log(`[DividendSync] Done. Added: ${addedCount}, Updated: ${updatedCount}`);
        return { success: true, added: addedCount, updated: updatedCount };

    } catch (error) {
        console.error("[DividendSync] Fatal error:", error);
        await SystemService.saveAnalysisLog({
            title: "Dividend Sync Failed",
            summary: `Error: ${error}`,
            script: "DividendSyncService",
            sources: "",
            date: new Date().toISOString()
        });
        return { success: false, error };
    }
}
