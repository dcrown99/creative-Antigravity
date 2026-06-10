import React from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const LagScanner = () => {
    const apiUrl = process.env.NEXT_PUBLIC_QUANT_API_URL || 'http://localhost:8000';

    // Tuning: 2秒間隔 (これでもHFTに対抗する人間用としては十分)
    const { data: lags, isLoading } = useSWR(
        `${apiUrl}/correlation/lags`,
        fetcher,
        { refreshInterval: 2000 }
    );

    if (isLoading || !lags) return <div className="h-full bg-slate-900 rounded-xl animate-pulse"></div>;

    return (
        <div className="bg-slate-950/50 backdrop-blur-sm rounded-xl border border-slate-800 p-4 shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-2 flex-none">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    🐆 Lag
                    <span className="text-[10px] bg-slate-900 px-1.5 rounded border border-slate-700 text-slate-400">2s</span>
                </h2>
                {lags.length > 0 && Math.abs(lags[0].btc_change_10s) > 0.05 && (
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${lags[0].btc_change_10s > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        BTC {lags[0].btc_change_10s > 0 ? '+' : ''}{lags[0].btc_change_10s.toFixed(2)}%
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
                {lags.slice(0, 5).map((item: { symbol: string; gap: number }) => { // Top 5のみ表示でDOM削減
                    const gap = item.gap;
                    const isOpportunity = Math.abs(gap) > 0.15;
                    const direction = gap > 0 ? 'LONG' : 'SHORT';

                    return (
                        <div key={item.symbol} className={`flex justify-between items-center p-1.5 rounded border ${isOpportunity ? 'bg-slate-800 border-slate-600' : 'bg-transparent border-transparent opacity-50'}`}>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-300 w-12">{item.symbol.replace('USDT', '')}</span>
                            </div>
                            {isOpportunity ? (
                                <div className={`flex items-center gap-2 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${gap > 0 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' : 'bg-rose-900/50 text-rose-400 border border-rose-700'}`}>
                                    <span>{direction}</span>
                                    <span>{Math.abs(gap).toFixed(2)}%</span>
                                </div>
                            ) : (
                                <span className="text-[10px] text-slate-600 font-mono">Synced</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LagScanner;
