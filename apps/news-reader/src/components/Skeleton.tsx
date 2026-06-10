'use client';

import React from 'react';
import { cn } from '@repo/ui';

interface SkeletonProps {
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
    <div className={cn('animate-pulse bg-gray-200 dark:bg-gray-700 rounded', className)} />
);

// Article row skeleton for list view
export const ArticleRowSkeleton: React.FC = () => (
    <div className="flex items-center gap-3 px-3 py-2 border-b dark:border-gray-700">
        <Skeleton className="w-2 h-2 rounded-full" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-10" />
    </div>
);

// Article card skeleton for card/magazine view
export const ArticleCardSkeleton: React.FC<{ featured?: boolean }> = ({ featured }) => (
    <div className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4',
        featured && 'col-span-full'
    )}>
        <Skeleton className={cn('w-full rounded-lg mb-4', featured ? 'h-48' : 'h-32')} />
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-3" />
        <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
        </div>
        <div className="flex gap-2 mt-4">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
        </div>
    </div>
);

// Full article list skeleton
interface ArticleListSkeletonProps {
    viewMode?: 'list' | 'expanded' | 'column' | 'card' | 'magazine';
    count?: number;
}

export const ArticleListSkeleton: React.FC<ArticleListSkeletonProps> = ({
    viewMode = 'list',
    count = 10
}) => {
    if (viewMode === 'list') {
        return (
            <div className="space-y-0">
                {Array.from({ length: count }).map((_, i) => (
                    <ArticleRowSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (viewMode === 'expanded') {
        return (
            <div className="space-y-0">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="px-4 py-3 border-b dark:border-gray-700">
                        <div className="flex items-start gap-3">
                            <Skeleton className="w-2 h-2 rounded-full mt-2" />
                            <div className="flex-1">
                                <Skeleton className="h-5 w-3/4 mb-2" />
                                <Skeleton className="h-3 w-full mb-1" />
                                <Skeleton className="h-3 w-2/3 mb-3" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-4 w-16" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (viewMode === 'column') {
        return (
            <div className="grid grid-cols-2 gap-3 p-3">
                {Array.from({ length: count }).map((_, i) => (
                    <ArticleCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (viewMode === 'card') {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                {Array.from({ length: count }).map((_, i) => (
                    <ArticleCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    // Magazine view
    return (
        <div className="p-3 space-y-4">
            <ArticleCardSkeleton featured />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: count - 1 }).map((_, i) => (
                    <ArticleCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
};

// Sidebar skeleton
export const FeedSidebarSkeleton: React.FC = () => (
    <div className="w-64 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900 h-screen p-4">
        {/* Header */}
        <div className="mb-4">
            <Skeleton className="h-5 w-20 mb-4" />
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-4 w-24" />
        </div>

        {/* Feed list */}
        <div className="space-y-2">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <div className="py-2">
                <Skeleton className="h-1 w-full" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
        </div>
    </div>
);
