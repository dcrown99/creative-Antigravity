
import { PrismaClient } from '@prisma/client';
import yahooFinance from 'yahoo-finance2';

const prisma = new PrismaClient();

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

async function main() {
    console.log('Starting Dividend Recovery...');

    // 1. Get all assets with tickers
    const assets = await prisma.asset.findMany({
        where: {
            ticker: {
                not: null
            },
            isArchived: false
        }
    });

    console.log(`Found ${assets.length} active assets with tickers.`);

    let totalAdded = 0;

    for (const asset of assets) {
        if (!asset.ticker) continue;

        console.log(`Processing ${asset.name} (${asset.ticker})...`);

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : yahooFinance;

            // Fetch with chart API (more reliable for events)
            const result = await yf.chart(asset.ticker, {
                period1: '2020-01-01',
                interval: '1d',
                events: 'div,splits'
            });

            // result is the ChartResult object
            // events are usually in result.events
            const dividendsMap = result.events?.dividends;

            if (!dividendsMap) {
                console.log(`  No dividends found for ${asset.ticker}`);
                continue;
            }

            const dividendsToAdd = (Object.values(dividendsMap) as { date: Date | number | string; amount: number }[]).map(d => {
                let dateObj: Date;
                if (d.date instanceof Date) {
                    dateObj = d.date;
                } else if (typeof d.date === 'number') {
                    // If < 100000000000 (year 5138), assume seconds. Yahoo usually sends seconds.
                    // If d.date was already ms (e.g. 1.7e12), this check fails and we use it as is.
                    // Actually, year 3000 is ~3.2e10 seconds. 1e11 is safe cutoff.
                    if (d.date < 100000000000) {
                        dateObj = new Date(d.date * 1000);
                    } else {
                        dateObj = new Date(d.date);
                    }
                } else {
                    dateObj = new Date(d.date);
                }
                return {
                    date: dateObj,
                    dividends: d.amount
                };
            });

            console.log(`  Found ${dividendsToAdd.length} dividends.`);

            for (const div of dividendsToAdd) {
                const dateStr = formatDate(div.date);

                // Check if already exists to avoid duplication (though table is empty now)
                // We use findFirst because we don't have unique constraint on (assetId, date) yet?
                // Schema has @@index([date]) and @@index([assetId]). No composite unique.
                // So we should check manually.

                const existing = await prisma.dividend.findFirst({
                    where: {
                        assetId: asset.id,
                        date: dateStr
                    }
                });

                if (!existing) {
                    await prisma.dividend.create({
                        data: {
                            assetId: asset.id,
                            date: dateStr,
                            amount: div.dividends,
                            currency: asset.currency // Assume dividend currency matches asset currency
                        }
                    });
                    totalAdded++;
                }
            }

            // Update Dividend Frequency
            await updateDividendFrequency(asset.id, dividendsToAdd);

        } catch (error) {
            console.error(`  Error fetching for ${asset.ticker}:`, error instanceof Error ? error.message : error);
        }

        // Small delay to be nice to API
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Recovery Complete. Total dividends added: ${totalAdded}`);
}

async function updateDividendFrequency(assetId: string, dividends: { date: Date; dividends: number }[]) {
    // Determine frequency
    if (dividends.length < 2) return;

    // Sort by date desc (recent first)
    const sorted = dividends.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Take last 2 years roughly or last few entries
    const recent = sorted.slice(0, 8); // Last 8 payments (2 years if quarterly)

    if (recent.length < 2) return;

    // Calc average interval
    let totalDiffDays = 0;
    for (let i = 0; i < recent.length - 1; i++) {
        const d1 = recent[i].date.getTime();
        const d2 = recent[i + 1].date.getTime();
        const diff = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24); // days
        totalDiffDays += diff;
    }

    const avgDays = totalDiffDays / (recent.length - 1);
    let frequency = 'annual';

    if (avgDays <= 45) frequency = 'monthly'; // ~30 days
    else if (avgDays <= 120) frequency = 'quarterly'; // ~90 days
    else if (avgDays <= 200) frequency = 'semiannual'; // ~180 days

    await prisma.asset.update({
        where: { id: assetId },
        data: { dividendFrequency: frequency }
    });
    console.log(`  Updated frequency to: ${frequency}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
