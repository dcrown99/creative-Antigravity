import { getDividends, getPortfolioWithPrices } from "@/lib/actions";
import { DividendListClient } from "@/components/dividends/DividendListClient";
import { DividendAssetSummary } from "@/components/dividends/DividendAssetSummary";
import { DividendCalendar } from "@/components/dividends/DividendCalendar";
import { DividendYearlySummary } from "@/components/dividends/DividendYearlySummary";

export const dynamic = 'force-dynamic';

export default async function DividendsPage() {
  const dividends = await getDividends();
  const { portfolio, usdJpy } = await getPortfolioWithPrices();

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">配当管理</h1>
      </div>

      <DividendAssetSummary assets={portfolio.assets} usdJpy={usdJpy} />

      <DividendYearlySummary dividends={dividends} usdJpy={usdJpy} />

      <div className="grid gap-8 lg:grid-cols-2">
        <DividendCalendar assets={portfolio.assets} usdJpy={usdJpy} />
        <DividendListClient
          initialDividends={dividends}
          assets={portfolio.assets}
          usdJpy={usdJpy}
        />
      </div>
    </div>
  );
}

