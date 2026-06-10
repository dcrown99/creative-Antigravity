import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Article, ArticleFilter } from '@/hooks/useArticles';
import { ArticleCard } from './ArticleCard';
import { ArticleRow } from './ArticleRow';
import { Button, Input } from '@repo/ui';
import { Search, CheckCheck, Filter, ArrowUpDown, ArrowDownUp, Loader2 } from 'lucide-react';
import { ViewMode } from './ViewModeToggle';
import { ArticleListSkeleton } from './Skeleton';

interface ArticleListProps {
    articles: Article[];
    isLoading: boolean;
    viewMode?: ViewMode;
    selectedArticleId?: string;
    onArticleClick?: (article: Article) => void;

    // State props
    filter: ArticleFilter;
    onFilterChange: (filter: ArticleFilter) => void;
    sortOrder: 'newest' | 'oldest';
    onSortOrderChange: (order: 'newest' | 'oldest') => void;
    searchQuery: string;
    onSearch: (query: string) => void;
    onMarkAllAsRead: () => void;
    hasMore?: boolean;
    isLoadingMore?: boolean;
    onLoadMore?: () => void;
}

export const ArticleList: React.FC<ArticleListProps> = ({
    articles,
    isLoading,
    viewMode = 'list',
    selectedArticleId,
    onArticleClick,
    filter,
    onFilterChange,
    sortOrder,
    onSortOrderChange,
    searchQuery,
    onSearch,
    onMarkAllAsRead,
    hasMore = false,
    isLoadingMore = false,
    onLoadMore,
}) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const [searchInput, setSearchInput] = useState(searchQuery);

    // Sync searchInput with searchQuery prop if it changes externally
    useEffect(() => {
        setSearchInput(searchQuery);
    }, [searchQuery]);

    // Calculate columns based on view mode
    const columns = useMemo(() => {
        switch (viewMode) {
            case 'card': return 2;
            case 'column': return 3;
            case 'magazine': return 3;
            default: return 1;
        }
    }, [viewMode]);

    // Chunk articles into rows
    const rows = useMemo(() => {
        if (!articles.length) return [];
        if (viewMode === 'list' || viewMode === 'expanded') return articles.map(a => [a]);

        const result: Article[][] = [];
        let startIndex = 0;

        // Magazine mode: First item is separate (featured) if we have items
        if (viewMode === 'magazine' && articles.length > 0) {
            result.push([articles[0]]);
            startIndex = 1;
        }

        for (let i = startIndex; i < articles.length; i += columns) {
            result.push(articles.slice(i, i + columns));
        }
        return result;
    }, [articles, viewMode, columns]);

    // Estimate row size based on view mode
    const getEstimateSize = (index: number) => {
        switch (viewMode) {
            case 'list': return 40;
            case 'expanded': return 100;
            case 'magazine': return index === 0 ? 350 : 250; // Featured row is taller
            default: return 300; // Card/Column rows
        }
    };

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => getEstimateSize(index),
        overscan: 5,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(searchInput);
    };

    const filters: { value: ArticleFilter; label: string }[] = [
        { value: 'all', label: '全て' },
        { value: 'unread', label: '未読' },
        { value: 'starred', label: 'スター' },
    ];

    if (isLoading && articles.length === 0) {
        return <ArticleListSkeleton viewMode={viewMode} />;
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
            {/* Toolbar */}
            <div className="p-2 border-b dark:border-gray-800 flex items-center gap-2 bg-gray-50/50 dark:bg-gray-900">
                {/* Filter */}
                <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
                    {filters.map(f => (
                        <button
                            key={f.value}
                            onClick={() => onFilterChange(f.value)}
                            className={`
                                px-3 py-1 text-xs rounded-md font-medium transition-all
                                ${filter === f.value
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}
                            `}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1" />

                {/* Sort Toggle */}
                <div className="flex items-center bg-gray-200 dark:bg-gray-800 rounded-lg p-0.5">
                    <button
                        onClick={() => onSortOrderChange('newest')}
                        className={`p-1.5 rounded-md transition-all ${sortOrder === 'newest'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        title="新しい順"
                    >
                        <ArrowDownUp className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onSortOrderChange('oldest')}
                        className={`p-1.5 rounded-md transition-all ${sortOrder === 'oldest'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        title="古い順"
                    >
                        <ArrowUpDown className="w-4 h-4" />
                    </button>
                </div>

                {/* Mark all as read */}
                <Button variant="ghost" size="sm" onClick={onMarkAllAsRead} title="全て既読にする">
                    <CheckCheck className="w-4 h-4 text-gray-500" />
                </Button>
            </div>

            {/* Search Bar */}
            <div className="px-3 py-2 border-b dark:border-gray-800">
                <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                    <Input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="記事を検索..."
                        className="pl-9 h-9 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    />
                </form>
            </div>

            {/* Article List */}
            <div ref={parentRef} className="flex-1 overflow-y-auto">
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const rowItems = rows[virtualRow.index];
                        const isMagazineFeatured = viewMode === 'magazine' && virtualRow.index === 0;

                        return (
                            <div
                                key={virtualRow.key}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                className={`
                                    px-4 py-2
                                    ${(viewMode === 'card' || viewMode === 'column' || viewMode === 'magazine') ? 'grid gap-4' : ''}
                                `}
                            // Apply grid columns dynamically via style or specific class if simplified
                            // Since we need dynamic grid cols, better to use className here
                            >
                                <div className={`
                                    ${viewMode === 'card' ? 'grid grid-cols-2 gap-4' : ''}
                                    ${viewMode === 'column' ? 'grid grid-cols-3 gap-4' : ''}
                                    ${viewMode === 'magazine' ? (isMagazineFeatured ? 'w-full' : 'grid grid-cols-3 gap-4') : ''}
                                    w-full
                                `}>
                                    {rowItems.map((article) => {
                                        const isSelected = article.id === selectedArticleId;

                                        if (viewMode === 'list') {
                                            return (
                                                <ArticleRow
                                                    key={article.id}
                                                    article={article}
                                                    onClick={() => onArticleClick?.(article)}
                                                    isSelected={isSelected}
                                                    compact={true}
                                                />
                                            );
                                        }

                                        if (viewMode === 'expanded') {
                                            return (
                                                <ArticleRow
                                                    key={article.id}
                                                    article={article}
                                                    onClick={() => onArticleClick?.(article)}
                                                    isSelected={isSelected}
                                                    compact={false}
                                                />
                                            );
                                        }

                                        // Card / Column / Magazine
                                        return (
                                            <ArticleCard
                                                key={article.id}
                                                article={article}
                                                onRead={() => onArticleClick?.(article)}
                                                compact={viewMode === 'magazine' && !isMagazineFeatured}
                                                featured={isMagazineFeatured}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Empty State */}
                {!isLoading && articles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <Filter className="w-12 h-12 mb-2 opacity-20" />
                        <p>記事が見つかりません</p>
                    </div>
                )}

                {/* Article Count Footer */}
                {!isLoading && articles.length > 0 && (
                    <div className="py-4 text-center border-t dark:border-gray-800 mt-4">
                        <p className="text-xs text-gray-400 dark:text-gray-600 mb-2">
                            {articles.length} 件の記事
                        </p>
                        {hasMore && (
                            <div ref={loadMoreRef}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onLoadMore}
                                    disabled={isLoadingMore}
                                    className="min-w-[140px]"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            読み込み中...
                                        </>
                                    ) : (
                                        'さらに読み込む'
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
