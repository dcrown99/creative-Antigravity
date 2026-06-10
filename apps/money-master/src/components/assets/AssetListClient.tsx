"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Asset } from "@/types";
import { useAssetsContext } from "@/contexts/AssetsContext";
import { formatCurrency } from "@/lib/utils";
import { updateAllAssetPrices } from "@/lib/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { Card, Button, Badge } from "@repo/ui";
import { Plus, Pencil, Trash2, ArrowUpDown, RefreshCw, Download } from "lucide-react";

interface AssetListClientProps {
  initialUsdJpy: number;
}

export function AssetListClient({
  initialUsdJpy,
}: AssetListClientProps) {
  const { assets, setAssets, deleteAsset } = useAssetsContext();
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<{ key: keyof Asset | 'value' | 'gainLoss'; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export');
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assets_${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Export failed:', error);
      alert('エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  // Sync initial data from page to context
  useEffect(() => {
    // The initialPortfolio prop is no longer passed, so we don't need to sync it here.
    // The context should manage its own state, potentially fetching on mount if empty.
    // If initial data is still needed, it should be passed directly as `initialAssets`
    // and `setAssets(initialAssets)` would be called.
  }, [setAssets]);

  const handleSort = (key: keyof Asset | 'value' | 'gainLoss') => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedAssets = [...assets.assets].sort((a, b) => {
    const aValue = getValue(a, initialUsdJpy);
    const bValue = getValue(b, initialUsdJpy);
    const aGain = getGain(a, initialUsdJpy);
    const bGain = getGain(b, initialUsdJpy);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aCompare: any = a[sortConfig.key as keyof Asset];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bCompare: any = b[sortConfig.key as keyof Asset];

    if (sortConfig.key === 'value') {
      aCompare = aValue;
      bCompare = bValue;
    } else if (sortConfig.key === 'gainLoss') {
      aCompare = aGain;
      bCompare = bGain;
    }

    if (aCompare === bCompare) return 0;
    if (aCompare === null || aCompare === undefined) return 1;
    if (bCompare === null || bCompare === undefined) return -1;

    const comparison = aCompare > bCompare ? 1 : -1;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const handleUpdatePrices = async (silent = false) => {
    setIsUpdating(true);
    try {
      const result = await updateAllAssetPrices();
      if (!silent) {
        alert(`株価更新完了: ${result.updated}件成功, ${result.failed}件失敗`);
      }
      localStorage.setItem('last_price_update', Date.now().toString());
      router.refresh();
    } catch (error) {
      console.warn('Price update error:', error);
      if (!silent) {
        alert('株価更新に失敗しました');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Auto-update check on mount
  useEffect(() => {
    const checkAutoUpdate = () => {
      const lastUpdate = localStorage.getItem('last_price_update');
      const now = Date.now();
      const oneHour = 60 * 60 * 1000; // 1 hour

      if (!lastUpdate || (now - parseInt(lastUpdate)) > oneHour) {
        console.log('Auto-updating prices...');
        handleUpdatePrices(true);
      }
    };

    checkAutoUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm("この資産を削除してもよろしいですか？")) {
      await deleteAsset(id);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">資産一覧</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'エクスポート中...' : 'Markdown'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleUpdatePrices(false)}
            disabled={isUpdating}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? '更新中...' : '株価更新'}
          </Button>
          <Link href="/assets/add">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> 資産を追加
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                銘柄 / 種類 <ArrowUpDown className="ml-2 h-4 w-4 inline" />
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('currentPrice')}>
                現在値 (通貨単価) <ArrowUpDown className="ml-2 h-4 w-4 inline" />
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('value')}>
                評価額 (保有数) <ArrowUpDown className="ml-2 h-4 w-4 inline" />
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort('gainLoss')}>
                損益 <ArrowUpDown className="ml-2 h-4 w-4 inline" />
              </TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  資産がありません。追加してください。
                </TableCell>
              </TableRow>
            ) : (
              sortedAssets.map((asset) => {
                const currentValue = getValue(asset, initialUsdJpy);
                const gainLoss = getGain(asset, initialUsdJpy);
                const isProfit = gainLoss >= 0;

                return (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="font-medium">{asset.name}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-normal">
                            {asset.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{asset.ticker}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {asset.currentPrice ? formatCurrency(asset.currentPrice, asset.currency) : '-'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {asset.avgCost ? formatCurrency(asset.avgCost, asset.currency) : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {formatCurrency(currentValue)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {asset.quantity?.toLocaleString() || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(gainLoss)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/assets/${asset.type === 'bank' || asset.type === 'cash' ? 'edit-cash' : 'edit'}/${asset.id}`}>
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(asset.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function getValue(asset: Asset, usdJpy: number): number {
  if (asset.type === 'bank' || asset.type === 'cash') {
    return asset.balance || 0;
  }
  const price = asset.currentPrice || asset.manualPrice || asset.avgCost || 0;
  const quantity = asset.quantity || 0;

  // For mutual funds (TRUST), price is per 10000 units
  const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;
  const value = price * actualQuantity;

  return asset.currency === 'USD' ? value * usdJpy : value;
}

function getGain(asset: Asset, usdJpy: number): number {
  if (asset.type === 'bank' || asset.type === 'cash') return 0;

  const currentVal = getValue(asset, usdJpy);

  // For mutual funds (TRUST), avgCost is also per 10000 units
  const quantity = asset.quantity || 0;
  const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;
  const cost = (asset.avgCost || 0) * actualQuantity;
  const costInJpy = asset.currency === 'USD' ? cost * usdJpy : cost;

  return currentVal - costInJpy;
}

