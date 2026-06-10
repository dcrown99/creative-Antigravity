import { Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface RecentTransactionsProps {
    transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
    if (transactions.length === 0) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    取引データがありません
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {transaction.type === 'income' ? (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                                <ArrowUpCircle className="h-4 w-4 text-green-600" />
                            </div>
                        ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                                <ArrowDownCircle className="h-4 w-4 text-red-600" />
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-medium">{transaction.category}</p>
                            <p className="text-xs text-muted-foreground">{transaction.date}</p>
                        </div>
                    </div>
                    <div className={`text-sm font-medium ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                    </div>
                </div>
            ))}
        </div>
    );
}
