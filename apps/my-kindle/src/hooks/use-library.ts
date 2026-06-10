import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { MangaFile, LibraryItem, SortOption, FilterOption } from '@/types';
import { groupBooksBySeries, SeriesGroup } from '@/lib/series-utils';

interface UseLibraryResult {
    books: LibraryItem[];
    groupedBooks: SeriesGroup[];
    allBooks: LibraryItem[];
    recentBooks: LibraryItem[];
    newBooks: LibraryItem[];
    isLoading: boolean;
    error: string | null;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filterStatus: FilterOption;
    setFilterStatus: (status: FilterOption) => void;
    sortOption: SortOption;
    setSortOption: (option: SortOption) => void;
    refreshLibrary: () => void;
}

// Helper to get progress from localStorage
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getBookProgress(bookName: string) {
    if (typeof window === 'undefined') return null;
    try {
        const key = `my-kindle-progress-${bookName}`;
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const data = JSON.parse(stored);

        const lastReadIndex = data.lastReadIndex ?? 0;
        const totalLength = data.totalLength ?? 1;

        return {
            lastReadIndex,
            totalLength,
            percentage: Math.round(((lastReadIndex + 1) / totalLength) * 100),
            updatedAt: data.updatedAt ?? 0
        };
    } catch {
        return null;
    }
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
};

export function useLibrary(): UseLibraryResult {
    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterOption>('all');
    const [sortOption, setSortOption] = useState<SortOption>('latest_added');

    const { data, error, mutate } = useSWR<MangaFile[] | { books: MangaFile[] }>('/api/manga/list', fetcher, {
        revalidateOnFocus: false,
    });

    const rawFiles = useMemo(() => {
        if (!data) return [];
        if (Array.isArray(data)) {
            // Handle legacy/mixed response
            return data.map((f: unknown) => {
                if (typeof f === 'string') return { name: f, size: 0, mtime: 0 };
                return f as MangaFile;
            });
        }
        if ('books' in data && Array.isArray(data.books)) {
            return data.books;
        }
        return [];
    }, [data]);

    // Helper to get all progress from localStorage at once
    function getAllProgressMap() {
        if (typeof window === 'undefined') return new Map();
        const map = new Map();
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('my-kindle-progress-')) {
                    const bookName = key.replace('my-kindle-progress-', '');
                    try {
                        const stored = localStorage.getItem(key);
                        if (stored) {
                            const data = JSON.parse(stored);
                            map.set(bookName, {
                                lastReadIndex: data.lastReadIndex ?? 0,
                                totalLength: data.totalLength ?? 1,
                                percentage: Math.round(((data.lastReadIndex ?? 0) + 1) / (data.totalLength ?? 1) * 100),
                                updatedAt: data.updatedAt ?? 0
                            });
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        } catch {
            // Ignore storage errors
        }
        return map;
    }

    // Merge API data with LocalStorage progress
    const libraryItems = useMemo(() => {
        if (rawFiles.length === 0) return [];

        // Batch read from LocalStorage
        const progressMap = getAllProgressMap();

        return rawFiles.map(file => {
            const progress = progressMap.get(file.name);

            if (progress) {
                return {
                    ...file,
                    progress: progress.percentage,
                    lastReadAt: progress.updatedAt,
                    isFinished: progress.percentage === 100,
                    pageCurrent: progress.lastReadIndex,
                    pageTotal: progress.totalLength
                };
            } else {
                return {
                    ...file,
                    progress: 0,
                    lastReadAt: 0,
                    isFinished: false,
                    pageCurrent: 0,
                    pageTotal: 0
                };
            }
        });
    }, [rawFiles]);

    // Filtering and Sorting Logic
    const filteredBooks = useMemo(() => {
        let result = [...libraryItems];

        // 1. Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(book => book.name.toLowerCase().includes(query));
        }

        // 2. Filter
        switch (filterStatus) {
            case 'unread':
                result = result.filter(book => book.progress === 0);
                break;
            case 'reading':
                result = result.filter(book => book.progress > 0 && book.progress < 100);
                break;
            case 'finished':
                result = result.filter(book => book.progress === 100);
                break;
            case 'all':
            default:
                break;
        }

        // 3. Sort
        result.sort((a, b) => {
            switch (sortOption) {
                case 'latest_added':
                    return b.mtime - a.mtime;
                case 'last_read':
                    if (a.lastReadAt === 0 && b.lastReadAt === 0) return 0;
                    if (a.lastReadAt === 0) return 1;
                    if (b.lastReadAt === 0) return -1;
                    return b.lastReadAt - a.lastReadAt;
                case 'alphabetical':
                    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                default:
                    return 0;
            }
        });

        return result;
    }, [libraryItems, searchQuery, filterStatus, sortOption]);

    const groupedBooks = useMemo(() => {
        return groupBooksBySeries(filteredBooks);
    }, [filteredBooks]);

    // Recent Books (Reading in progress or recently read)
    const recentBooks = useMemo(() => {
        return [...libraryItems]
            .filter(book => book.lastReadAt > 0)
            .sort((a, b) => b.lastReadAt - a.lastReadAt)
            .slice(0, 10);
    }, [libraryItems]);

    // New Arrivals (Recently added)
    const newBooks = useMemo(() => {
        return [...libraryItems]
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, 10);
    }, [libraryItems]);

    return {
        books: filteredBooks,
        groupedBooks,
        allBooks: libraryItems,
        recentBooks,
        newBooks,
        isLoading: !data && !error,
        error: error ? error.message : null,
        searchQuery,
        setSearchQuery,
        filterStatus,
        setFilterStatus,
        sortOption,
        setSortOption,
        refreshLibrary: mutate
    };
}
