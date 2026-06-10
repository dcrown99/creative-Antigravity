
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Testing Dividend Insert...');
    // Create a dummy asset if needed, or use existing one.
    // Let's use the first asset found.
    const asset = await prisma.asset.findFirst();
    if (!asset) {
        console.error('No assets found to test with.');
        return;
    }

    console.log(`Using asset: ${asset.name} (${asset.id})`);

    const dividendData = {
        assetId: asset.id,
        date: '2025-01-01',
        amount: 100,
        currency: 'JPY'
    };

    const created = await prisma.dividend.create({
        data: dividendData
    });

    console.log('Created dividend:', created);

    const fetched = await prisma.dividend.findUnique({
        where: { id: created.id }
    });

    console.log('Fetched dividend:', fetched);

    // Clean up
    await prisma.dividend.delete({
        where: { id: created.id }
    });
    console.log('Deleted test dividend.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
