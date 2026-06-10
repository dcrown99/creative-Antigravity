'use client';

import { useState, useEffect, use, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSwipe } from '@/hooks/use-swipe';
import { useReadingState } from '@/hooks/use-reading-state';
import { Button } from '@repo/ui';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { useLibrary } from '@/hooks/use-library';

// --- アイコン (Lucide相当) ---
const ArrowLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
);
const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);
const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
const BookmarkIcon = ({ filled }: { filled: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
);
const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
);

interface PageProps {
    params: Promise<{ book: string }>;
}

export default function ReadPage({ params }: PageProps) {
    const { book } = use(params);
    const decodedBookName = decodeURIComponent(book);
    const router = useRouter();

    // 状態管理
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUI, setShowUI] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    const {
        currentIndex,
        saveProgress,
        settings,
        saveSettings,
        isLoaded: isStateLoaded
    } = useReadingState(decodedBookName);

    // ライブラリ情報（次の巻の取得用）
    const { groupedBooks } = useLibrary();

    const nextBook = useMemo(() => {
        const group = groupedBooks.find(g => g.books.some(b => b.name === decodedBookName));
        if (!group) return null;
        const index = group.books.findIndex(b => b.name === decodedBookName);
        if (index >= 0 && index < group.books.length - 1) {
            return group.books[index + 1];
        }
        return null;
    }, [groupedBooks, decodedBookName]);

    // ブックマーク管理
    const { bookmarks, addBookmark, removeBookmark } = useBookmarks();
    const isBookmarked = bookmarks.some(
        bm => bm.bookName === decodedBookName && bm.pageIndex === currentIndex
    );
    const toggleBookmark = useCallback(() => {
        if (isBookmarked) {
            const bookmark = bookmarks.find(
                bm => bm.bookName === decodedBookName && bm.pageIndex === currentIndex
            );
            if (bookmark && bookmark.id !== undefined) removeBookmark(bookmark.id);
        } else {
            addBookmark(decodedBookName, currentIndex);
        }
    }, [isBookmarked, bookmarks, decodedBookName, currentIndex, addBookmark, removeBookmark]);

    // 画像リスト取得
    useEffect(() => {
        fetch(`/api/manga/list?book=${encodeURIComponent(decodedBookName)}`)
            .then((res) => res.ok ? res.json() : Promise.reject(res.status))
            .then((data) => {
                let imageList: string[] = [];
                if (Array.isArray(data)) imageList = data;
                else if (data.images) imageList = data.images;
                else if (data.files) imageList = data.files;

                const validImages = imageList.filter(file =>
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
                );
                setImages(validImages);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to load images:', err);
                setLoading(false);
            });
    }, [decodedBookName]);

    // ページ遷移（境界チェック付き）
    const goToPage = useCallback((index: number) => {
        if (images.length === 0) return;
        const safeIndex = Math.max(0, Math.min(index, images.length - 1));
        saveProgress(safeIndex, images.length);
    }, [images.length, saveProgress]);

    // 見開き表示かどうかを判定
    const isSpread = settings.viewMode === 'spread';

    // 次へ・前へ（見開きの時は2ページ進む）
    const step = isSpread ? 2 : 1;

    const goNext = useCallback(() => {
        let nextIndex = currentIndex + step;
        if (isSpread && currentIndex === 0) {
            nextIndex = 1;
        }

        // 最後のページを超えた場合
        if (nextIndex >= images.length) {
            // 次の巻があれば移動するか確認（あるいはボタンを表示）
            // ここでは単にページ移動を止めるだけにする（UIでボタンを表示するため）
            return;
        }

        goToPage(nextIndex);
    }, [currentIndex, step, goToPage, isSpread, images.length]);

    const goPrev = useCallback(() => {
        let prevIndex = currentIndex - step;
        if (isSpread && currentIndex === 1) {
            prevIndex = 0;
        }
        goToPage(prevIndex);
    }, [currentIndex, step, goToPage, isSpread]);

    // スワイプ・キーボード操作
    const swipeHandlers = useSwipe({
        onSwipeLeft: () => { if (currentIndex < images.length - 1) goNext(); },
        onSwipeRight: () => { if (currentIndex > 0) goPrev(); },
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                if (settings.direction === 'rtl') goPrev();
                else goNext();
            } else if (e.key === 'ArrowLeft') {
                if (settings.direction === 'rtl') goNext();
                else goPrev();
            } else if (e.key === ' ') {
                e.preventDefault();
                goNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settings.direction, goNext, goPrev]);

    if (loading || !isStateLoaded) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    if (images.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-4">
                <p className="mb-4">画像が見つかりませんでした。</p>
                <Button onClick={() => router.push('/')}>ライブラリに戻る</Button>
            </div>
        );
    }

    // --- 表示する画像の決定 ---
    const showSpread = isSpread && currentIndex > 0 && currentIndex < images.length;
    let visibleIndices: number[] = [];

    if (!showSpread) {
        visibleIndices = [currentIndex];
    } else {
        const isEven = currentIndex % 2 === 0;
        const baseIndex = isEven ? currentIndex - 1 : currentIndex;
        const rightPageIdx = baseIndex;
        const leftPageIdx = baseIndex + 1;

        if (settings.direction === 'rtl') {
            visibleIndices = [leftPageIdx, rightPageIdx];
        } else {
            visibleIndices = [rightPageIdx, leftPageIdx];
        }
    }

    const preloadIndex = currentIndex + step;
    const isLastPage = currentIndex >= images.length - (isSpread ? 2 : 1);

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col" {...swipeHandlers}>

            {/* --- Viewer Area --- */}
            <div
                className="flex-1 relative w-full h-full flex items-center justify-center"
                onClick={() => setShowUI(!showUI)}
            >
                <div className={`relative w-full h-full flex items-center justify-center`}>
                    {visibleIndices.map((idx, i) => {
                        if (idx >= images.length) return null;
                        const imgSrc = `/api/manga/image?book=${encodeURIComponent(decodedBookName)}&image=${encodeURIComponent(images[idx])}`;
                        const isSingleView = visibleIndices.length === 1;

                        return (
                            <div
                                key={`${idx}-${i}`}
                                className={`relative h-full flex items-center ${isSingleView
                                    ? 'w-full justify-center'
                                    : i === 0
                                        ? 'w-1/2 justify-end'
                                        : 'w-1/2 justify-start'
                                    }`}
                            >
                                <Image
                                    src={imgSrc}
                                    alt={`Page ${idx + 1}`}
                                    fill
                                    className={`
                                        ${settings.fitMode === 'cover' ? 'object-cover' : 'object-contain'} 
                                        ${!isSingleView && i === 0 ? 'object-right' : ''} 
                                        ${!isSingleView && i === 1 ? 'object-left' : ''} 
                                        select-none pointer-events-none
                                    `}
                                    priority={true}
                                    unoptimized
                                    quality={85}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- Next Volume Button (Overlay) --- */}
            {isLastPage && nextBook && showUI && (
                <div className="absolute bottom-24 right-6 z-30 animate-in fade-in slide-in-from-right-4">
                    <Button
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/read/${encodeURIComponent(nextBook.name)}`);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg gap-2"
                    >
                        次の巻へ ({nextBook.name})
                        <ChevronRightIcon />
                    </Button>
                </div>
            )}

            {/* --- Preload --- */}
            {preloadIndex < images.length && (
                <div className="hidden">
                    <Image
                        src={`/api/manga/image?book=${encodeURIComponent(decodedBookName)}&image=${encodeURIComponent(images[preloadIndex])}`}
                        alt="preload" width={1} height={1} unoptimized
                    />
                </div>
            )}

            {/* --- Header UI --- */}
            <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 to-transparent p-4 transition-opacity duration-300 z-20 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex justify-between items-center text-white max-w-5xl mx-auto w-full">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); router.push('/'); }}>
                        <ArrowLeftIcon />
                    </Button>
                    <h1 className="text-sm font-medium truncate px-4 flex-1 text-center">
                        {decodedBookName}
                    </h1>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleBookmark(); }}>
                            <BookmarkIcon filled={isBookmarked} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}>
                            <SettingsIcon />
                        </Button>
                    </div>
                </div>
            </div>

            {/* --- Footer UI --- */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 pb-8 transition-opacity duration-300 z-20 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="max-w-5xl mx-auto w-full space-y-4">
                    <div className="flex items-center gap-4 text-white">
                        <span className="text-xs font-mono w-16 text-right">
                            {currentIndex + 1} <span className="text-gray-400">/ {images.length}</span>
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={images.length - 1}
                            value={currentIndex}
                            onChange={(e) => goToPage(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            </div>

            {/* --- Settings Modal --- */}
            {showSettings && (
                <div
                    className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
                    onClick={() => setShowSettings(false)}
                >
                    <div
                        className="bg-zinc-900 text-white rounded-xl p-6 w-full max-w-sm shadow-2xl border border-zinc-800 animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg">表示設定</h3>
                            <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)} className="rounded-full h-8 w-8 p-0">
                                <XIcon />
                            </Button>
                        </div>

                        <div className="space-y-6">
                            {/* 表示モード設定 */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400">ページ表示モード</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant={settings.viewMode === 'single' ? 'default' : 'outline'}
                                        onClick={() => saveSettings({ viewMode: 'single' })}
                                        className="text-sm border-zinc-700"
                                    >
                                        単一ページ
                                    </Button>
                                    <Button
                                        variant={settings.viewMode === 'spread' ? 'default' : 'outline'}
                                        onClick={() => saveSettings({ viewMode: 'spread' })}
                                        className="text-sm border-zinc-700"
                                    >
                                        見開き (2P)
                                    </Button>
                                </div>
                            </div>

                            {/* 読み進める方向 */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400">読む方向</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant={settings.direction === 'rtl' ? 'default' : 'outline'}
                                        onClick={() => saveSettings({ direction: 'rtl' })}
                                        className="text-sm border-zinc-700"
                                    >
                                        右開き (漫画)
                                    </Button>
                                    <Button
                                        variant={settings.direction === 'ltr' ? 'default' : 'outline'}
                                        onClick={() => saveSettings({ direction: 'ltr' })}
                                        className="text-sm border-zinc-700"
                                    >
                                        左開き (小説)
                                    </Button>
                                </div>
                            </div>

                            {/* 画像フィット設定 */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400">画像の収め方</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant={settings.fitMode === 'contain' ? 'default' : 'outline'}
                                        onClick={() => saveSettings({ fitMode: 'contain' })}
                                        className="text-sm border-zinc-700"
                                    >
                                        全体を表示
                                    </Button>
                                    <Button
                                        variant={settings.fitMode === 'cover' ? 'default' : 'outline'}
                                        onClick={() => saveSettings({ fitMode: 'cover' })}
                                        className="text-sm border-zinc-700"
                                    >
                                        画面いっぱいに拡大
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Click Navigation Zones --- */}
            <div className={`absolute inset-0 z-10 flex ${showUI ? '' : ''}`}>
                <div
                    className="w-[30%] h-full cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (settings.direction === 'rtl') goNext();
                        else goPrev();
                    }}
                    title="次へ / 戻る"
                />
                <div className="flex-1 h-full" onClick={() => setShowUI(!showUI)} />
                <div
                    className="w-[30%] h-full cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (settings.direction === 'rtl') goPrev();
                        else goNext();
                    }}
                    title="戻る / 次へ"
                />
            </div>
        </div>
    );
}