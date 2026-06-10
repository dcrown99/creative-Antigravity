'use client';

import React from 'react';
import { Article } from '@/hooks/useArticles';
import { Badge } from '@repo/ui';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Star, Check } from 'lucide-react';
import { useArticleActions } from '@/hooks/useArticleActions';

interface ArticleRowProps {
    article: Article;
    onClick?: () => void;
    isSelected?: boolean;
    compact?: boolean; // true = 1-line, false = multi-line with preview
}

export const ArticleRow: React.FC<ArticleRowProps> = ({
    article,
    onClick,
    isSelected = false,
    compact = true,
}) => {
    const { markAsRead, toggleStar } = useArticleActions();

    const handleClick = () => {
        if (!article.isRead) {
            markAsRead(article.id, true);
        }
        onClick?.();
    };

    const handleStarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleStar(article.id, !article.isStarred);
    };

    const priorityColor = {
        High: 'bg-red-500',
        Medium: 'bg-yellow-500',
        Low: 'bg-green-500',
    };

    if (compact) {
        // Compact 1-line view (List mode)
        return (
            <div
                onClick={handleClick}
                className={`
                    group flex items-center gap-3 px-3 py-2 cursor-pointer border-b
                    transition-colors duration-150
                    ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                    ${article.isRead ? 'opacity-60' : ''}
                    border-gray-200 dark:border-gray-700
                `}
            >
                {/* Priority indicator */}
                {article.ai && (
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityColor[article.ai.priority]}`} />
                )}

                {/* Title */}
                <span className={`flex-1 truncate text-sm ${article.isRead ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100 font-medium'}`}>
                    {article.title}
                </span>

                {/* Feed name (if available) */}
                <span className="text-xs text-gray-400 flex-shrink-0 max-w-[100px] truncate">
                    {article.author || ''}
                </span>

                {/* Time */}
                <span className="text-xs text-gray-400 flex-shrink-0 w-16 text-right">
                    {article.isoDate
                        ? formatDistanceToNow(new Date(article.isoDate), { addSuffix: false, locale: ja })
                        : ''}
                </span>

                {/* Actions (visible on hover) */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleStarClick}
                        className={`p-1 rounded ${article.isStarred ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400'}`}
                    >
                        <Star className="w-3.5 h-3.5" fill={article.isStarred ? 'currentColor' : 'none'} />
                    </button>
                    {article.isRead && <Check className="w-3.5 h-3.5 text-green-500" />}
                </div>
            </div>
        );
    }

    // Expanded multi-line view
    return (
        <div
            onClick={handleClick}
            className={`
                group px-4 py-3 cursor-pointer border-b
                transition-colors duration-150
                ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                ${article.isRead ? 'opacity-60' : ''}
                border-gray-200 dark:border-gray-700
            `}
        >
            <div className="flex items-start gap-3">
                {/* Priority indicator */}
                {article.ai && (
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${priorityColor[article.ai.priority]}`} />
                )}

                <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-sm font-medium truncate ${article.isRead ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {article.title}
                        </h3>
                        <button
                            onClick={handleStarClick}
                            className={`p-0.5 rounded flex-shrink-0 ${article.isStarred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                        >
                            <Star className="w-3.5 h-3.5" fill={article.isStarred ? 'currentColor' : 'none'} />
                        </button>
                    </div>

                    {/* Preview text */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                        {article.ai?.summary || article.contentSnippet || ''}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{article.author || ''}</span>
                        {article.isoDate && (
                            <>
                                <span>·</span>
                                <span>{formatDistanceToNow(new Date(article.isoDate), { addSuffix: true, locale: ja })}</span>
                            </>
                        )}
                        {article.ai && (
                            <>
                                <span>·</span>
                                {article.ai.topics.slice(0, 2).map(topic => (
                                    <Badge key={topic} variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {topic}
                                    </Badge>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
