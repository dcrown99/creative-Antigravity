
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.dividend.count();
    console.log(`Current Dividend Count: ${count}`);

    const sample = await prisma.dividend.findMany({ take: 3, orderBy: { date: 'desc' } });
    console.log('Sample:', sample);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
