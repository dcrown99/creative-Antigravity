
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Dividend Date Adjustment...");

    const dividends = await prisma.dividend.findMany({
        include: { asset: true }
    });

    console.log(`Found ${dividends.length} dividends.`);

    let updatedCount = 0;

    for (const div of dividends) {
        if (!div.asset || !div.asset.ticker) continue;

        const ticker = div.asset.ticker;
        const oldDate = new Date(div.date);
        const newDate = new Date(oldDate);

        const isJp = ticker.endsWith('.T') || /^[0-9]+$/.test(ticker);

        if (isJp) {
            // JP Stocks: +3 Months (Approx)
            newDate.setMonth(newDate.getMonth() + 3);
        } else {
            // US/Other: +25 Days
            newDate.setDate(newDate.getDate() + 25);
        }

        // Safety check: Don't set future dates too far? 
        // Actually, if ex-date is Sep 2025, Pay date IS future relative to Sep.
        // It might be future relative to TODAY.
        // If today is Dec 26, 2025.
        // JP Sep 29 -> Dec 29. (Future by 3 days). That's fine.
        // But if it was 2040... (Recovery script fixes that).

        const newDateStr = newDate.toISOString().split('T')[0];

        if (newDateStr !== div.date) {
            await prisma.dividend.update({
                where: { id: div.id },
                data: { date: newDateStr }
            });
            updatedCount++;
            // process.stdout.write('.');
        }
    }

    console.log(`\nUpdated ${updatedCount} dividend dates.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
