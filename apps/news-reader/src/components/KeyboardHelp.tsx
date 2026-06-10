'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@repo/ui';
import { Keyboard } from 'lucide-react';

interface KeyboardHelpProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shortcuts: Array<{ key: string; description: string }>;
}

export function KeyboardHelp({ open, onOpenChange, shortcuts }: KeyboardHelpProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="w-5 h-5" />
                        キーボードショートカット
                    </DialogTitle>
                    <DialogDescription>
                        効率的に操作するためのショートカットキー
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2 py-4">
                    {shortcuts.map(({ key, description }) => (
                        <div
                            key={key}
                            className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                            <span className="text-sm text-gray-600 dark:text-gray-300">{description}</span>
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono font-medium">
                                {key}
                            </kbd>
                        </div>
                    ))}
                </div>

                <div className="text-xs text-gray-400 text-center">
                    Press <kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">?</kbd> to show this dialog
                </div>
            </DialogContent>
        </Dialog>
    );
}
