import React from 'react';
import Image from 'next/image';
import { Article } from '@/hooks/useArticles';
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@repo/ui';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Star, Check, ImageOff } from 'lucide-react';
import { useArticleActions } from '@/hooks/useArticleActions';

interface ArticleCardProps {
    article: Article;
    onRead?: () => void;
    compact?: boolean;
    featured?: boolean;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onRead, compact = false, featured = false }) => {
    const { markAsRead, toggleStar } = useArticleActions();
    const [imgError, setImgError] = React.useState(false);

    const priorityColor = {
        High: 'bg-red-500',
        Medium: 'bg-yellow-500',
        Low: 'bg-green-500',
    };

    const handleClick = () => {
        if (!article.isRead) {
            markAsRead(article.id, true);
        }
        onRead?.();
    };

    const handleStarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        toggleStar(article.id, !article.isStarred);
    };

    const cardClasses = compact
        ? `h-full hover:shadow-md transition-all duration-200 cursor-pointer dark:border-gray-700 ${article.isRead ? 'opacity-60 bg-gray-50/50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800'}`
        : featured
            ? `hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 dark:border-gray-700 ${article.isRead ? 'opacity-60 bg-gray-50/50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800'}`
            : `mb-4 hover:shadow-md transition-all duration-200 border-l-4 cursor-pointer dark:border-gray-700 ${article.isRead ? 'opacity-60 bg-gray-50/50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800'}`;

    // Show thumbnail for card/column/magazine views
    const showThumbnail = (compact || featured) && article.thumbnail && !imgError;

    return (
        <Card
            className={cardClasses}
            style={{
                borderLeftColor: compact ? undefined : (article.ai?.priority === 'High' ? '#ef4444' :
                    article.ai?.priority === 'Medium' ? '#eab308' : '#22c55e')
            }}
            onClick={handleClick}
        >
            {/* Thumbnail Image for Card/Magazine views */}
            {showThumbnail && (
                <div className={`relative overflow-hidden ${featured ? 'h-48' : 'h-32'} bg-gray-100 dark:bg-gray-700`}>
                    <Image
                        src={article.thumbnail!}
                        alt={article.title}
                        fill
                        className="object-cover"
                        sizes={featured ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
                        onError={() => setImgError(true)}
                        unoptimized // Allow external images
                    />
                </div>
            )}

            {/* Placeholder for cards without thumbnail */}
            {(compact || featured) && !showThumbnail && (
                <div className={`flex items-center justify-center ${featured ? 'h-48' : 'h-32'} bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800`}>
                    <ImageOff className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
            )}

            <CardHeader className={compact ? "p-3 pb-1" : "pb-2"}>
                <div className="flex justify-between items-start gap-2">
                    <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex-1"
                    >
                        <CardTitle className={`${compact ? 'text-sm' : 'text-lg'} font-bold leading-tight ${article.isRead ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
                            }`}>
                            {article.title}
                        </CardTitle>
                    </a>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Star button */}
                        <button
                            onClick={handleStarClick}
                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${article.isStarred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                                }`}
                            title={article.isStarred ? 'Remove star' : 'Add star'}
                        >
                            <Star className="w-4 h-4" fill={article.isStarred ? 'currentColor' : 'none'} />
                        </button>

                        {/* Read indicator */}
                        {article.isRead && (
                            <Check className="w-4 h-4 text-green-500" />
                        )}

                        {/* Priority badge */}
                        {article.ai && (
                            <Badge
                                variant="outline"
                                className={`${priorityColor[article.ai.priority]} text-white border-none text-xs`}
                            >
                                {article.ai.priority}
                            </Badge>
                        )}
                    </div>
                </div>

                <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                    {article.isoDate
                        ? formatDistanceToNow(new Date(article.isoDate), { addSuffix: true, locale: ja })
                        : 'Recently'}
                    {article.author && ` · ${article.author}`}
                </CardDescription>
            </CardHeader>

            <CardContent className={compact ? "p-3 pt-0" : ""}>
                {article.ai ? (
                    <div className={`bg-muted/50 p-3 rounded-md ${compact ? 'mb-0' : 'mb-2'}`}>
                        <p className="text-sm font-medium mb-1 flex items-center gap-1 text-gray-900 dark:text-gray-100">
                            ✨ AI Summary
                        </p>
                        <p className={`text-sm text-muted-foreground dark:text-gray-400 leading-relaxed whitespace-pre-line ${compact ? 'line-clamp-2' : ''}`}>
                            {article.ai.summary}
                        </p>
                        {!compact && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {article.ai.topics.map((topic) => (
                                    <Badge key={topic} variant="secondary" className="text-xs">
                                        {topic}
                                    </Badge>
                                ))}
                                {article.ai.sentiment && (
                                    <Badge
                                        variant="outline"
                                        className={`text-xs ${article.ai.sentiment === 'Positive' ? 'border-green-300 text-green-600' :
                                            article.ai.sentiment === 'Negative' ? 'border-red-300 text-red-600' :
                                                'border-gray-300 text-gray-600'
                                            }`}
                                    >
                                        {article.ai.sentiment}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className={`text-sm ${compact ? 'line-clamp-2' : 'line-clamp-3'} ${article.isRead ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'
                        }`}>
                        {article.contentSnippet}
                    </p>
                )}
            </CardContent>
        </Card>
    );
};
