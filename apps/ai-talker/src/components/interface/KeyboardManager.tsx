"use client";

import { useEffect } from "react";
import { create } from 'zustand';

// UIの表示状態を管理する専用ストア (Global UI Store)
interface UIState {
    isVisible: boolean;
    toggleVisibility: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    isVisible: true,
    toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
}));

export function KeyboardManager() {
    const toggle = useUIStore(s => s.toggleVisibility);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 'H' key to toggle HUD
            if (e.key.toLowerCase() === 'h' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                toggle();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggle]);

    return null; // Logic only component
}
