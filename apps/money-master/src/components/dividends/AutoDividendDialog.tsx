"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Checkbox
} from "@repo/ui";
import { addDividendsBulk } from "@/lib/actions";
import { Asset } from "@/types";
import { Loader2 } from "lucide-react";

interface AutoDividendDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  usdJpy: number;
}

interface DividendPrediction {
  assetId: string;
  assetName: string;
  ticker: string | null;
  currency: 'JPY';
  quantity: number;
  currentPrice: number;
  dividendYield: number;
  predictedAmount: number;
  selected: boolean;
}

export function AutoDividendDialog({ isOpen, onClose, assets, usdJpy }: AutoDividendDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dividendDate, setDividendDate] = useState(new Date().toISOString().split('T')[0]);
  const [predictions, setPredictions] = useState<DividendPrediction[]>([]);
  const [editedAmounts, setEditedAmounts] = useState<Record<string, number>>({});

  useMemo(() => {
    const calculated = assets
      .filter(asset => {
        const isInvestment = ['JP_STOCK', 'US_STOCK', 'ETF', 'TRUST'].includes(asset.type);
        const hasDividendYield = (asset.dividendYield ?? 0) > 0;
        const hasQuantityAndPrice = (asset.quantity ?? 0) > 0 && (asset.currentPrice ?? 0) > 0;
        return isInvestment && hasDividendYield && hasQuantityAndPrice;
      })
      .map(asset => {
        const quantity = asset.quantity!;
        let currentPrice = asset.currentPrice!;
        const dividendYield = asset.dividendYield!;

        if (asset.currency === 'USD') {
          currentPrice = currentPrice * usdJpy;
        }

        // 予想配当額 = 現在価格 * 数量 * 配当利回り
        const predictedAmount = Math.floor(currentPrice * quantity * dividendYield);

        return {
          assetId: asset.id,
          assetName: asset.name,
          ticker: asset.ticker ?? null,
          currency: 'JPY' as const,
          quantity,
          currentPrice,
          dividendYield,
          predictedAmount,
          selected: false, // Default unchecked
        };
      });

    setPredictions(calculated);
    // Initialize edited amounts
    const initialAmounts: Record<string, number> = {};
    calculated.forEach(p => {
      initialAmounts[p.assetId] = p.predictedAmount;
    });
    setEditedAmounts(initialAmounts);
  }, [assets, usdJpy]);

  const handleToggleSelection = (assetId: string) => {
    setPredictions(prev =>
      prev.map(p =>
        p.assetId === assetId ? { ...p, selected: !p.selected } : p
      )
    );
  };

  const handleToggleAll = () => {
    const allSelected = predictions.every(p => p.selected);
    setPredictions(prev =>
      prev.map(p => ({ ...p, selected: !allSelected }))
    );
  };

  const handleAmountChange = (assetId: string, value: string) => {
    const numValue = Number(value);
    setEditedAmounts(prev => ({
      ...prev,
      [assetId]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const handleBulkRegister = async () => {
    const selectedDividends = predictions
      .filter(p => p.selected)
      .map(p => ({
        assetId: p.assetId,
        date: dividendDate,
        amount: editedAmounts[p.assetId] ?? p.predictedAmount,
        currency: p.currency,
      }));

    if (selectedDividends.length === 0) {
      alert('登録する配当を選択してください');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addDividendsBulk(selectedDividends);
      if (result.success) {
        onClose();
        window.location.reload();
      } else {
        alert('配当の登録に失敗しました');
      }
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number, currency: 'JPY' | 'USD') => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const selectedCount = predictions.filter(p => p.selected).length;
  const allSelected = predictions.length > 0 && predictions.every(p => p.selected);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>配当自動登録</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            配当利回りが設定されている資産から予想配当を計算しました。登録する配当を選択し、必要に応じて金額を修正してください。
          </p>

          <div className="space-y-2">
            <Label htmlFor="dividendDate">配当受取日</Label>
            <Input
              id="dividendDate"
              type="date"
              value={dividendDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDividendDate(e.target.value)}
            />
          </div>

          {predictions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              配当利回りが設定されている資産がありません
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleToggleAll}
                      />
                    </TableHead>
                    <TableHead>銘柄</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">現在価格</TableHead>
                    <TableHead className="text-right">利回り</TableHead>
                    <TableHead className="text-right">予想配当額</TableHead>
                    <TableHead className="w-[150px]">登録額(JPY)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.map((prediction) => (
                    <TableRow key={prediction.assetId}>
                      <TableCell>
                        <Checkbox
                          checked={prediction.selected}
                          onCheckedChange={() => handleToggleSelection(prediction.assetId)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {prediction.ticker ? `[${prediction.ticker}] ` : ''}
                            {prediction.assetName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {prediction.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(prediction.currentPrice, prediction.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(prediction.dividendYield * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(prediction.predictedAmount, prediction.currency)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editedAmounts[prediction.assetId] ?? prediction.predictedAmount}
                          onChange={(e) => handleAmountChange(prediction.assetId, e.target.value)}
                          className="text-right h-8"
                          onClick={(e) => e.stopPropagation()} // Prevent row click if any
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {selectedCount > 0 && `${selectedCount}件の配当を登録`}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              onClick={handleBulkRegister}
              disabled={isSubmitting || selectedCount === 0}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              一括登録
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
