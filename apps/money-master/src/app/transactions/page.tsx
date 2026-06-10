import { getTransactions } from '@/lib/actions';
import { TransactionListClient } from '@/components/transactions/TransactionListClient';
import { MonthlySummaryWidget } from '@/components/transactions/MonthlySummaryWidget';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
  const transactions = await getTransactions();

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">取引明細</h1>
      <MonthlySummaryWidget />
      <TransactionListClient initialTransactions={transactions} />
    </div>
  );
}

