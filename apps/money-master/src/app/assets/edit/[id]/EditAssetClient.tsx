'use client';

import { useState, useEffect, use } from 'react';
import { getAsset, updateAssetJson, getStockName, deleteAsset } from '@/lib/actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Asset, AssetType, AccountType } from '@/types';
import { Card } from '@repo/ui';
import { Button } from '@repo/ui';
import { toast } from 'sonner';

export default function EditAssetClient({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [asset, setAsset] = useState<Asset | null>(null);
    const [loading, setLoading] = useState(true);
    const [ticker, setTicker] = useState('');
    const [name, setName] = useState('');
    const [loadingName, setLoadingName] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchAsset = async () => {
            const data = await getAsset(resolvedParams.id);
            if (data) {
                setAsset(data);
                setTicker(data.ticker ? data.ticker.replace('.T', '') : '');
                setName(data.name);
            }
            setLoading(false);
        };
        fetchAsset();
    }, [resolvedParams.id]);

    useEffect(() => {
        const fetchName = async () => {
            if (ticker.length >= 1) {
                setLoadingName(true);
                let queryTicker = ticker;
                if (/^\d{4}$/.test(ticker)) {
                    queryTicker = ticker + '.T';
                }

                const stockName = await getStockName(queryTicker);
                if (stockName && stockName !== queryTicker) {
                    setName(stockName);
                }
                setLoadingName(false);
            }
        };

        const timeoutId = setTimeout(fetchName, 500);
        return () => clearTimeout(timeoutId);
    }, [ticker]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!asset) return;

        setIsSubmitting(true);
        try {
            const formData = new FormData(e.currentTarget);
            let tickerValue = formData.get('ticker') as string;
            // Auto-append .T suffix for Japanese stock codes (4-digit numbers)
            if (/^\d{4}$/.test(tickerValue)) {
                tickerValue = tickerValue + '.T';
            }

            const data: Partial<Asset> = {
                name: formData.get('name') as string,
                ticker: tickerValue,
                type: formData.get('type') as AssetType,
                account: formData.get('account') as AccountType,
                quantity: Number(formData.get('quantity')),
                avgCost: Number(formData.get('avgCost')),
                currency: formData.get('currency') as 'JPY' | 'USD',
                manualPrice: formData.get('manualPrice')
                    ? Number(formData.get('manualPrice'))
                    : null,
            };

            const result = await updateAssetJson(asset.id, data);
            if (result.success) {
                toast.success('資産を更新しました');
                router.push('/assets');
                router.refresh();
            } else {
                toast.error('更新に失敗しました');
            }
        } catch (error) {
            console.error('Failed to update asset:', error);
            toast.error('エラーが発生しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!asset) return;
        if (confirm(`${asset.name} をアーカイブ（非表示）にしますか？\n※取引履歴は保持されます。`)) {
            await deleteAsset(asset.id);
            toast.success('資産をアーカイブしました');
            router.push('/assets');
            router.refresh();
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
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <span className="w-1 h-8 bg-gradient-to-b from-blue-500 to-violet-500 rounded-full"></span>
                        資産を編集
                    </h1>
                    <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        ✕ キャンセル
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-muted-foreground mb-2">ティッカー</label>
                            <input
                                name="ticker"
                                type="text"
                                required
                                placeholder="例: 7203"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value)}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-muted-foreground/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-muted-foreground mb-2">銘柄名</label>
                            <div className="relative">
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    placeholder="例: トヨタ自動車"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-muted-foreground/50"
                                />
                                {loadingName && (
                                    <div className="absolute right-3 top-3.5">
                                        <div className="animate-spin h-4 w-4 border-2 border-primary rounded-full border-t-transparent"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-muted-foreground mb-2">種類</label>
                            <select name="type" defaultValue={asset.type} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none">
                                <option value="JP_STOCK">日本株</option>
                                <option value="US_STOCK">米国株</option>
                                <option value="TRUST">投資信託</option>
                                <option value="ETF">ETF</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-muted-foreground mb-2">口座</label>
                            <select name="account" defaultValue={asset.account || undefined} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none">
                                <option value="TOKUTEI">特定口座</option>
                                <option value="NISA_TSUMITATE">NISA (つみたて)</option>
                                <option value="NISA_GROWTH">NISA (成長)</option>
                                <option value="IDECO">iDeCo</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-muted-foreground mb-2">数量</label>
                            <input
                                name="quantity"
                                type="number"
                                step="any"
                                required
                                placeholder="0"
                                defaultValue={asset.quantity || ''}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-muted-foreground/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-muted-foreground mb-2">取得単価</label>
                            <input
                                name="avgCost"
                                type="number"
                                step="any"
                                required
                                placeholder="0"
                                defaultValue={asset.avgCost || ''}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-muted-foreground/50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-2">現在価格 (手動)</label>
                        <input
                            name="manualPrice"
                            type="number"
                            step="any"
                            placeholder="空欄なら自動取得"
                            defaultValue={asset.manualPrice || ''}
                            className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-muted-foreground/50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-2">通貨</label>
                        <select name="currency" defaultValue={asset.currency} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none">
                            <option value="JPY">JPY (円)</option>
                            <option value="USD">USD (ドル)</option>
                        </select>
                    </div>

                    <div className="flex gap-4 mt-8">
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            className="flex-1 h-12 text-lg font-bold"
                        >
                            アーカイブ
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[2] h-12 text-lg font-bold shadow-lg shadow-blue-500/25"
                        >
                            {isSubmitting ? '更新中...' : '更新する'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
