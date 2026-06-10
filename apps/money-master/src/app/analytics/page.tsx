import { getAssetHistory, getAssetAllocation, getPortfolioWithPrices } from "@/lib/actions";
import { calculateTotalAssets } from "@/lib/portfolio-logic";
import { AnalyticsHistoryClient } from "@/components/analytics/AnalyticsHistoryClient";
import { AssetAllocationChart } from "@/components/analytics/AssetAllocationChart";
import { PerformanceSummary } from "@/components/analytics/PerformanceSummary";
import { SectorPerformanceChart } from "@/components/analytics/SectorPerformanceChart";
import { RebalanceWidget } from "@/components/analytics/RebalanceWidget";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const [history, allocation, { portfolio, usdJpy }] = await Promise.all([
    getAssetHistory(30), // Match initialPeriod for consistent initial display
    getAssetAllocation(),
    getPortfolioWithPrices(),
  ]);

  const currentTotalValue = calculateTotalAssets(portfolio.assets, usdJpy);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">分析レポート</h1>
      </div>

      <PerformanceSummary history={history} currentTotalValue={currentTotalValue} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsHistoryClient
          initialData={history}
          currentTotalValue={currentTotalValue}
          initialPeriod={30}
        />
        <AssetAllocationChart data={allocation} />
      </div>

      {/* セクター分析セクション */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectorPerformanceChart assets={portfolio.assets} usdJpy={usdJpy} />
        <RebalanceWidget assets={portfolio.assets} usdJpy={usdJpy} />
      </div>
    </div>
  );
}
