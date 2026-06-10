'use client';

import React from 'react';
import useSWR from 'swr';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ZAxis,
} from 'recharts';
import { format } from 'date-fns';

// --- 型定義 ---
interface WhaleData {
  id: string;
  timestamp: number;
  price: number;
  size: number; // USD Value
  side: 'buy' | 'sell';
  amount: number;
}

interface WhaleSonarChartProps {
  apiUrl?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const WhaleSonarChart = ({ apiUrl }: WhaleSonarChartProps) => {
  // ブラウザから直接アクセスするため、localhost:8002を使用
  const baseUrl = apiUrl || process.env.NEXT_PUBLIC_QUANT_API_URL || 'http://localhost:8002';

  const { data: whales, isLoading, error } = useSWR<WhaleData[]>(
    `${baseUrl}/sonar/whales?limit=100`,
    fetcher,
    { refreshInterval: 3000 } // 3秒ポーリング
  );

  if (isLoading) {
    return (
      <div className="h-[300px] bg-slate-900 rounded-xl animate-pulse flex flex-col items-center justify-center text-slate-500 gap-2">
        <span className="text-2xl">🐳</span>
        <span>Listening to the Deep...</span>
        <span className="text-xs">Connecting to Sonar Feed</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[300px] bg-slate-900 rounded-xl flex flex-col items-center justify-center text-rose-400 gap-2">
        <span className="text-2xl">⚠️</span>
        <span>Sonar Feed Offline</span>
        <span className="text-xs text-slate-500">Check quant-brain service (localhost:8002)</span>
      </div>
    );
  }

  if (!whales || whales.length === 0) {
    return (
      <div className="h-[300px] bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2">
        <span className="text-2xl">🐳</span>
        <span>No Whales Detected Yet...</span>
        <span className="text-xs">Waiting for &gt;$100k trade</span>
      </div>
    );
  }

  // Y軸の表示範囲を自動調整
  const prices = whales.map((w) => w.price);
  const minPrice = Math.min(...prices) * 0.9995;
  const maxPrice = Math.max(...prices) * 1.0005;

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: WhaleData }> }) => {
    if (active && payload && payload.length) {
      const data: WhaleData = payload[0].payload;
      const isBuy = data.side === 'buy';
      return (
        <div
          className={`bg-slate-950/95 border ${isBuy ? 'border-emerald-500/50' : 'border-rose-500/50'} p-3 rounded-lg shadow-2xl text-xs z-50 backdrop-blur-md`}
        >
          <div className="flex items-center justify-between gap-4 mb-2 border-b border-slate-800 pb-2">
            <span className="font-mono text-slate-400">
              {format(new Date(data.timestamp), 'HH:mm:ss')}
            </span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-[10px] ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}
            >
              {data.side.toUpperCase()} WHALE
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-slate-400">Price:</span>
            <span className="text-slate-200 text-right font-mono">
              ${data.price.toLocaleString()}
            </span>

            <span className="text-slate-400">Value:</span>
            <span className="text-yellow-400 text-right font-mono font-bold">
              ${Math.round(data.size).toLocaleString()}
            </span>

            <span className="text-slate-400">Vol:</span>
            <span className="text-slate-200 text-right font-mono">
              {data.amount.toFixed(4)} BTC
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-950/50 backdrop-blur-sm rounded-xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden group">
      {/* Background Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950/50 to-slate-950 pointer-events-none"></div>

      {/* Header */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3">
            <span className="text-2xl">🐳</span> The Sonar
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 tracking-wider">
                LIVE FEED
              </span>
            </div>
          </h2>
          <p className="text-xs text-slate-400 mt-1 pl-1">
            Monitoring trades &gt; $100,000. Bubble size represents USD value.
          </p>
        </div>

        {/* Stats */}
        <div className="text-right hidden sm:block">
          <div className="text-xs text-slate-500 mb-1">Last Detection</div>
          <div className="font-mono text-sm text-emerald-400">
            {whales.length > 0
              ? format(new Date(whales[whales.length - 1].timestamp), 'HH:mm:ss')
              : '--:--:--'}
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-[300px] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['auto', 'auto']}
              tickFormatter={(unixTime) => format(new Date(unixTime), 'HH:mm')}
              stroke="#475569"
              tick={{ fontSize: 11 }}
              tickMargin={10}
            />
            <YAxis
              dataKey="price"
              type="number"
              domain={[minPrice, maxPrice]}
              stroke="#475569"
              tick={{ fontSize: 11 }}
              width={70}
              tickFormatter={(val) => `$${val.toLocaleString()}`}
            />

            {/* range: バブルの面積の最小・最大ピクセル数 */}
            <ZAxis dataKey="size" range={[50, 1000]} name="USD Value" />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: '3 3', stroke: '#475569' }}
            />

            <Scatter name="Whales" data={whales} animationDuration={500}>
              {whales.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.side === 'buy' ? '#10b981' : '#f43f5e'}
                  fillOpacity={0.5}
                  stroke={entry.side === 'buy' ? '#34d399' : '#fb7185'}
                  strokeWidth={2}
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
