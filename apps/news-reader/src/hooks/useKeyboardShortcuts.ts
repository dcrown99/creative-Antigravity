import { useEffect, useCallback, useRef } from 'react';
import { useArticleActions } from './useArticleActions';

interface KeyboardShortcutOptions {
    onNavigateNext?: () => void;
    onNavigatePrev?: () => void;
    onOpenArticle?: () => void;
    onShowHelp?: () => void;
    currentArticleId?: string;
    feedId?: string;
}

/**
 * Keyboard shortcuts for power users
 * 
 * J - Next article
 * K - Previous article
 * M - Toggle read/unread
 * S - Toggle star
 * O / Enter - Open article in new tab
 * Shift+A - Mark all as read
 * ? - Show help
 * Escape - Close dialog/deselect
 */
export function useKeyboardShortcuts(options: KeyboardShortcutOptions) {
    const {
        onNavigateNext,
        onNavigatePrev,
        onOpenArticle,
        onShowHelp,
        currentArticleId,
        feedId,
    } = options;

    const { markAsRead, toggleStar, markAllAsRead } = useArticleActions();
    const isReadRef = useRef(false);
    const isStarredRef = useRef(false);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignore if typing in input/textarea
        if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLSelectElement
        ) {
            return;
        }

        // Ignore if modifier keys (except Shift for some shortcuts)
        if (e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'j':
                // Next article
                e.preventDefault();
                onNavigateNext?.();
                break;

            case 'k':
                // Previous article
                e.preventDefault();
                onNavigatePrev?.();
                break;

            case 'm':
                // Toggle read/unread
                if (currentArticleId) {
                    e.preventDefault();
                    isReadRef.current = !isReadRef.current;
                    markAsRead(currentArticleId, isReadRef.current);
                }
                break;

            case 's':
                // Toggle star
                if (currentArticleId) {
                    e.preventDefault();
                    isStarredRef.current = !isStarredRef.current;
                    toggleStar(currentArticleId, isStarredRef.current);
                }
                break;

            case 'o':
            case 'enter':
                // Open article
                e.preventDefault();
                onOpenArticle?.();
                break;

            case 'a':
                // Shift+A: Mark all as read
                if (e.shiftKey && feedId) {
                    e.preventDefault();
                    markAllAsRead(feedId);
                }
                break;

            case '?':
                // Show help
                e.preventDefault();
                onShowHelp?.();
                break;

            case 'escape':
                // Close/deselect (handled by parent)
                break;
        }
    }, [
        currentArticleId,
        feedId,
        markAsRead,
        toggleStar,
        markAllAsRead,
        onNavigateNext,
        onNavigatePrev,
        onOpenArticle,
        onShowHelp,
    ]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return {
        shortcuts: [
            { key: 'J / →', description: '次の記事' },
            { key: 'K / ←', description: '前の記事' },
            { key: 'M', description: '既読/未読切替' },
            { key: 'S', description: 'スター切替' },
            { key: 'O / Enter', description: '記事を開く' },
            { key: 'Shift+A', description: '全て既読' },
            { key: '?', description: 'ヘルプ表示' },
            { key: 'Esc', description: '閉じる/選択解除' },
        ],
    };
}
