"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { ResizableLayout } from '@/components/Layout/ResizableLayout';
import { ArticleList } from '@/components/ArticleList';
import { FeedSidebar } from '@/components/FeedSidebar';
import { DigestCard } from '@/components/DigestCard';
import { ReadingPane } from '@/components/ReadingPane';
import { ArticleModal } from '@/components/ArticleModal';
import { KeyboardHelp } from '@/components/KeyboardHelp';
import { ViewModeToggle, ViewMode } from '@/components/ViewModeToggle';
import { ImportExport } from '@/components/Settings/ImportExport';
import { TagManager } from '@/components/TagManager';
import { RuleManager } from '@/components/Settings/RuleManager';
import { FeedSettings } from '@/components/Settings/FeedSettings';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useArticles, Article, ArticleFilter } from '@/hooks/useArticles';
import { useArticleActions } from '@/hooks/useArticleActions';
import { Keyboard, Settings, PanelRightClose, PanelRight } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, ModeToggle, Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui';

export default function Home() {
    const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showReadingPane, setShowReadingPane] = useState(false); // Default to modal mode
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Lifted state from ArticleList
    const [filter, setFilter] = useState<ArticleFilter>('all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch articles with filter and search
    const { articles, isLoading, mutate, hasMore, loadMore, isLoadingMore } = useArticles({
        feedId: selectedFeedId || undefined,
        filter,
        search: searchQuery || undefined,
    });

    const { markAllAsRead } = useArticleActions();

    useServiceWorker();

    // Sort articles locally to ensure navigation order matches view order
    const sortedArticles = useMemo(() => {
        if (!articles) return [];
        return [...articles].sort((a, b) => {
            const dateA = a.isoDate ? new Date(a.isoDate).getTime() : 0;
            const dateB = b.isoDate ? new Date(b.isoDate).getTime() : 0;
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
    }, [articles, sortOrder]);

    // Find current article index for navigation based on SORTED articles
    const currentIndex = selectedArticle
        ? sortedArticles.findIndex((a) => a.id === selectedArticle.id)
        : -1;

    const handlePreviousArticle = useCallback(() => {
        if (currentIndex > 0) {
            setSelectedArticle(sortedArticles[currentIndex - 1]);
        }
    }, [sortedArticles, currentIndex]);

    const handleNextArticle = useCallback(() => {
        if (currentIndex < sortedArticles.length - 1) {
            setSelectedArticle(sortedArticles[currentIndex + 1]);
        }
    }, [sortedArticles, currentIndex]);

    // Keyboard shortcuts
    const { shortcuts } = useKeyboardShortcuts({
        feedId: selectedFeedId || undefined,
        currentArticleId: selectedArticle?.id,
        onShowHelp: () => setShowKeyboardHelp(true),
        onNavigatePrev: handlePreviousArticle,
        onNavigateNext: handleNextArticle,
    });

    const handleSelectFeed = (feedId: string | null) => {
        setSelectedFeedId(feedId);
        setSelectedArticle(null);
    };

    const handleArticleClick = (article: Article) => {
        setSelectedArticle(article);
        // Note: When showReadingPane is false, ArticleModal will be shown instead
    };

    const handleMarkAllAsRead = () => {
        if (selectedFeedId) {
            markAllAsRead(selectedFeedId, {
                onSuccess: () => mutate(),
            });
        }
    };

    // Header component for article list
    const ArticleListHeader = () => (
        <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-700 p-3 shadow-sm z-10 flex items-center justify-between">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                News Reader AI
            </h1>

            <div className="flex items-center gap-1">
                {/* View Mode Toggle */}
                <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />

                <div className="w-px h-5 bg-gray-200 mx-1" />

                {/* Toggle Reading Pane */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowReadingPane(!showReadingPane)}
                    title={showReadingPane ? 'モーダル表示に切替' : 'サイドパネル表示に切替'}
                    className="h-8 w-8"
                >
                    {showReadingPane ? (
                        <PanelRightClose className="w-4 h-4" />
                    ) : (
                        <PanelRight className="w-4 h-4" />
                    )}
                </Button>

                <div className="w-px h-5 bg-gray-200 mx-1" />

                {/* Keyboard Help */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowKeyboardHelp(true)}
                    title="キーボードショートカット (?)"
                    className="h-8 w-8"
                >
                    <Keyboard className="w-4 h-4" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    title="設定"
                    className="h-8 w-8"
                >
                    <Settings className="w-4 h-4" />
                </Button>

                <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />

                {/* Theme Toggle */}
                <ModeToggle />
            </div>
        </header>
    );

    return (
        <>
            <ResizableLayout
                showReadingPane={showReadingPane}
                sidebar={
                    <FeedSidebar
                        currentFeedId={selectedFeedId || undefined}
                        onSelectFeed={handleSelectFeed}
                    />
                }
                articleList={
                    <>
                        <ArticleListHeader />
                        <div className="flex-1 overflow-hidden h-full">
                            {/* Digest Card - shown when viewing all feeds and no filter */}
                            {!selectedFeedId && filter === 'all' && !searchQuery && (
                                <div className="p-3 pb-0">
                                    <DigestCard />
                                </div>
                            )}
                            <ArticleList
                                key={viewMode}
                                articles={sortedArticles}
                                isLoading={isLoading}
                                viewMode={viewMode}
                                selectedArticleId={selectedArticle?.id}
                                onArticleClick={handleArticleClick}
                                filter={filter}
                                onFilterChange={setFilter}
                                sortOrder={sortOrder}
                                onSortOrderChange={setSortOrder}
                                searchQuery={searchQuery}
                                onSearch={setSearchQuery}
                                onMarkAllAsRead={handleMarkAllAsRead}
                                hasMore={hasMore}
                                isLoadingMore={isLoadingMore}
                                onLoadMore={loadMore}
                            />
                        </div>
                    </>
                }
                readingPane={
                    showReadingPane ? (
                        <ReadingPane
                            article={selectedArticle}
                            onClose={() => setSelectedArticle(null)}
                            onPrevious={handlePreviousArticle}
                            onNext={handleNextArticle}
                            hasPrevious={currentIndex > 0}
                            hasNext={currentIndex < sortedArticles.length - 1}
                        />
                    ) : null
                }
            />

            {/* Article Modal - shows when Reading Pane is hidden */}
            {!showReadingPane && selectedArticle && (
                <ArticleModal
                    article={selectedArticle}
                    onClose={() => setSelectedArticle(null)}
                    onPrevious={handlePreviousArticle}
                    onNext={handleNextArticle}
                    hasPrevious={currentIndex > 0}
                    hasNext={currentIndex < sortedArticles.length - 1}
                />
            )}

            {/* Keyboard Help Dialog */}
            <KeyboardHelp
                open={showKeyboardHelp}
                onOpenChange={setShowKeyboardHelp}
                shortcuts={shortcuts}
            />

            {/* Settings Dialog */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>設定</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="opml" className="mt-2">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="opml">OPML</TabsTrigger>
                            <TabsTrigger value="tags">タグ</TabsTrigger>
                            <TabsTrigger value="rules">ルール</TabsTrigger>
                            <TabsTrigger value="feeds">更新</TabsTrigger>
                        </TabsList>
                        <TabsContent value="opml" className="mt-4">
                            <ImportExport />
                        </TabsContent>
                        <TabsContent value="tags" className="mt-4">
                            <TagManager />
                        </TabsContent>
                        <TabsContent value="rules" className="mt-4">
                            <RuleManager />
                        </TabsContent>
                        <TabsContent value="feeds" className="mt-4">
                            <FeedSettings />
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </>
    );
}
