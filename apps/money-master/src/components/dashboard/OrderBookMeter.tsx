import React from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const OrderBookMeter = () => {
    const apiUrl = process.env.NEXT_PUBLIC_QUANT_API_URL || 'http://localhost:8000';

    // Tuning: 3秒間隔に緩和 (板全体の傾向を見るには十分)
    const { data, isLoading } = useSWR(
        `${apiUrl}/depth/walls`,
        fetcher,
        { refreshInterval: 3000 }
    );

    if (isLoading || !data) return <div className="h-full bg-slate-900 rounded-xl animate-pulse"></div>;

    const {
        bids_total, asks_total, imbalance, best_bid: _best_bid, best_ask: _best_ask,
        wall_bid_price, wall_bid_vol, wall_ask_price, wall_ask_vol
    } = data;

    const total = bids_total + asks_total;
    const bidPct = (bids_total / total) * 100;
    const askPct = (asks_total / total) * 100;

    const statusText = imbalance > 0.15 ? 'BUY PRESSURE' : imbalance < -0.15 ? 'SELL PRESSURE' : 'BALANCED';
    const statusColor = imbalance > 0.15 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : imbalance < -0.15 ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' : 'text-slate-400 border-slate-700 bg-slate-800';

    const formatUsd = (val: number) => `$${(val / 1e6).toFixed(1)}M`;
    const formatPrice = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    return (
        <div className="bg-slate-950/50 backdrop-blur-sm rounded-xl border border-slate-800 p-4 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    🧱 Wall
                    <span className="text-[10px] bg-slate-900 px-1.5 rounded border border-slate-700 text-slate-400">3s</span>
                </h2>
                <div className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded border ${statusColor}`}>
                    {statusText}
                </div>
            </div>

            <div className="mb-4">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${bidPct}%` }}></div>
                    <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${askPct}%` }}></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 flex-1">
                <div className="bg-emerald-950/20 border border-emerald-900/50 rounded p-2 flex flex-col justify-center">
                    <div className="text-[10px] text-emerald-600 uppercase font-bold">Support</div>
                    <div className="text-sm font-mono font-bold text-emerald-400">{formatPrice(wall_bid_price)}</div>
                    <div className="text-[10px] text-slate-500">{formatUsd(wall_bid_vol)}</div>
                </div>

                <div className="bg-rose-950/20 border border-rose-900/50 rounded p-2 flex flex-col justify-center">
                    <div className="text-[10px] text-rose-600 uppercase font-bold">Resist</div>
                    <div className="text-sm font-mono font-bold text-rose-400">{formatPrice(wall_ask_price)}</div>
                    <div className="text-[10px] text-slate-500">{formatUsd(wall_ask_vol)}</div>
                </div>
            </div>
        </div>
    );
};

export default OrderBookMeter;
