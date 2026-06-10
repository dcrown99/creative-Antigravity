"use client";

import { useState, useTransition } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Badge
} from "@repo/ui";
import { Trash2, RefreshCw, Pencil } from "lucide-react";
import { deleteDividend } from "@/lib/actions";
import { AutoDividendDialog } from "./AutoDividendDialog";
import { EditDividendDialog } from "./EditDividendDialog";
import { Asset } from "@/types";

interface DividendWithAsset {
    id: string;
    assetId: string;
    date: string;
    amount: number;
    currency: 'JPY' | 'USD';
    asset: {
        name: string;
        ticker: string | null;
    };
}

interface DividendListClientProps {
    initialDividends: DividendWithAsset[];
    assets: Asset[];
    usdJpy: number;
}

export function DividendListClient({ initialDividends, assets, usdJpy }: DividendListClientProps) {
    const [dividends, setDividends] = useState<DividendWithAsset[]>(initialDividends);
    const [isAutoDialogOpen, setIsAutoDialogOpen] = useState(false);
    const [editingDividend, setEditingDividend] = useState<DividendWithAsset | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleDelete = async (id: string) => {
        if (!confirm("この配当履歴を削除してもよろしいですか？")) return;

        startTransition(async () => {
            const result = await deleteDividend(id);
            if (result.success) {
                setDividends(prev => prev.filter(d => d.id !== id));
            } else {
                alert("削除に失敗しました");
            }
        });
    };

    const formatCurrency = (amount: number, currency: 'JPY' | 'USD') => {
        return new Intl.NumberFormat('ja-JP', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">配当履歴</h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        再読込
                    </Button>
                    <Button onClick={() => setIsAutoDialogOpen(true)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        配当自動登録
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>配当一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>日付</TableHead>
                                <TableHead>銘柄</TableHead>
                                <TableHead>金額</TableHead>
                                <TableHead>通貨</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dividends.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        配当履歴がありません
                                    </TableCell>
                                </TableRow>
                            ) : (
                                dividends.map((dividend) => (
                                    <TableRow key={dividend.id}>
                                        <TableCell>{dividend.date}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{dividend.asset.ticker || '-'}</span>
                                                <span className="text-xs text-muted-foreground">{dividend.asset.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-green-600">
                                            +{formatCurrency(dividend.amount, dividend.currency)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{dividend.currency}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEditingDividend(dividend)}
                                                >
                                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(dividend.id)}
                                                    disabled={isPending}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AutoDividendDialog
                isOpen={isAutoDialogOpen}
                onClose={() => setIsAutoDialogOpen(false)}
                assets={assets}
                usdJpy={usdJpy}
            />

            <EditDividendDialog
                isOpen={!!editingDividend}
                onClose={() => setEditingDividend(null)}
                dividend={editingDividend}
            />
        </div>
    );
}
