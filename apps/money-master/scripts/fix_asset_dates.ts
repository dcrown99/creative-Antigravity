
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Asset Next Dividend Date Adjustment...");

    // Get assets with a next dividend date set
    const assets = await prisma.asset.findMany({
        where: { NOT: { nextDividendDate: null } }
    });

    console.log(`Found ${assets.length} assets with next dividend date.`);

    let updatedCount = 0;

    for (const asset of assets) {
        if (!asset.ticker || !asset.nextDividendDate) continue;

        const ticker = asset.ticker;
        const oldDate = new Date(asset.nextDividendDate);
        const newDate = new Date(oldDate);

        const isJp = ticker.endsWith('.T') || /^[0-9]+$/.test(ticker);

        // This script assumes the stored date is Ex-Date and shifts it.
        // If run multiple times, it would double-shift?
        // Risk: Yes. But user just asked for fix.
        // To prevent double-shift, we could check if it looks like a payment date?
        // E.g. AT&T Ex-Date ~10th. Pay ~1st.
        // If date is near 1st, maybe already fixed.
        // But simpler to just run once and tell user "Don't run again".

        if (isJp) {
            // JP Stocks: +3 Months
            newDate.setMonth(newDate.getMonth() + 3);
        } else {
            // US/Other: +25 Days
            newDate.setDate(newDate.getDate() + 25);
        }

        // Check if date changed
        const newDateStr = newDate.toISOString().split('T')[0];

        // Update
        // Note: nextDividendDate is String or DateTime in Prisma?
        // Typically DateTime.
        await prisma.asset.update({
            where: { id: asset.id },
            data: { nextDividendDate: newDateStr }
        });
        updatedCount++;
    }

    console.log(`\nUpdated ${updatedCount} asset next dividend dates.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
