import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export function useBookmarks(bookName?: string) {
    const bookmarks = useLiveQuery(() => {
        if (bookName) {
            return db.bookmarks.where('bookName').equals(bookName).sortBy('pageIndex');
        }
        return db.bookmarks.orderBy('createdAt').reverse().toArray();
    }, [bookName]);

    const addBookmark = async (bookName: string, pageIndex: number, note?: string) => {
        // Check if bookmark already exists for this page
        const existing = await db.bookmarks
            .where('[bookName+pageIndex]')
            .equals([bookName, pageIndex])
            .first();

        if (existing) {
            // Update existing bookmark
            await db.bookmarks.update(existing.id!, {
                note,
                createdAt: Date.now(),
            });
        } else {
            // Add new bookmark
            await db.bookmarks.add({
                bookName,
                pageIndex,
                note,
                createdAt: Date.now(),
            });
        }
    };

    const removeBookmark = async (id: number) => {
        await db.bookmarks.delete(id);
    };

    const isBookmarked = (pageIndex: number) => {
        if (!bookmarks || !bookName) return false;
        return bookmarks.some(b => b.pageIndex === pageIndex);
    };

    return {
        bookmarks: bookmarks ?? [],
        addBookmark,
        removeBookmark,
        isBookmarked,
    };
}
