'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@repo/ui';
import { Sparkles, TrendingUp, AlertCircle } from 'lucide-react';

// Simple Skeleton component
function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />;
}

interface DigestData {
    digest: {
        summary: string;
        trendingTopics: string[];
        stats: {
            total: number;
            high: number;
            medium: number;
        };
        highlights: Array<{
            id: string;
            title: string;
            summary: string | null;
        }>;
    } | null;
    message?: string;
    generatedAt: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function DigestCard() {
    const { data, error, isLoading } = useSWR<DigestData>(
        '/api/digest',
        fetcher,
        { refreshInterval: 1000 * 60 * 30 } // Refresh every 30 minutes
    );

    if (isLoading) {
        return (
            <Card className="mb-4 bg-gradient-to-r from-indigo-50 to-purple-50">
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error || !data) {
        return null;
    }

    if (!data.digest) {
        return (
            <Card className="mb-4 bg-gray-50">
                <CardContent className="py-4 flex items-center gap-2 text-gray-500">
                    <AlertCircle className="w-4 h-4" />
                    {data.message || '新着記事がありません'}
                </CardContent>
            </Card>
        );
    }

    const { digest } = data;

    return (
        <Card className="mb-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-100 dark:border-indigo-900/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    今日のダイジェスト
                    <Badge variant="secondary" className="ml-auto text-xs">
                        {digest.stats.total}件の記事
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* AI Summary */}
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {digest.summary}
                </p>

                {/* Trending Topics */}
                {digest.trendingTopics.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                        {digest.trendingTopics.map(topic => (
                            <Badge key={topic} variant="outline" className="text-xs">
                                {topic}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Stats */}
                <div className="flex gap-4 text-xs text-gray-500">
                    {digest.stats.high > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            重要: {digest.stats.high}件
                        </span>
                    )}
                    {digest.stats.medium > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            注目: {digest.stats.medium}件
                        </span>
                    )}
                </div>

                {/* Highlights */}
                {digest.highlights.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                        <h4 className="text-xs font-medium text-gray-500 mb-2">
                            ハイライト
                        </h4>
                        <ul className="space-y-1">
                            {digest.highlights.slice(0, 3).map(article => (
                                <li key={article.id} className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                    • {article.title}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
