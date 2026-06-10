'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@repo/ui';
import { Scale, Target, Plus, Minus, RefreshCw, Save, Loader2 } from 'lucide-react';
import { Asset } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface RebalanceWidgetProps {
    assets: Asset[];
    usdJpy: number;
}

interface AllocationTarget {
    sector: string;
    label: string;
    currentPercent: number;
    targetPercent: number;
    currentValue: number;
    targetValue: number;
    difference: number;
    action: 'buy' | 'sell' | 'hold';
}

// セクター（タイプ）ラベル - types/index.tsのAssetTypeに対応
const TYPE_LABELS: Record<string, string> = {
    'JP_STOCK': '日本株',
    'US_STOCK': '米国株',
    'STOCK': '個別株',
    'TRUST': '投資信託',
    'ETF': 'ETF',
    'CRYPTO': '暗号資産',
    'CASH': '現金',
    'BANK': '銀行口座',
    'CREDIT': 'クレジット',
    'BOND': '債券',
    'OTHER': 'その他',
};


// デフォルト目標配分 - types/index.tsのAssetTypeに対応
// 実際に保有しているセクターのみを対象にし、保有がないセクターは提案しない
const DEFAULT_TARGETS: Record<string, number> = {
    'JP_STOCK': 20,
    'US_STOCK': 20,
    'TRUST': 30,
    'ETF': 15,
    'BANK': 10,
    'CASH': 5,
};


export function RebalanceWidget({ assets, usdJpy }: RebalanceWidgetProps) {
    // 目標配分（DB永続化対応）
    const [targets, setTargets] = useState<Record<string, number>>(DEFAULT_TARGETS);
    const [isEditing, setIsEditing] = useState(false);
    const [, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // 初回ロード時にAPIから目標配分を取得
    useEffect(() => {
        const loadTargets = async () => {
            try {
                const res = await fetch('/api/allocation-targets');
                const data = await res.json();
                if (data.success && data.targets) {
                    setTargets(data.targets);
                }
            } catch (error) {
                console.error('Failed to load allocation targets:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadTargets();
    }, []);

    // 目標配分を保存
    const handleSaveTargets = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/allocation-targets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('目標配分を保存しました');
                setIsEditing(false);
            } else {
                toast.error(`保存に失敗しました: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to save allocation targets:', error);
            toast.error('保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    // 現在のセクター別配分を計算
    const { sectorAllocation, totalValue } = useMemo(() => {
        const sectorMap = new Map<string, number>();
        let total = 0;

        assets.forEach(asset => {
            const sector = asset.type.toUpperCase();

            let value = 0;
            // bank/cashタイプはbalanceを使用
            if (asset.type === 'bank' || asset.type === 'cash') {
                value = asset.balance || 0;
            } else {
                // 株式、ETF、投資信託の場合
                const price = asset.currentPrice || asset.manualPrice || asset.avgCost || 0;
                const quantity = asset.quantity || 0;
                // 投資信託(TRUST)はpriceが1万口あたり
                const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;
                value = price * actualQuantity;
                // USD→JPY変換
                if (asset.currency === 'USD') {
                    value *= usdJpy;
                }
            }

            sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
            total += value;
        });

        return { sectorAllocation: sectorMap, totalValue: total };
    }, [assets, usdJpy]);

    // リバランス提案を計算（保有セクターのみを対象）
    const rebalanceData: AllocationTarget[] = useMemo(() => {
        // 保有セクターのみを対象にする（目標配分だけのセクターは除外）
        const holdingSectors = [...sectorAllocation.keys()];
        const result: AllocationTarget[] = [];

        holdingSectors.forEach(sector => {
            const currentValue = sectorAllocation.get(sector) || 0;
            const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
            const targetPercent = targets[sector] || 0;
            const targetValue = totalValue * (targetPercent / 100);
            const difference = targetValue - currentValue;

            let action: 'buy' | 'sell' | 'hold' = 'hold';
            if (Math.abs(difference) > totalValue * 0.02) { // 2%以上の差異で提案
                action = difference > 0 ? 'buy' : 'sell';
            }

            result.push({
                sector,
                label: TYPE_LABELS[sector] || sector,
                currentPercent,
                targetPercent,
                currentValue,
                targetValue,
                difference,
                action,
            });
        });

        return result.filter(d => d.currentValue > 0)
            .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    }, [sectorAllocation, targets, totalValue]);

    // 目標配分の合計
    const targetTotal = Object.values(targets).reduce((sum, v) => sum + v, 0);

    // 目標配分を更新
    const updateTarget = (sector: string, value: number) => {
        setTargets(prev => ({
            ...prev,
            [sector]: Math.max(0, Math.min(100, value)),
        }));
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Scale className="w-5 h-5" />
                        リバランス提案
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(!isEditing)}
                    >
                        <Target className="w-4 h-4 mr-1" />
                        {isEditing ? '完了' : '目標設定'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    // 目標配分編集モード
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            各セクターの目標配分率を設定してください（合計: {targetTotal}%）
                        </p>
                        {targetTotal !== 100 && (
                            <p className="text-sm text-amber-500">
                                ⚠️ 合計が100%になるよう調整してください
                            </p>
                        )}
                        <div className="space-y-3">
                            {Object.entries(TYPE_LABELS).map(([sector, label]) => (
                                <div key={sector} className="flex items-center gap-3">
                                    <Label className="w-24">{label}</Label>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => updateTarget(sector, (targets[sector] || 0) - 5)}
                                    >
                                        <Minus className="w-3 h-3" />
                                    </Button>
                                    <Input
                                        type="number"
                                        value={targets[sector] || 0}
                                        onChange={(e) => updateTarget(sector, parseInt(e.target.value) || 0)}
                                        className="w-20 text-center"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => updateTarget(sector, (targets[sector] || 0) + 5)}
                                    >
                                        <Plus className="w-3 h-3" />
                                    </Button>
                                    <span className="text-muted-foreground">%</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTargets(DEFAULT_TARGETS)}
                                className="flex-1"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                デフォルトに戻す
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveTargets}
                                disabled={isSaving || targetTotal !== 100}
                                className="flex-1"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                保存
                            </Button>
                        </div>
                    </div>
                ) : (
                    // リバランス提案表示モード
                    <div className="space-y-4">
                        {rebalanceData.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">
                                資産データがありません
                            </p>
                        ) : (
                            <>
                                {rebalanceData.filter(d => d.action !== 'hold').length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-green-600 font-medium">✓ ポートフォリオはバランスが取れています</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            現在の配分は目標配分に近いです
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {rebalanceData.filter(d => d.action !== 'hold').map(item => (
                                            <div
                                                key={item.sector}
                                                className={`p-3 rounded-lg border ${item.action === 'buy'
                                                    ? 'bg-green-500/10 border-green-500/20'
                                                    : 'bg-red-500/10 border-red-500/20'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium">{item.label}</span>
                                                    <span className={item.action === 'buy' ? 'text-green-600' : 'text-red-500'}>
                                                        {item.action === 'buy' ? '買い増し' : '売却'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm text-muted-foreground">
                                                    <span>
                                                        現在 {item.currentPercent.toFixed(1)}% → 目標 {item.targetPercent}%
                                                    </span>
                                                    <span className={item.action === 'buy' ? 'text-green-600' : 'text-red-500'}>
                                                        {item.action === 'buy' ? '+' : ''}{formatCurrency(item.difference)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 現在の配分サマリー */}
                                <div className="pt-4 border-t">
                                    <p className="text-sm text-muted-foreground mb-2">現在の配分</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {rebalanceData.filter(d => d.currentPercent > 0).map(item => (
                                            <div key={item.sector} className="flex justify-between">
                                                <span>{item.label}</span>
                                                <span>{item.currentPercent.toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
