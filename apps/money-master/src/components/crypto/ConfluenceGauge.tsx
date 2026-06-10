import React from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ConfluenceGauge = () => {
    const apiUrl = process.env.NEXT_PUBLIC_QUANT_API_URL || 'http://localhost:8000';

    const { data: depth } = useSWR(`${apiUrl}/depth/walls`, fetcher, { refreshInterval: 1000 });
    const { data: sonar } = useSWR(`${apiUrl}/sonar/whales?limit=10`, fetcher, { refreshInterval: 3000 });
    const { data: liquidity } = useSWR(`${apiUrl}/liquidity/metrics?limit=1`, fetcher, { refreshInterval: 60000 });

    if (!depth || !sonar || !liquidity || liquidity.length === 0) return <div className="h-24 bg-slate-900 rounded-xl animate-pulse"></div>;

    // --- Decision Logic ---
    let score = 0;
    let reasons: string[] = [];

    // [Safety Lock] ショートカバーの危険性チェック
    const fundingRate = liquidity[0]?.fr ?? 0; // 最新のFR
    const isShortSqueezeRisk = fundingRate < -0.0005; // -0.05%以下ならショート過多とみなす(調整可)

    // 1. Wall Analysis
    if (depth.imbalance > 0.15) { score += 3; reasons.push("Buy Wall Detected"); }
    else if (depth.imbalance < -0.15) {
        score -= 3;
        reasons.push("Sell Wall Detected");
    }

    // 2. Sonar Analysis
    const recentWhales = sonar.filter((w: { side: string }) => w.side === 'buy').length - sonar.filter((w: { side: string }) => w.side === 'sell').length;
    if (recentWhales > 0) { score += 4; reasons.push("Whales Buying"); }
    else if (recentWhales < 0) { score -= 4; reasons.push("Whales Selling"); }

    // 3. Liquidity & Context
    const oiHigh = liquidity[0]?.oi > 500000000;

    // 買い判定
    if (score > 0) {
        if (oiHigh) { score += 2; reasons.push("Short Fuel Ready"); } // ショート燃料(売り玉)が溜まってるので上げる
        if (fundingRate < 0) { score += 1; reasons.push("Negative FR (Squeeze)"); } // 踏み上げ期待
    }

    // 売り判定 (Safety Lock発動)
    if (score < 0) {
        if (isShortSqueezeRisk) {
            score = 0; // 強制キャンセル
            reasons = ["⚠️ SHORT SQUEEZE RISK (FR Negative)"];
        } else {
            if (oiHigh) { score -= 2; reasons.push("Long Fuel Ready"); } // ロング燃料(買い玉)が溜まってるので下げる
            if (fundingRate > 0.0003) { score -= 1; reasons.push("Overheated FR"); } // 加熱しすぎ(ロング多すぎ)
        }
    }

    // --- Visualization ---
    const status = score >= 5 ? 'STRONG BUY' : score >= 2 ? 'BUY' : score <= -5 ? 'STRONG SELL' : score <= -2 ? 'SELL' : 'NEUTRAL';
    // 色分け: Sellは赤、Buyは緑、Neutralはグレー、Squeeze警告は黄色
    const colorBg = reasons[0]?.includes("RISK") ? 'bg-yellow-500/10' : score >= 2 ? 'bg-emerald-500' : score <= -2 ? 'bg-rose-500' : 'bg-slate-500';
    const textColor = reasons[0]?.includes("RISK") ? 'text-yellow-400' : score >= 2 ? 'text-emerald-400' : score <= -2 ? 'text-rose-400' : 'text-slate-400';

    return (
        <div className={`bg-slate-950 border border-slate-800 p-6 rounded-xl flex items-center justify-between shadow-2xl relative overflow-hidden ${colorBg}`}>
            {/* Glow Effect */}
            <div className={`absolute inset-0 opacity-20 ${score >= 2 ? 'bg-emerald-500' : score <= -2 ? 'bg-rose-500' : 'bg-transparent'} blur-3xl`}></div>

            <div>
                <h2 className="text-slate-400 text-xs font-mono mb-1">AI DECISION ENGINE</h2>
                <div className={`text-4xl font-black italic tracking-tighter ${textColor} drop-shadow-lg`}>
                    {status}
                </div>
            </div>

            <div className="flex gap-2 flex-wrap justify-end max-w-[50%]">
                {reasons.map((r, i) => (
                    <div key={i} className={`px-3 py-1 bg-slate-900 border ${r.includes("RISK") ? 'border-yellow-500 text-yellow-400' : 'border-slate-700 text-slate-300'} rounded text-xs font-mono whitespace-nowrap`}>
                        {r}
                    </div>
                ))}
                {reasons.length === 0 && <div className="text-xs text-slate-500 font-mono self-center">Scanning market data...</div>}
            </div>

            <div className="text-right ml-4">
                <div className="text-slate-500 text-xs">Score</div>
                <div className="text-2xl font-mono text-white">{isNaN(score) ? 0 : (score > 0 ? `+${score}` : score)}/10</div>
            </div>
        </div>
    );
};

export default ConfluenceGauge;
