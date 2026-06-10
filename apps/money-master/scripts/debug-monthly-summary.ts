import { prisma } from "../src/lib/prisma";

async function debugMonthlySummary() {
  const year = 2025;
  const month = 12;
  
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  
  console.log(`Querying transactions for ${startDate} to ${endDate}`);
  
  // Get all transactions for December
  const decemberTransactions = await prisma.transaction.findMany({
    where: {
      date: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: { date: 'desc' },
  });
  
  console.log(`\nFound ${decemberTransactions.length} transactions in December 2025:`);
  decemberTransactions.forEach((t: { date: unknown; type: unknown; amount: unknown; description: unknown }) => {
    console.log(`  ${t.date} | ${t.type} | ${t.amount} | ${t.description}`);
  });
  
  // Calculate summary
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
  
  console.log(`\nMonthly Summary for December 2025:`);
  aggregations.forEach(agg => {
    console.log(`  ${agg.type}: ${agg._sum.amount}`);
  });
  
  // Get ALL transactions to compare
  const allTransactions = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
  });
  
  console.log(`\nTotal transactions in database: ${allTransactions.length}`);
  
  // Group by month for comparison
  const byMonth: Record<string, { income: number; expense: number }> = {};
  allTransactions.forEach((t: { date: string; type: string; amount: unknown }) => {
    const monthKey = t.date.substring(0, 7);
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { income: 0, expense: 0 };
    }
    const amount = typeof t.amount === 'number' ? t.amount : Number(t.amount);
    if (t.type === 'income') {
      byMonth[monthKey].income += amount;
    } else if (t.type === 'expense') {
      byMonth[monthKey].expense += amount;
    }
  });
  
  console.log(`\nMonthly breakdown:`);
  Object.entries(byMonth).sort().reverse().forEach(([month, values]) => {
    console.log(`  ${month}: income=${values.income}, expense=${values.expense}`);
  });
  
  // Check the grand total
  const grandTotal = await prisma.transaction.aggregate({
    _sum: {
      amount: true,
    },
    where: { type: 'income' },
  });
  
  console.log(`\nGrand total income (all time): ${grandTotal._sum.amount}`);
  
  const grandTotalExpense = await prisma.transaction.aggregate({
    _sum: {
      amount: true,
    },
    where: { type: 'expense' },
  });
  
  console.log(`Grand total expense (all time): ${grandTotalExpense._sum.amount}`);
}

debugMonthlySummary()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
