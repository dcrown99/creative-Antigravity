'use client';

import React from 'react';
import { Button } from '@repo/ui';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const themes = [
        { value: 'light' as const, icon: Sun, label: 'ライト' },
        { value: 'dark' as const, icon: Moon, label: 'ダーク' },
        { value: 'system' as const, icon: Monitor, label: 'システム' },
    ];

    return (
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
            {themes.map(({ value, icon: Icon, label }) => (
                <Button
                    key={value}
                    variant={theme === value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTheme(value)}
                    className="h-7 w-7 p-0"
                    title={label}
                >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="sr-only">{label}</span>
                </Button>
            ))}
        </div>
    );
};
