import React from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const LiquidationHeatmap = () => {
    const apiUrl = process.env.NEXT_PUBLIC_QUANT_API_URL || 'http://localhost:8000';

    // Tuning: 10秒間隔
    const { data: magnets, isLoading } = useSWR(
        `${apiUrl}/magnet/levels`,
        fetcher,
        { refreshInterval: 10000 }
    );

    // 距離計算用Ticker (Magnetと合わせて10秒でOK)
    const { data: depth } = useSWR(`${apiUrl}/depth/walls`, fetcher, { refreshInterval: 10000 });
    const currentPrice = depth ? (depth.best_bid + depth.best_ask) / 2 : 0;

    if (isLoading) return <div className="h-full bg-slate-900 rounded-xl animate-pulse"></div>;
    if (!magnets) return <div className="h-full bg-slate-900 rounded-xl"></div>;

    const clusters: { price: number; strength: number; side: string }[] = [];
    const range = 50;
    magnets.forEach((m: { price: number; strength: number; side: string }) => {
        const bucket = Math.floor(m.price / range) * range;
        const existing = clusters.find(c => c.price === bucket && c.side === m.side);
        if (existing) {
            existing.strength += m.strength;
        } else {
            clusters.push({ price: bucket, strength: m.strength, side: m.side });
        }
    });

    const topLongLiqs = clusters.filter(c => c.side === 'long_liq').sort((a, b) => b.strength - a.strength).slice(0, 3);
    const topShortLiqs = clusters.filter(c => c.side === 'short_liq').sort((a, b) => b.strength - a.strength).slice(0, 3);

    const formatPrice = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const formatStrength = (val: number) => `$${(val / 1e6).toFixed(1)}M`;
    const getDistance = (target: number) => {
        if (!currentPrice) return '';
        const dist = ((target - currentPrice) / currentPrice) * 100;
        return dist > 0 ? `+${dist.toFixed(2)}%` : `${dist.toFixed(2)}%`;
    };

    return (
        <div className="bg-slate-950/50 backdrop-blur-sm rounded-xl border border-slate-800 p-4 shadow-2xl flex flex-col justify-between h-full overflow-hidden">
            <div className="flex justify-between items-center mb-2 flex-none">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    🧲 Magnet
                    <span className="text-[10px] bg-slate-900 px-1.5 rounded border border-slate-700 text-slate-400">10s</span>
                </h2>
            </div>

            <div className="flex flex-col gap-1 flex-1 justify-center overflow-y-auto">
                <div className="flex flex-col-reverse gap-1 mb-2">
                    {topShortLiqs.map((m, i) => (
                        <div key={i} className="flex justify-between items-center bg-rose-950/20 border-l-2 border-rose-500 px-2 py-1 rounded-r relative overflow-hidden group">
                            <div className="absolute left-0 top-0 bottom-0 bg-rose-500/10" style={{ width: `${Math.min(m.strength / 5000000 * 100, 100)}%` }}></div>
                            <div className="z-10 flex flex-col">
                                <span className="font-mono text-rose-300 font-bold text-xs">{formatPrice(m.price)}</span>
                                <span className="text-[9px] text-rose-500/80">{getDistance(m.price)}</span>
                            </div>
                            <span className="font-mono text-[10px] text-rose-400/70 z-10">{formatStrength(m.strength)}</span>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-center gap-2 my-1 opacity-30">
                    <div className="h-[1px] flex-1 bg-slate-600"></div>
                    <span className="text-[9px] text-slate-400 font-mono">CURRENT</span>
                    <div className="h-[1px] flex-1 bg-slate-600"></div>
                </div>

                <div className="flex flex-col gap-1 mt-2">
                    {topLongLiqs.map((m, i) => (
                        <div key={i} className="flex justify-between items-center bg-emerald-950/20 border-l-2 border-emerald-500 px-2 py-1 rounded-r relative overflow-hidden group">
                            <div className="absolute left-0 top-0 bottom-0 bg-emerald-500/10" style={{ width: `${Math.min(m.strength / 5000000 * 100, 100)}%` }}></div>
                            <div className="z-10 flex flex-col">
                                <span className="font-mono text-emerald-300 font-bold text-xs">{formatPrice(m.price)}</span>
                                <span className="text-[9px] text-emerald-500/80">{getDistance(m.price)}</span>
                            </div>
                            <span className="font-mono text-[10px] text-emerald-400/70 z-10">{formatStrength(m.strength)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiquidationHeatmap;
