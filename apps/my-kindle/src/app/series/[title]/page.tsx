'use client';

import { useEffect, useState } from 'react';
import { useLibrary } from '@/hooks/use-library';
import { BookCard } from '@/components/features/book-card';
import { Button } from '@repo/ui';
import { ArrowLeft, Layers } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SeriesPage({ params }: { params: Promise<{ title: string }> }) {
    const { groupedBooks, isLoading } = useLibrary();
    const [resolvedParams, setResolvedParams] = useState<{ title: string } | null>(null);
    const router = useRouter();

    useEffect(() => {
        params.then(setResolvedParams);
    }, [params]);

    if (isLoading || !resolvedParams) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    const seriesTitle = decodeURIComponent(resolvedParams.title);

    // Find the series group
    // Note: groupedBooks might be filtered by search/status in the main page context if useLibrary shares state,
    // but useLibrary creates a new instance here, so it should have default state (all books, no filter).
    // However, useLibrary fetches data on mount.

    const series = groupedBooks.find(g => g.title === seriesTitle);

    if (!series) {
        return (
            <div className="min-h-screen bg-black text-zinc-100 p-6 flex flex-col items-center justify-center">
                <p className="text-zinc-500 mb-4">シリーズが見つかりませんでした。</p>
                <Button variant="outline" onClick={() => router.back()}>
                    戻る
                </Button>
            </div>
        );
    }

    const unreadCount = series.books.filter(b => b.progress < 100).length;

    return (
        <div className="min-h-screen bg-black text-zinc-100 p-6">
            <header className="flex flex-col gap-6 mb-8 max-w-7xl mx-auto">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                            <Layers className="w-4 h-4" />
                            <span>シリーズ</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">{series.title}</h1>
                    </div>
                </div>

                <div className="flex gap-4 text-sm text-zinc-400 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                    <div>
                        <span className="block font-bold text-white text-lg">{series.books.length}</span>
                        <span>冊</span>
                    </div>
                    <div>
                        <span className="block font-bold text-white text-lg">{unreadCount}</span>
                        <span>未読</span>
                    </div>
                    <div>
                        <span className="block font-bold text-white text-lg">
                            {Math.round(series.books.reduce((acc, b) => acc + b.progress, 0) / series.books.length)}%
                        </span>
                        <span>完了率</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {series.books.map((book) => (
                        <BookCard key={book.name} book={book} />
                    ))}
                </div>
            </main>
        </div>
    );
}
