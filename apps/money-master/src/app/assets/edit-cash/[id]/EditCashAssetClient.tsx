'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@repo/ui';
import { Button } from '@repo/ui';
import { useAssets } from '@/hooks/use-assets';
import { Asset, Currency } from '@/types';

export default function EditCashAssetClient({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { assets: portfolio, updateAsset, deleteAsset } = useAssets();
    const assets = portfolio.assets;

    // 初期値として、もしデータがあればそれを使う
    const foundAsset = assets.find(a => a.id === resolvedParams.id);

    const [asset, setAsset] = useState<Asset | null>(foundAsset || null);
    const [loading, setLoading] = useState(!foundAsset && assets.length === 0);
    const [name, setName] = useState(foundAsset?.name || '');
    const [type, setType] = useState<'bank' | 'cash' | 'other'>((foundAsset?.type as 'bank' | 'cash' | 'other') || 'bank');
    const [balance, setBalance] = useState((foundAsset?.balance || 0).toString());
    const [currency, setCurrency] = useState<Currency>(foundAsset?.currency || 'JPY');

    // 修正: データの同期ロジックを整理
    useEffect(() => {
        // まだassetが未設定で、かつfoundAssetが見つかった場合のみ反映する（初回ロード遅延対応）
        if (foundAsset && !asset) {
            setAsset(foundAsset);
            setName(foundAsset.name);
            setType((foundAsset.type as 'bank' | 'cash' | 'other') || 'bank');
            setBalance((foundAsset.balance || 0).toString());
            setCurrency(foundAsset.currency);
            setLoading(false);
        } else if (assets.length > 0 && !foundAsset && loading) {
            // データはあるが見つからない場合はロード終了
            setLoading(false);
        }
    }, [foundAsset, asset, assets.length, loading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!asset) return;

        updateAsset(asset.id, {
            name,
            type,
            balance: Number(balance),
            currency,
        });
        router.push('/assets');
    };

    const handleDelete = () => {
        if (!asset) return;
        if (confirm(`${asset.name} をアーカイブ（非表示）にしますか？\n※取引履歴は保持されます。`)) {
            deleteAsset(asset.id);
            router.push('/assets');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <div className="animate-pulse text-sm font-medium">読み込み中...</div>
                </div>
            </div>
        );
    }

    if (!asset) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
                <div>資産が見つかりません</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans text-foreground">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-3xl"></div>
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-violet-500/10 blur-3xl"></div>
            </div>

            <Card className="w-full max-w-lg p-8 relative z-10">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <span className="w-1 h-8 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></span>
                        現金・預金を編集
                    </h1>
                    <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        ✕ キャンセル
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-2">名称</label>
                        <input
                            type="text"
                            required
                            placeholder="例: 三井住友銀行, 手持ち現金"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-muted-foreground/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-muted-foreground mb-2">種類</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as 'bank' | 'cash' | 'other')}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
                            >
                                <option value="bank">銀行口座</option>
                                <option value="cash">現金</option>
                                <option value="other">その他</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-muted-foreground mb-2">通貨</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
                            >
                                <option value="JPY">JPY (円)</option>
                                <option value="USD">USD (ドル)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-2">残高</label>
                        <input
                            type="number"
                            required
                            placeholder="0"
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                            className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-muted-foreground/50"
                        />
                    </div>

                    <div className="flex gap-4 mt-8">
                        <Button
                            type="button"
                            onClick={handleDelete}
                            variant="destructive"
                            className="flex-1 h-12 text-lg font-bold shadow-lg shadow-rose-500/25"
                        >
                            アーカイブ
                        </Button>
                        <Button
                            type="submit"
                            className="flex-[2] h-12 text-lg font-bold shadow-lg shadow-emerald-500/25 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                        >
                            更新する
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
