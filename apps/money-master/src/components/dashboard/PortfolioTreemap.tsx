"use client";

import { useMemo } from "react";
import { Portfolio } from "@/types";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface PortfolioTreemapProps {
    portfolio: Portfolio;
    usdJpy: number;
}

interface TreemapData {
    name: string;
    size: number;
    gainLossRate: number;
    gainLoss: number;
    value: number;
    cost: number;
    type: string;
    ticker?: string;
}

export function PortfolioTreemap({ portfolio, usdJpy }: PortfolioTreemapProps) {
    const treemapData = useMemo(() => {
        return portfolio.assets
            .filter(asset => !asset.isArchived)
            .map(asset => {
                // 評価額の計算
                let value = 0;
                if (asset.type === 'bank' || asset.type === 'cash') {
                    value = asset.balance || 0;
                } else {
                    const price = asset.currentPrice || asset.manualPrice || asset.avgCost || 0;
                    const quantity = asset.quantity || 0;
                    const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;
                    value = price * actualQuantity;

                    // USD資産をJPYに変換
                    if (asset.currency === 'USD') {
                        value *= usdJpy;
                    }
                }

                // 取得コストの計算
                let cost = 0;
                if (asset.type !== 'bank' && asset.type !== 'cash' && asset.avgCost) {
                    const quantity = asset.quantity || 0;
                    const actualQuantity = asset.type === 'TRUST' ? quantity / 10000 : quantity;
                    cost = asset.avgCost * actualQuantity;

                    if (asset.currency === 'USD') {
                        cost *= usdJpy;
                    }
                }

                // 損益の計算
                const gainLoss = value - cost;
                const gainLossRate = cost > 0 ? (gainLoss / cost) * 100 : 0;

                return {
                    name: asset.name,
                    size: value,
                    gainLossRate,
                    gainLoss,
                    value,
                    cost,
                    type: asset.type,
                    ticker: asset.ticker || undefined,
                };
            })
            .filter(item => item.size > 0) // サイズが0以上の資産のみ
            .sort((a, b) => b.size - a.size); // サイズの降順でソート
    }, [portfolio.assets, usdJpy]);

    const getColor = (gainLossRate: number): string => {
        if (gainLossRate > 0) {
            // プラス: 暗めの緑（ダークモードに馴染む）
            const intensity = Math.min(gainLossRate / 20, 1);

            // より暗く、彩度を抑えた緑
            // 色相: 145 (青緑寄り), 彩度: 30-50%, 明度: 25-40%
            const saturation = 30 + intensity * 20; // 30% - 50%
            const lightness = 25 + intensity * 15;  // 25% - 40%
            return `hsl(145, ${saturation}%, ${lightness}%)`;
        } else if (gainLossRate < 0) {
            // マイナス: 暗めの赤（ダークモードに馴染む）
            const intensity = Math.min(Math.abs(gainLossRate) / 20, 1);

            // より暗く、彩度を抑えた赤
            // 色相: 0-5 (赤), 彩度: 35-55%, 明度: 25-38%
            const hue = 0 + intensity * 5;           // 0° - 5°
            const saturation = 35 + intensity * 20;  // 35% - 55%
            const lightness = 25 + intensity * 13;   // 25% - 38%
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        } else {
            // 損益データなし: ダークモードに馴染むグレー
            return 'hsl(0, 0%, 35%)';
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0].payload as TreemapData;

            return (
                <div className="bg-background border rounded-lg p-3 shadow-lg">
                    <p className="font-bold text-sm mb-2">
                        {data.ticker ? `[${data.ticker}] ` : ''}{data.name || '不明'}
                    </p>
                    <p className="text-xs text-muted-foreground mb-1">
                        種別: {data.type}
                    </p>
                    <p className="text-sm font-medium">
                        評価額: {formatCurrency(data.value)}
                    </p>
                    {data.cost > 0 && (
                        <>
                            <p className="text-xs text-muted-foreground">
                                取得額: {formatCurrency(data.cost)}
                            </p>
                            <p className={`text-sm font-bold ${data.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                損益: {data.gainLoss >= 0 ? '+' : ''}{formatCurrency(data.gainLoss)}
                                ({data.gainLossRate >= 0 ? '+' : ''}{data.gainLossRate.toFixed(2)}%)
                            </p>
                        </>
                    )}
                </div>
            );
        }
        return null;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomizedContent = (props: any) => {
        const { x, y, width, height, name, size, gainLossRate } = props;
        const color = getColor(gainLossRate || 0);
        const displayName = name || '不明';

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                        fill: color,
                        stroke: '#fff',
                        strokeWidth: 2,
                    }}
                />
                {width > 80 && height > 40 && (
                    <text
                        x={x + width / 2}
                        y={y + height / 2 - 5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize={13}
                        fontWeight="600"
                    >
                        {displayName.length > 15 ? displayName.substring(0, 12) + '...' : displayName}
                    </text>
                )}
                {width > 80 && height > 60 && size !== undefined && (
                    <text
                        x={x + width / 2}
                        y={y + height / 2 + 15}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#e0e0e0"
                        fontSize={11}
                        fontWeight="400"
                    >
                        {formatCurrency(size)}
                    </text>
                )}
            </g>
        );
    };

    if (treemapData.length === 0) {
        return (
            <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                表示する資産がありません
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={500}>
            <Treemap
                data={treemapData}
                dataKey="size"
                stroke="#fff"
                fill="#8884d8"
                content={<CustomizedContent />}
            >
                <Tooltip content={<CustomTooltip />} />
            </Treemap>
        </ResponsiveContainer>
    );
}
