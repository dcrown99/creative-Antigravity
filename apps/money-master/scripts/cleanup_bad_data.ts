
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up bad data...');
    // Delete valid duplicates if any (unlikely due to date mismatch)
    // Delete entries with year > 3000
    // SQLite doesn't have Year function on string easily, but we can check string length or simple comparison
    // Date format is YYYY-MM-DD. Bad dates starts with +05...

    // Find bad ones
    const all = await prisma.dividend.findMany();
    const badIds = all.filter(d => d.date.startsWith('+') || d.date.length > 10).map(d => d.id);

    console.log(`Found ${badIds.length} bad records.`);

    if (badIds.length > 0) {
        const res = await prisma.dividend.deleteMany({
            where: {
                id: { in: badIds }
            }
        });
        console.log(`Deleted ${res.count} records.`);
    }

    const count = await prisma.dividend.count();
    console.log(`Final Count: ${count}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
