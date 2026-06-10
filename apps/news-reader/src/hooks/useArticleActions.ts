import { useCallback } from 'react';
import { mutate } from 'swr';

interface ArticleActionOptions {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

/**
 * Hook for article actions (mark read, star, etc.)
 */
export function useArticleActions() {
    /**
     * Mark a single article as read/unread
     */
    const markAsRead = useCallback(async (
        articleId: string,
        isRead: boolean = true,
        options?: ArticleActionOptions
    ) => {
        try {
            const res = await fetch('/api/articles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: articleId, isRead }),
            });

            if (!res.ok) {
                throw new Error('Failed to update article');
            }

            // Revalidate articles cache
            mutate((key: string) => key.startsWith('/api/articles'));
            mutate('/api/feeds'); // Update unread counts

            options?.onSuccess?.();
        } catch (error) {
            console.error('Mark as read error:', error);
            options?.onError?.(error as Error);
        }
    }, []);

    /**
     * Toggle star on a single article
     */
    const toggleStar = useCallback(async (
        articleId: string,
        isStarred: boolean,
        options?: ArticleActionOptions
    ) => {
        try {
            const res = await fetch('/api/articles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: articleId, isStarred }),
            });

            if (!res.ok) {
                throw new Error('Failed to update article');
            }

            mutate((key: string) => key.startsWith('/api/articles'));
            options?.onSuccess?.();
        } catch (error) {
            console.error('Toggle star error:', error);
            options?.onError?.(error as Error);
        }
    }, []);

    /**
     * Mark all articles in a feed as read
     */
    const markAllAsRead = useCallback(async (
        feedId: string,
        options?: ArticleActionOptions
    ) => {
        try {
            const res = await fetch('/api/articles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAllAsRead: true, feedId }),
            });

            if (!res.ok) {
                throw new Error('Failed to mark all as read');
            }

            mutate((key: string) => key.startsWith('/api/articles'));
            mutate('/api/feeds');

            options?.onSuccess?.();
        } catch (error) {
            console.error('Mark all as read error:', error);
            options?.onError?.(error as Error);
        }
    }, []);

    /**
     * Bulk update multiple articles
     */
    const bulkUpdate = useCallback(async (
        articleIds: string[],
        updates: { isRead?: boolean; isStarred?: boolean },
        options?: ArticleActionOptions
    ) => {
        try {
            const res = await fetch('/api/articles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: articleIds, ...updates }),
            });

            if (!res.ok) {
                throw new Error('Failed to bulk update articles');
            }

            mutate((key: string) => key.startsWith('/api/articles'));
            mutate('/api/feeds');

            options?.onSuccess?.();
        } catch (error) {
            console.error('Bulk update error:', error);
            options?.onError?.(error as Error);
        }
    }, []);

    return {
        markAsRead,
        toggleStar,
        markAllAsRead,
        bulkUpdate,
    };
}
