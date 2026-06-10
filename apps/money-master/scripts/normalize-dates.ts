import { prisma } from "../src/lib/prisma";

/**
 * Migration script to normalize all transaction dates to YYYY-MM-DD format.
 * 
 * The bug: Database contains mixed date formats:
 * - YYYY-MM-DD (correct): 2025-10-10
 * - YYYYMMDD (incorrect): 20251125
 * 
 * String comparison fails because '20251125' > '2025-12-01' lexically,
 * causing November transactions to be included in December queries.
 */
async function normalizeDates() {
    console.log("Starting date normalization migration...");

    // Get all transactions
    const transactions = await prisma.transaction.findMany();
    console.log(`Found ${transactions.length} transactions to check.`);

    let fixedCount = 0;
    const updates: Array<{ id: string; oldDate: string; newDate: string }> = [];

    for (const t of transactions) {
        const date = t.date;

        // Check if date is in YYYYMMDD format (8 characters, no hyphens)
        if (/^\d{8}$/.test(date)) {
            // Convert YYYYMMDD to YYYY-MM-DD
            const newDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
            updates.push({ id: t.id, oldDate: date, newDate });
            fixedCount++;
        }
    }

    console.log(`Found ${fixedCount} transactions with incorrect date format.`);

    if (updates.length > 0) {
        console.log("\nTransactions to fix:");
        updates.forEach(u => {
            console.log(`  ${u.oldDate} -> ${u.newDate}`);
        });

        // Apply updates
        console.log("\nApplying updates...");
        for (const update of updates) {
            await prisma.transaction.update({
                where: { id: update.id },
                data: { date: update.newDate },
            });
        }
        console.log(`Successfully normalized ${fixedCount} dates.`);
    } else {
        console.log("No date normalization needed.");
    }

    // Verify the fix
    console.log("\nVerifying fix...");
    const decemberStart = "2025-12-01";
    const decemberEnd = "2026-01-01";

    const decemberTransactions = await prisma.transaction.findMany({
        where: {
            date: {
                gte: decemberStart,
                lt: decemberEnd,
            },
        },
    });

    console.log(`December 2025 transactions after fix: ${decemberTransactions.length}`);

    // Show month breakdown
    const allTransactions = await prisma.transaction.findMany();
    const byMonth: Record<string, number> = {};
    allTransactions.forEach(t => {
        const monthKey = t.date.substring(0, 7);
        byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
    });

    console.log("\nTransactions by month:");
    Object.entries(byMonth).sort().forEach(([month, count]) => {
        console.log(`  ${month}: ${count} transactions`);
    });
}

normalizeDates()
    .then(() => {
        console.log("\nMigration complete!");
        prisma.$disconnect();
    })
    .catch((e) => {
        console.error("Migration failed:", e);
        prisma.$disconnect();
        process.exit(1);
    });
