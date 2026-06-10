// Link removed - not currently used
import { getPortfolioWithPrices, getMonthlyTransactionSummary, getRecentTransactions, getAssetHistory } from "@/lib/actions";
import { calculateTotalAssets } from "@/lib/portfolio-logic";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    // Parallel data fetching for improved performance
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const [
        { portfolio, usdJpy },
        monthlyTransactions,
        recentTransactions,
        assetHistory
    ] = await Promise.all([
        getPortfolioWithPrices(),
        getMonthlyTransactionSummary(currentYear, currentMonth),
        getRecentTransactions(5),
        getAssetHistory(30),
    ]);

    // Calculate total value including all asset types
    const totalValue = calculateTotalAssets(portfolio.assets, usdJpy);

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-slate-200">
            {/* Header */}
            <header className="mb-12 flex justify-between items-center">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
                    GOD MODE DASHBOARD
                </h1>
            </header>

            {/* Existing Dashboard Client */}
            <DashboardClient
                portfolio={portfolio}
                monthlyTransactions={monthlyTransactions}
                recentTransactions={recentTransactions}
                totalValue={totalValue}
                usdJpy={usdJpy}
                assetHistory={assetHistory}
            />
        </main>
    );
}
