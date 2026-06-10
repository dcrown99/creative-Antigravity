"use client";

import { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@repo/ui";

interface ConfirmDialogProps {
    /** Trigger element (button) */
    trigger: React.ReactNode;
    /** Dialog title */
    title: string;
    /** Dialog description */
    description?: string;
    /** Confirm button label */
    confirmLabel?: string;
    /** Cancel button label */
    cancelLabel?: string;
    /** Destructive variant shows red confirm button */
    variant?: "default" | "destructive";
    /** Called when user clicks confirm */
    onConfirm: () => void | Promise<void>;
    /** Disabled state */
    disabled?: boolean;
}

/**
 * Reusable confirmation dialog component.
 * Wraps AlertDialog with a simpler API for common confirm/cancel patterns.
 */
export function ConfirmDialog({
    trigger,
    title,
    description,
    confirmLabel = "確認",
    cancelLabel = "キャンセル",
    variant = "default",
    onConfirm,
    disabled = false,
}: ConfirmDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
            setOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild disabled={disabled}>
                {trigger}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    {description && (
                        <AlertDialogDescription>{description}</AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={
                            variant === "destructive"
                                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                : undefined
                        }
                    >
                        {isLoading ? "処理中..." : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
