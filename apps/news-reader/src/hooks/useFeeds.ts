import useSWR from 'swr';
import { useCallback } from 'react';

// Types
export interface Feed {
    id: string;
    url: string;
    title: string;
    description?: string;
    favicon?: string;
    folderId?: string;
    lastFetchedAt?: Date;
    createdAt?: Date;
    unreadCount: number;
}

export interface Folder {
    id: string;
    name: string;
    order: number;
    feedCount: number;
    isExpanded?: boolean;
}

interface FeedsResponse {
    feeds: Feed[];
}

interface FoldersResponse {
    folders: Folder[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

/**
 * Hook for managing feeds with API
 */
export function useFeeds() {
    const { data, error, isLoading, mutate } = useSWR<FeedsResponse>(
        '/api/feeds',
        fetcher,
        {
            refreshInterval: 0, // 爆速起動: 手動リフレッシュのみ
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    const addFeed = useCallback(async (url: string, folderId?: string) => {
        try {
            const res = await fetch('/api/feeds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, folderId }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to add feed (${res.status})`);
            }

            const result = await res.json();

            // Optimistically update cache
            mutate(
                prev => prev ? { feeds: [...prev.feeds, result.feed] } : prev,
                { revalidate: true }
            );

            return result.feed;
        } catch (error) {
            console.error('Add feed error:', error);
            throw error;
        }
    }, [mutate]);

    const removeFeed = useCallback(async (id: string) => {
        try {
            // Optimistic update
            mutate(
                prev => prev ? { feeds: prev.feeds.filter(f => f.id !== id) } : prev,
                { revalidate: false }
            );

            const res = await fetch(`/api/feeds?id=${id}`, { method: 'DELETE' });

            if (!res.ok) {
                // Revert on error
                mutate();
                throw new Error('Failed to delete feed');
            }
        } catch (error) {
            console.error('Remove feed error:', error);
            throw error;
        }
    }, [mutate]);

    return {
        feeds: data?.feeds || [],
        isLoading,
        isError: error,
        addFeed,
        removeFeed,
        refresh: () => mutate(),
    };
}

/**
 * Hook for managing folders with API
 */
export function useFolders() {
    const { data, error, isLoading, mutate } = useSWR<FoldersResponse>(
        '/api/folders',
        fetcher,
        {
            refreshInterval: 0, // Don't auto-refresh folders
            revalidateOnFocus: false,
        }
    );

    const addFolder = useCallback(async (name: string) => {
        try {
            const res = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            if (!res.ok) {
                throw new Error('Failed to create folder');
            }

            const result = await res.json();
            mutate();
            return result.folder;
        } catch (error) {
            console.error('Add folder error:', error);
            throw error;
        }
    }, [mutate]);

    const removeFolder = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/folders?id=${id}`, { method: 'DELETE' });

            if (!res.ok) {
                throw new Error('Failed to delete folder');
            }

            mutate();
        } catch (error) {
            console.error('Remove folder error:', error);
            throw error;
        }
    }, [mutate]);

    const updateFolder = useCallback(async (id: string, updates: { name?: string; order?: number }) => {
        try {
            const res = await fetch('/api/folders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates }),
            });

            if (!res.ok) {
                throw new Error('Failed to update folder');
            }

            mutate();
        } catch (error) {
            console.error('Update folder error:', error);
            throw error;
        }
    }, [mutate]);

    return {
        folders: data?.folders || [],
        isLoading,
        isError: error,
        addFolder,
        removeFolder,
        updateFolder,
        refresh: () => mutate(),
    };
}
