import React from 'react';
import useSWR from 'swr';
import {
    ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { format } from 'date-fns';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const LiquidityChart = () => {
    const apiUrl = process.env.NEXT_PUBLIC_QUANT_API_URL || 'http://localhost:8000';

    // 60秒間隔は維持 (これ以上短くしても意味がないため)
    const { data: metrics, isLoading } = useSWR(
        `${apiUrl}/liquidity/metrics?limit=60`,
        fetcher,
        { refreshInterval: 60000 }
    );

    if (isLoading) return <div className="h-full bg-slate-900 rounded-xl animate-pulse"></div>;
    if (!metrics || metrics.length === 0) return <div className="h-full bg-slate-900 rounded-xl flex items-center justify-center text-slate-500">No Data</div>;

    const formatDollar = (value: number) => {
        if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
        return `$${(value / 1e3).toFixed(0)}k`;
    };

    return (
        <div className="bg-slate-950/50 backdrop-blur-sm rounded-xl border border-slate-800 p-4 shadow-2xl h-full flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-2 flex-none">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    🩸 Fuel
                    <span className="text-[10px] font-mono border border-slate-700 bg-slate-900 px-2 py-0.5 rounded text-slate-400">1m</span>
                </h2>
                <div className="text-right">
                    <div className="font-mono text-xs text-orange-400 font-bold">
                        OI: {formatDollar(metrics[metrics.length - 1].oi)}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={metrics} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={(unix) => format(new Date(unix), 'HH:mm')}
                            stroke="#475569"
                            tick={{ fontSize: 10 }}
                            minTickGap={30}
                        />
                        <YAxis
                            yAxisId="left"
                            orientation="left"
                            tickFormatter={formatDollar}
                            stroke="#fb923c"
                            tick={{ fontSize: 10, fill: '#fb923c' }}
                            width={45}
                            domain={['auto', 'auto']}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tickFormatter={(val) => `${(val * 100).toFixed(3)}%`}
                            stroke="#22d3ee"
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            width={45}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', fontSize: '12px' }}
                            formatter={(value: number, name: string) => [
                                name === 'oi' ? formatDollar(value) : `${(value * 100).toFixed(4)}%`,
                                name === 'oi' ? 'OI' : 'FR'
                            ]}
                            labelFormatter={(label) => format(new Date(label), 'MM/dd HH:mm')}
                            isAnimationActive={false} // Tooltipアニメーション無効化
                        />
                        <ReferenceLine yAxisId="right" y={0} stroke="#64748b" strokeDasharray="3 3" />

                        {/* Tuning: アニメーション完全停止 */}
                        <Bar
                            yAxisId="right"
                            dataKey="fr"
                            name="fr"
                            barSize={4}
                            opacity={0.8}
                            isAnimationActive={false}
                        >
                            {metrics.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.fr >= 0 ? '#22d3ee' : '#f472b6'} />
                            ))}
                        </Bar>
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="oi"
                            name="oi"
                            stroke="#fb923c"
                            fill="#fb923c"
                            fillOpacity={0.1}
                            strokeWidth={1}
                            activeDot={false}
                            isAnimationActive={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default LiquidityChart;
