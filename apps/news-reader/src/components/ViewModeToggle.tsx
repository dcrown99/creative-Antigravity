'use client';

import React from 'react';
import { Button } from '@repo/ui';
import { List, AlignJustify, Columns, LayoutGrid, Newspaper } from 'lucide-react';

export type ViewMode = 'list' | 'expanded' | 'column' | 'card' | 'magazine';

interface ViewModeToggleProps {
    mode: ViewMode;
    onModeChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ mode, onModeChange }: ViewModeToggleProps) {
    const modes: Array<{ value: ViewMode; icon: React.ReactNode; label: string }> = [
        { value: 'list', icon: <List className="w-4 h-4" />, label: 'リスト' },
        { value: 'expanded', icon: <AlignJustify className="w-4 h-4" />, label: '拡張' },
        { value: 'column', icon: <Columns className="w-4 h-4" />, label: 'カラム' },
        { value: 'card', icon: <LayoutGrid className="w-4 h-4" />, label: 'カード' },
        { value: 'magazine', icon: <Newspaper className="w-4 h-4" />, label: 'マガジン' },
    ];

    return (
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
            {modes.map(({ value, icon, label }) => (
                <Button
                    key={value}
                    variant={mode === value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onModeChange(value)}
                    className="h-7 w-7 p-0 flex items-center justify-center"
                    title={label}
                >
                    {icon}
                    <span className="sr-only">{label}</span>
                </Button>
            ))}
        </div>
    );
}
