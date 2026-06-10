"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Button,
    Input,
    Label,
} from "@repo/ui";
import { updateDividend } from "@/lib/actions";
import { Loader2 } from "lucide-react";

interface EditDividendDialogProps {
    isOpen: boolean;
    onClose: () => void;
    dividend: {
        id: string;
        date: string;
        amount: number;
        currency: 'JPY' | 'USD';
        asset: {
            name: string;
            ticker: string | null;
        };
    } | null;
}

export function EditDividendDialog({ isOpen, onClose, dividend }: EditDividendDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!dividend) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const formData = new FormData(e.currentTarget);
            const result = await updateDividend(dividend.id, formData);

            if (result.success) {
                onClose();
                window.location.reload();
            } else {
                alert("配当の更新に失敗しました");
            }
        } catch (error) {
            console.error(error);
            alert("エラーが発生しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>配当を編集</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>銘柄</Label>
                        <div className="text-sm font-medium">
                            {dividend.asset.ticker ? `[${dividend.asset.ticker}] ` : ''}{dividend.asset.name}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="date">日付</Label>
                        <Input
                            id="date"
                            name="date"
                            type="date"
                            required
                            defaultValue={dividend.date}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">金額 ({dividend.currency})</Label>
                        <Input
                            id="amount"
                            name="amount"
                            type="number"
                            step="0.01"
                            required
                            defaultValue={dividend.amount}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            更新
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
