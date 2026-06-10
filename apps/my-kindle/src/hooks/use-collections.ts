import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export function useCollections() {
    const collections = useLiveQuery(() => db.collections.toArray());

    const addCollection = async (name: string) => {
        await db.collections.add({
            name,
            bookNames: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    };

    const deleteCollection = async (id: number) => {
        await db.collections.delete(id);
    };

    const addBookToCollection = async (collectionId: number, bookName: string) => {
        const collection = await db.collections.get(collectionId);
        if (collection && !collection.bookNames.includes(bookName)) {
            await db.collections.update(collectionId, {
                bookNames: [...collection.bookNames, bookName],
                updatedAt: Date.now(),
            });
        }
    };

    const removeBookFromCollection = async (collectionId: number, bookName: string) => {
        const collection = await db.collections.get(collectionId);
        if (collection) {
            await db.collections.update(collectionId, {
                bookNames: collection.bookNames.filter((name) => name !== bookName),
                updatedAt: Date.now(),
            });
        }
    };

    return {
        collections: collections ?? [],
        addCollection,
        deleteCollection,
        addBookToCollection,
        removeBookFromCollection,
    };
}
