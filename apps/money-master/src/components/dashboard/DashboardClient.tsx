"use client";

import { Portfolio, Transaction } from "@/types";
import { HistoryEntry } from "@/services/analytics.service";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { AssetHistoryChart } from "@/components/analytics/AssetHistoryChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";

import { PortfolioTreemap } from "@/components/dashboard/PortfolioTreemap";
import { formatCurrency } from "@/lib/utils";

interface DashboardClientProps {
  portfolio: Portfolio;
  monthlyTransactions: {
    income: number;
    expense: number;
    balance: number;
  };
  recentTransactions: Transaction[];
  totalValue: number;
  usdJpy: number;
  assetHistory: HistoryEntry[];
}

export function DashboardClient({
  portfolio,
  monthlyTransactions,
  recentTransactions,
  totalValue,
  usdJpy,
  assetHistory,
}: DashboardClientProps) {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">ダッシュボード</h2>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総資産額</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の収入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(monthlyTransactions.income)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の支出</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(monthlyTransactions.expense)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の収支</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${monthlyTransactions.balance >= 0 ? "text-green-600" : "text-red-600"
                }`}
            >
              {formatCurrency(monthlyTransactions.balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* 左側: 資産推移グラフ (全幅) */}
        <Card className="col-span-7">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総資産推移</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <AssetHistoryChart data={assetHistory} currentTotalValue={totalValue} period={30} />
          </CardContent>
        </Card>
      </div>

      {/* 資産構成マップ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>資産構成マップ</CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioTreemap portfolio={portfolio} usdJpy={usdJpy} />
          </CardContent>
        </Card>
      </div>

      {/* 最近の取引 */}
      <div className="grid gap-4 grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>最近の取引</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactions transactions={recentTransactions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

