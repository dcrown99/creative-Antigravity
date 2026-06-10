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
    Popover,
    PopoverContent,
    PopoverTrigger,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Checkbox,
} from "@repo/ui";
import { addDividend } from "@/lib/actions";
import { Asset } from "@/types";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@repo/ui";

interface AddDividendDialogProps {
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    usdJpy: number;
}

export function AddDividendDialog({ isOpen, onClose, assets, usdJpy }: AddDividendDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedAssetId, setSelectedAssetId] = useState<string>("");
    const [openCombobox, setOpenCombobox] = useState(false);
    const [convertFromUsd, setConvertFromUsd] = useState(false);
    const [amount, setAmount] = useState<string>("");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const formData = new FormData(e.currentTarget);

            // Handle currency conversion
            let finalAmount = Number(formData.get('amount'));
            if (convertFromUsd) {
                finalAmount = Math.floor(finalAmount * usdJpy);
            }

            // Override form data
            formData.set('amount', finalAmount.toString());
            formData.set('currency', 'JPY');
            formData.set('assetId', selectedAssetId);

            const result = await addDividend(formData);

            if (result.success) {
                onClose();
                setSelectedAssetId("");
                setAmount("");
                setConvertFromUsd(false);
                window.location.reload(); // Refresh list immediately
            } else {
                alert("配当の追加に失敗しました");
            }
        } catch (error) {
            console.error(error);
            alert("エラーが発生しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssetSelect = (currentValue: string) => {
        setSelectedAssetId(currentValue === selectedAssetId ? "" : currentValue);
        setOpenCombobox(false);

        // Auto-check conversion for US stocks
        const asset = assets.find(a => a.id === currentValue);
        if (asset && (asset.type === 'US_STOCK' || asset.currency === 'USD')) {
            setConvertFromUsd(true);
        } else {
            setConvertFromUsd(false);
        }
    };

    // Filter assets to only show stocks/ETFs/Trusts
    const investmentAssets = assets.filter(a =>
        ['JP_STOCK', 'US_STOCK', 'TRUST', 'ETF'].includes(a.type)
    );

    // Calculate preview amount
    const previewAmount = convertFromUsd && amount
        ? Math.floor(Number(amount) * usdJpy)
        : null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] overflow-visible">
                <DialogHeader>
                    <DialogTitle>配当を追加</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="date">日付</Label>
                        <Input
                            id="date"
                            name="date"
                            type="date"
                            required
                            defaultValue={new Date().toISOString().split('T')[0]}
                        />
                    </div>

                    <div className="space-y-2 flex flex-col">
                        <Label>銘柄</Label>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox} modal={true}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between"
                                >
                                    {selectedAssetId
                                        ? (() => {
                                            const a = assets.find((asset) => asset.id === selectedAssetId)
                                            return a ? `${a.ticker ? `[${a.ticker}] ` : ''}${a.name}` : "銘柄を選択"
                                        })()
                                        : "銘柄を選択"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0 z-[100]">
                                <Command>
                                    <CommandInput placeholder="銘柄を検索..." />
                                    <CommandList>
                                        <CommandEmpty>銘柄が見つかりません</CommandEmpty>
                                        <CommandGroup>
                                            {investmentAssets.map((asset) => (
                                                <CommandItem
                                                    key={asset.id}
                                                    value={asset.id}
                                                    keywords={[asset.name, asset.ticker || '']}
                                                    onSelect={() => handleAssetSelect(asset.id)}
                                                    className="cursor-pointer"
                                                >
                                                    <div
                                                        className="flex items-center w-full"
                                                        onClick={(e) => {
                                                            // Fallback for click issues
                                                            e.stopPropagation();
                                                            handleAssetSelect(asset.id);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedAssetId === asset.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {asset.ticker ? `[${asset.ticker}] ` : ''}{asset.name}
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <input type="hidden" name="assetId" value={selectedAssetId} required />
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">金額 ({convertFromUsd ? 'USD' : 'JPY'})</Label>
                            <Input
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                required
                                placeholder="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="convert"
                                checked={convertFromUsd}
                                onCheckedChange={(checked) => setConvertFromUsd(checked as boolean)}
                            />
                            <label
                                htmlFor="convert"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                USDから日本円に換算する (レート: {usdJpy}円)
                            </label>
                        </div>

                        {previewAmount !== null && (
                            <div className="text-sm text-muted-foreground text-right">
                                換算後: <span className="font-medium text-foreground">{previewAmount.toLocaleString()} JPY</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !selectedAssetId || !amount}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            追加
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
