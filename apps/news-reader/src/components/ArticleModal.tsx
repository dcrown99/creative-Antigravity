"use client";

import React, { useEffect, useCallback } from 'react';
import { Article } from '@/hooks/useArticles';
import { Badge, Button, ScrollArea } from '@repo/ui';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
    Star,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    X,
    Sparkles,
    TrendingUp,
    TrendingDown,
    Minus,
    Bookmark,
    Share2,
    Copy,
    MessageSquare,
} from 'lucide-react';
import { useArticleActions } from '@/hooks/useArticleActions';

interface ArticleModalProps {
    article: Article | null;
    onClose: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    hasPrevious?: boolean;
    hasNext?: boolean;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({
    article,
    onClose,
    onPrevious,
    onNext,
    hasPrevious = false,
    hasNext = false,
}) => {
    const { markAsRead, toggleStar } = useArticleActions();

    // Mark as read when article is opened
    useEffect(() => {
        if (article && !article.isRead) {
            markAsRead(article.id, true);
        }
    }, [article?.id, article?.isRead, markAsRead]);

    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && hasPrevious) {
                onPrevious?.();
            } else if (e.key === 'ArrowRight' && hasNext) {
                onNext?.();
            } else if (e.key.toLowerCase() === 'o' || e.key === 'Enter') {
                handleOpenExternal();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onPrevious, onNext, hasPrevious, hasNext]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (article) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [article]);

    const handleStarClick = useCallback(() => {
        if (article) {
            toggleStar(article.id, !article.isStarred);
        }
    }, [article, toggleStar]);

    const handleCopyLink = useCallback(() => {
        if (article?.link) {
            navigator.clipboard.writeText(article.link);
        }
    }, [article?.link]);

    const handleOpenExternal = useCallback(() => {
        if (article?.link) {
            window.open(article.link, '_blank', 'noopener,noreferrer');
        }
    }, [article?.link]);

    if (!article) return null;

    const getSentimentIcon = () => {
        if (!article.ai?.sentiment) return null;
        switch (article.ai.sentiment) {
            case 'Positive': return <TrendingUp className="w-4 h-4 text-green-500" />;
            case 'Negative': return <TrendingDown className="w-4 h-4 text-red-500" />;
            default: return <Minus className="w-4 h-4 text-gray-500" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Navigation Arrows */}
            {hasPrevious && (
                <button
                    onClick={onPrevious}
                    className="absolute left-4 z-50 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                    title="前の記事"
                >
                    <ChevronLeft className="w-8 h-8" />
                </button>
            )}
            {hasNext && (
                <button
                    onClick={onNext}
                    className="absolute right-4 z-50 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                    title="次の記事"
                >
                    <ChevronRight className="w-8 h-8" />
                </button>
            )}

            {/* Modal Content */}
            <div className="relative z-40 w-full max-w-2xl max-h-[90vh] mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col">
                {/* Action Bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-1">
                        {/* Star */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleStarClick}
                            className={`h-8 w-8 ${article.isStarred ? 'text-yellow-500' : 'text-gray-500 hover:text-yellow-400'}`}
                            title={article.isStarred ? 'スターを外す' : 'スターを付ける'}
                        >
                            <Star className="w-5 h-5" fill={article.isStarred ? 'currentColor' : 'none'} />
                        </Button>

                        {/* Bookmark */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-blue-500"
                            title="後で読む"
                        >
                            <Bookmark className="w-5 h-5" />
                        </Button>

                        {/* Copy Link */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopyLink}
                            className="h-8 w-8 text-gray-500 hover:text-green-500"
                            title="リンクをコピー"
                        >
                            <Copy className="w-5 h-5" />
                        </Button>

                        {/* Share */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-purple-500"
                            title="共有"
                        >
                            <Share2 className="w-5 h-5" />
                        </Button>

                        {/* External Link */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleOpenExternal}
                            className="h-8 w-8 text-gray-500 hover:text-blue-500"
                            title="元記事を開く"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Memo Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-gray-600 dark:text-gray-300"
                    >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        メモを追加
                    </Button>

                    {/* Close Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        title="閉じる (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Article Content */}
                <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="p-6">
                        {/* Title */}
                        <h1 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 mb-3">
                            {article.title}
                        </h1>

                        {/* Meta */}
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                            <span>{article.author || 'Unknown'}</span>
                            <span>·</span>
                            <span>
                                {article.isoDate
                                    ? formatDistanceToNow(new Date(article.isoDate), { addSuffix: true, locale: ja })
                                    : 'Recently'}
                            </span>
                        </div>

                        {/* Thumbnail Image */}
                        {article.thumbnail && (
                            <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6 overflow-hidden">
                                <img
                                    src={article.thumbnail}
                                    alt={article.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        )}

                        {/* AI Summary */}
                        {article.ai && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4 text-blue-500" />
                                    <span className="font-medium text-blue-700 dark:text-blue-300">AI Summary</span>
                                    {getSentimentIcon()}
                                    {article.ai.priority && (
                                        <Badge
                                            variant="outline"
                                            className={`text-xs ${article.ai.priority === 'High' ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400' :
                                                article.ai.priority === 'Medium' ? 'border-yellow-300 text-yellow-600 dark:border-yellow-700 dark:text-yellow-400' :
                                                    'border-green-300 text-green-600 dark:border-green-700 dark:text-green-400'
                                                }`}
                                        >
                                            {article.ai.priority}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                    {article.ai.summary}
                                </p>
                                {article.ai.topics && article.ai.topics.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {article.ai.topics.map((topic) => (
                                            <Badge key={topic} variant="secondary" className="text-xs">
                                                {topic}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Article Content */}
                        <div className="prose dark:prose-invert max-w-none">
                            <div
                                className="text-gray-700 dark:text-gray-300 leading-relaxed"
                                dangerouslySetInnerHTML={{
                                    __html: article.content || article.contentSnippet || 'No content available.'
                                }}
                            />
                        </div>

                        {/* Read More Link */}
                        <div className="mt-6 pt-4 border-t dark:border-gray-700">
                            <a
                                href={article.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                                <ExternalLink className="w-4 h-4" />
                                元記事を読む
                            </a>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
};
