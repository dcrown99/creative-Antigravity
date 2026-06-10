'use client';

import React, { useState } from 'react';
import { Button, Input, ScrollArea, Separator, Badge } from '@repo/ui';
import { Plus, Trash2, Rss, Loader2, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
import { useFeeds, useFolders, Feed, Folder } from '../hooks/useFeeds';
import { FeedSidebarSkeleton } from './Skeleton';
import { toast } from 'sonner';

interface FeedSidebarProps {
    currentFeedId?: string;
    onSelectFeed: (feedId: string | null, feedUrl?: string) => void;
}

export const FeedSidebar: React.FC<FeedSidebarProps> = ({ currentFeedId, onSelectFeed }) => {
    const { feeds, addFeed, removeFeed, isLoading: feedsLoading } = useFeeds();
    const { folders, addFolder } = useFolders();

    const [newUrl, setNewUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showAddFolder, setShowAddFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const handleAddFeed = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUrl) return;

        setIsAdding(true);
        try {
            const feed = await addFeed(newUrl);
            setNewUrl('');
            // Auto-select the new feed
            if (feed) {
                onSelectFeed(feed.id, feed.url);
                toast.success(`フィードを追加しました: ${feed.title || feed.url}`);
            }
        } catch (error) {
            console.warn('Failed to add feed:', error);
            toast.error('フィードの追加に失敗しました', {
                description: error instanceof Error ? error.message : 'URLを確認してください',
            });
        } finally {
            setIsAdding(false);
        }
    };

    const handleAddFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        try {
            await addFolder(newFolderName.trim());
            setNewFolderName('');
            setShowAddFolder(false);
        } catch (error) {
            console.warn('Failed to add folder:', error);
            toast.error('フォルダの追加に失敗しました', {
                description: error instanceof Error ? error.message : '不明なエラーが発生しました',
            });
        }
    };

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    // Group feeds by folder
    const uncategorizedFeeds = feeds.filter(f => !f.folderId);
    const feedsByFolder = new Map<string, Feed[]>();
    feeds.forEach(feed => {
        if (feed.folderId) {
            const existing = feedsByFolder.get(feed.folderId) || [];
            feedsByFolder.set(feed.folderId, [...existing, feed]);
        }
    });

    // Calculate total unread
    const totalUnread = feeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);

    if (feedsLoading && feeds.length === 0) {
        return <FeedSidebarSkeleton />;
    }

    return (
        <aside className="w-72 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900 h-screen flex flex-col">
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700">
                <h2 className="font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Rss className="w-4 h-4" /> Feeds
                    {totalUnread > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                            {totalUnread}
                        </Badge>
                    )}
                </h2>

                {/* Add Feed Form */}
                <form onSubmit={handleAddFeed} className="flex gap-2 mb-2">
                    <Input
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="URL を追加..."
                        className="h-8 text-sm"
                    />
                    <Button type="submit" size="icon" className="h-8 w-8" disabled={isAdding}>
                        {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                </form>

                {/* Add Folder */}
                {showAddFolder ? (
                    <form onSubmit={handleAddFolder} className="flex gap-2">
                        <Input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="フォルダ名..."
                            className="h-8 text-sm"
                            autoFocus
                        />
                        <Button type="submit" size="icon" className="h-8 w-8">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </form>
                ) : (
                    <button
                        onClick={() => setShowAddFolder(true)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                        <FolderPlus className="w-3 h-3" /> フォルダを追加
                    </button>
                )}
            </div>

            {/* Feed List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {/* All feeds option */}
                    <div
                        className={`
                            flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm
                            ${!currentFeedId ? 'bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 font-medium' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}
                        `}
                        onClick={() => onSelectFeed(null)}
                    >
                        <span>全てのフィード</span>
                        {totalUnread > 0 && (
                            <Badge variant="outline" className="text-xs">
                                {totalUnread}
                            </Badge>
                        )}
                    </div>

                    <Separator className="my-2" />

                    {/* Folders */}
                    {folders.map(folder => {
                        const folderFeeds = feedsByFolder.get(folder.id) || [];
                        const isExpanded = expandedFolders.has(folder.id);
                        const folderUnread = folderFeeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);

                        return (
                            <div key={folder.id}>
                                <div
                                    className="flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                                    onClick={() => toggleFolder(folder.id)}
                                >
                                    <span className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400">
                                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        {folder.name}
                                    </span>
                                    {folderUnread > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                            {folderUnread}
                                        </Badge>
                                    )}
                                </div>

                                {isExpanded && folderFeeds.map(feed => (
                                    <FeedItem
                                        key={feed.id}
                                        feed={feed}
                                        isSelected={currentFeedId === feed.id}
                                        onSelect={() => onSelectFeed(feed.id, feed.url)}
                                        onRemove={() => removeFeed(feed.id)}
                                        indent
                                    />
                                ))}
                            </div>
                        );
                    })}

                    {/* Uncategorized feeds */}
                    {uncategorizedFeeds.length > 0 && (
                        <>
                            {folders.length > 0 && <Separator className="my-2" />}
                            {uncategorizedFeeds.map(feed => (
                                <FeedItem
                                    key={feed.id}
                                    feed={feed}
                                    isSelected={currentFeedId === feed.id}
                                    onSelect={() => onSelectFeed(feed.id, feed.url)}
                                    onRemove={() => removeFeed(feed.id)}
                                />
                            ))}
                        </>
                    )}

                    {feedsLoading && (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                    )}
                </div>
            </ScrollArea>
        </aside>
    );
};

// Feed Item Component
interface FeedItemProps {
    feed: Feed;
    isSelected: boolean;
    onSelect: () => void;
    onRemove: () => void;
    indent?: boolean;
}

const FeedItem: React.FC<FeedItemProps> = ({ feed, isSelected, onSelect, onRemove, indent }) => {
    // Extract domain from URL for favicon
    const getFaviconUrl = (url: string) => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
            return null;
        }
    };

    const faviconUrl = feed.url ? getFaviconUrl(feed.url) : null;

    return (
        <div
            className={`
                group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm
                ${indent ? 'ml-4' : ''}
                ${isSelected ? 'bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}
            `}
            onClick={onSelect}
        >
            {/* Favicon */}
            {faviconUrl && (
                <img
                    src={faviconUrl}
                    alt=""
                    className="w-4 h-4 flex-shrink-0"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            )}

            <span className="truncate flex-1 min-w-0">{feed.title}</span>

            <div className="flex items-center gap-1 shrink-0">
                {feed.unreadCount > 0 && (
                    <Badge variant={isSelected ? 'default' : 'secondary'} className="text-xs">
                        {feed.unreadCount}
                    </Badge>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
