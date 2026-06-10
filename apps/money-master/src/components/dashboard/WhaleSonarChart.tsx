import React from 'react';
import useSWR from 'swr';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis
} from 'recharts';
import { format } from 'date-fns';

interface WhaleData {
    id: string;
    timestamp: number;
    price: number;
    size: number;
    side: 'buy' | 'sell';
    amount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const WhaleSonarChart = () => {
    const apiUrl = process.env.NEXT_PUBLIC_QUANT_API_URL || 'http://localhost:8000';

    // Tuning: 5秒間隔に緩和
    const { data: whales, isLoading } = useSWR<WhaleData[]>(
        `${apiUrl}/sonar/whales?limit=100`,
        fetcher,
        { refreshInterval: 5000 }
    );

    if (isLoading) return <div className="h-full bg-slate-900 rounded-xl animate-pulse flex flex-col items-center justify-center text-slate-500 gap-2"><span>Listening...</span></div>;
    if (!whales || whales.length === 0) return <div className="h-full bg-slate-900 rounded-xl flex items-center justify-center text-slate-500">No Whales Detected</div>;

    const prices = whales.map(w => w.price);
    const minPrice = Math.min(...prices) * 0.9995;
    const maxPrice = Math.max(...prices) * 1.0005;

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data: WhaleData = payload[0].payload;
            const isBuy = data.side === 'buy';
            return (
                <div className={`bg-slate-950/95 border ${isBuy ? 'border-emerald-500/50' : 'border-rose-500/50'} p-2 rounded shadow-2xl text-[10px] z-50 backdrop-blur-md`}>
                    <div className="flex items-center justify-between gap-2 mb-1 border-b border-slate-800 pb-1">
                        <span className="font-mono text-slate-400">{format(new Date(data.timestamp), 'HH:mm:ss')}</span>
                        <span className={`font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {data.side.toUpperCase()}
                        </span>
                    </div>
                    <div><span className="text-slate-400">Val:</span> <span className="text-yellow-400 font-mono font-bold">${Math.round(data.size).toLocaleString()}</span></div>
                    <div><span className="text-slate-400">Px:</span> <span className="text-slate-200 font-mono">${data.price.toLocaleString()}</span></div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-slate-950/50 backdrop-blur-sm rounded-xl border border-slate-800 p-4 shadow-2xl relative overflow-hidden h-full flex flex-col">
            <div className="flex justify-between items-center mb-2 flex-none">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    🐳 Sonar
                    <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 rounded border border-slate-700">5s</span>
                </h2>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            domain={['auto', 'auto']}
                            tickFormatter={(unixTime) => format(new Date(unixTime), 'HH:mm')}
                            stroke="#475569"
                            tick={{ fontSize: 10 }}
                            tickMargin={5}
                        />
                        <YAxis
                            dataKey="price"
                            type="number"
                            domain={[minPrice, maxPrice]}
                            stroke="#475569"
                            tick={{ fontSize: 10 }}
                            width={50}
                            tickFormatter={(val) => val.toLocaleString()}
                        />
                        <ZAxis dataKey="size" range={[20, 800]} name="USD Value" />

                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#475569' }} isAnimationActive={false} />

                        {/* Tuning: アニメーション完全停止 */}
                        <Scatter name="Whales" data={whales} isAnimationActive={false}>
                            {whales.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.side === 'buy' ? '#10b981' : '#f43f5e'}
                                    fillOpacity={0.6}
                                    stroke={entry.side === 'buy' ? '#34d399' : '#fb7185'}
                                    strokeWidth={1}
                                />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default WhaleSonarChart;
