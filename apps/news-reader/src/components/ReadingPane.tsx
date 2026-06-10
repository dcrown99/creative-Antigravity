"use client";

import React from 'react';
import { Article } from '@/hooks/useArticles';
import { Badge, Button, ScrollArea, Separator } from '@repo/ui';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
    Star,
    Check,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    X,
    Sparkles,
    TrendingUp,
    TrendingDown,
    Minus,
} from 'lucide-react';
import { useArticleActions } from '@/hooks/useArticleActions';

interface ReadingPaneProps {
    article: Article | null;
    onClose: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    hasPrevious?: boolean;
    hasNext?: boolean;
}

export const ReadingPane: React.FC<ReadingPaneProps> = ({
    article,
    onClose,
    onPrevious,
    onNext,
    hasPrevious = false,
    hasNext = false,
}) => {
    const { markAsRead, toggleStar } = useArticleActions();

    // Mark as read when article is displayed
    React.useEffect(() => {
        if (article && !article.isRead) {
            markAsRead(article.id, true);
        }
    }, [article?.id]);

    if (!article) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">記事を選択して読む</p>
                    <p className="text-sm mt-2">JとKキーで記事間を移動できます</p>
                </div>
            </div>
        );
    }

    const priorityConfig = {
        High: { color: 'bg-red-500', label: '高優先度' },
        Medium: { color: 'bg-yellow-500', label: '中優先度' },
        Low: { color: 'bg-green-500', label: '低優先度' },
    };

    const sentimentIcon = {
        Positive: <TrendingUp className="w-4 h-4 text-green-500" />,
        Negative: <TrendingDown className="w-4 h-4 text-red-500" />,
        Neutral: <Minus className="w-4 h-4 text-gray-500" />,
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 border-b dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                <div className="flex items-center justify-between gap-2">
                    {/* Navigation */}
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onPrevious}
                            disabled={!hasPrevious}
                            title="前の記事 (K)"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onNext}
                            disabled={!hasNext}
                            title="次の記事 (J)"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleStar(article.id, !article.isStarred)}
                            className={article.isStarred ? 'text-yellow-500' : ''}
                            title="スター (S)"
                        >
                            <Star className="w-4 h-4" fill={article.isStarred ? 'currentColor' : 'none'} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markAsRead(article.id, !article.isRead)}
                            className={article.isRead ? 'text-green-500' : ''}
                            title="既読/未読 (M)"
                        >
                            <Check className="w-4 h-4" />
                        </Button>
                        <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100"
                            title="元記事を開く (O)"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        <Button variant="ghost" size="icon" onClick={onClose} title="閉じる">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-6 max-w-3xl mx-auto">
                    {/* AI Analysis Panel */}
                    {article.ai && (
                        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border border-blue-100 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-5 h-5 text-blue-500" />
                                <span className="font-semibold text-blue-700 dark:text-blue-300">AI Analysis</span>
                            </div>

                            {/* Priority & Sentiment Row */}
                            <div className="flex items-center gap-3 mb-3">
                                <Badge className={`${priorityConfig[article.ai.priority].color} text-white`}>
                                    {priorityConfig[article.ai.priority].label}
                                </Badge>
                                {article.ai.sentiment && (
                                    <div className="flex items-center gap-1 text-sm">
                                        {sentimentIcon[article.ai.sentiment]}
                                        <span className="text-gray-600 dark:text-gray-400">{article.ai.sentiment}</span>
                                    </div>
                                )}
                            </div>

                            {/* Summary */}
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                                {article.ai.summary}
                            </p>

                            {/* Topics */}
                            <div className="flex flex-wrap gap-1">
                                {article.ai.topics.map((topic) => (
                                    <Badge key={topic} variant="secondary" className="text-xs">
                                        {topic}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Article Header */}
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 leading-tight">
                        {article.title}
                    </h1>

                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-6">
                        {article.isoDate && (
                            <span>
                                {formatDistanceToNow(new Date(article.isoDate), {
                                    addSuffix: true,
                                    locale: ja,
                                })}
                            </span>
                        )}
                        {article.author && (
                            <>
                                <span>·</span>
                                <span>{article.author}</span>
                            </>
                        )}
                    </div>

                    <Separator className="mb-6" />

                    {/* Article Content */}
                    <div
                        className="prose prose-gray dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                            __html: article.content || article.contentSnippet || '',
                        }}
                    />
                </div>
            </ScrollArea>
        </div>
    );
};
