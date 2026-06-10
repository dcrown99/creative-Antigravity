import useSWR from 'swr';
import { useState, useCallback, useEffect } from 'react';

// Re-export Article type from canonical source
export type { Article } from '@/types/article';
import type { Article } from '@/types/article';

interface ArticlesResponse {
    articles: Article[];
    total: number;
    hasMore: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export type ArticleFilter = 'all' | 'unread' | 'starred';

interface UseArticlesOptions {
    feedId?: string;
    filter?: ArticleFilter;
    search?: string;
    limit?: number;
}

export function useArticles(options: UseArticlesOptions = {}) {
    const { feedId, filter = 'all', search, limit = 20 } = options;
    const [offset, setOffset] = useState(0);
    const [allArticles, setAllArticles] = useState<Article[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Build query string
    const params = new URLSearchParams();
    if (feedId) params.set('feedId', feedId);
    if (filter !== 'all') params.set('filter', filter);
    if (search) params.set('search', search);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());

    const queryString = params.toString();
    const url = `/api/articles${queryString ? `?${queryString}` : ''}`;

    const { data, error, isLoading, mutate } = useSWR<ArticlesResponse>(
        url,
        fetcher,
        {
            refreshInterval: 0, // 爆速起動: 手動リフレッシュのみ
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 60000, // 1分間の重複排除
        }
    );

    // Reset articles when filter/feed/search changes
    useEffect(() => {
        setOffset(0);
        setAllArticles([]);
    }, [feedId, filter, search]);

    // Accumulate articles when data changes
    useEffect(() => {
        if (data?.articles) {
            if (offset === 0) {
                setAllArticles(data.articles);
            } else {
                setAllArticles(prev => {
                    const existingIds = new Set(prev.map(a => a.id));
                    const newArticles = data.articles.filter(a => !existingIds.has(a.id));
                    return [...prev, ...newArticles];
                });
            }
            setIsLoadingMore(false);
        }
    }, [data, offset]);

    // Load more function for infinite scroll
    const loadMore = useCallback(() => {
        if (data?.hasMore && !isLoading && !isLoadingMore) {
            setIsLoadingMore(true);
            setOffset(prev => prev + limit);
        }
    }, [data?.hasMore, isLoading, isLoadingMore, limit]);

    // Refresh from beginning
    const refresh = useCallback(() => {
        setOffset(0);
        setAllArticles([]);
        mutate();
    }, [mutate]);

    return {
        articles: allArticles.length > 0 ? allArticles : (data?.articles || []),
        total: data?.total || 0,
        hasMore: data?.hasMore || false,
        isLoading: isLoading && offset === 0,
        isLoadingMore,
        isError: error,
        mutate: refresh,
        loadMore,
    };
}

