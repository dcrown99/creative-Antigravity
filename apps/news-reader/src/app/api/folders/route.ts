import { NextResponse } from 'next/server';
import { db, folders, feeds } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

/**
 * GET /api/folders - Get all folders with feed counts
 */
export async function GET() {
    try {
        const allFolders = await db
            .select({
                id: folders.id,
                name: folders.name,
                order: folders.order,
                createdAt: folders.createdAt,
            })
            .from(folders)
            .orderBy(folders.order, folders.name);

        // Get feed counts for each folder
        const feedCounts = await db
            .select({
                folderId: feeds.folderId,
                count: sql<number>`count(*)`.as('count'),
            })
            .from(feeds)
            .groupBy(feeds.folderId);

        const countsMap = new Map(
            feedCounts
                .filter(fc => fc.folderId !== null)
                .map(fc => [fc.folderId!, fc.count])
        );

        const foldersWithCounts = allFolders.map(folder => ({
            ...folder,
            feedCount: countsMap.get(folder.id) || 0,
        }));

        return NextResponse.json({ folders: foldersWithCounts });
    } catch (error) {
        console.error('GET /api/folders error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * POST /api/folders - Create a new folder
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }

        // Get max order
        const maxOrderResult = await db
            .select({ maxOrder: sql<number>`max("order")` })
            .from(folders);

        const maxOrder = maxOrderResult[0]?.maxOrder || 0;

        const newFolder = {
            id: crypto.randomUUID(),
            name: name.trim(),
            order: maxOrder + 1,
            createdAt: new Date(),
        };

        await db.insert(folders).values(newFolder);

        return NextResponse.json({
            success: true,
            folder: {
                ...newFolder,
                feedCount: 0,
            }
        }, { status: 201 });

    } catch (error) {
        console.error('POST /api/folders error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * PATCH /api/folders - Update folder (rename, reorder)
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, name, order } = body;

        if (!id) {
            return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
        }

        const updateData: Partial<typeof folders.$inferInsert> = {};

        if (typeof name === 'string' && name.trim().length > 0) {
            updateData.name = name.trim();
        }

        if (typeof order === 'number') {
            updateData.order = order;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        await db
            .update(folders)
            .set(updateData)
            .where(eq(folders.id, id));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('PATCH /api/folders error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * DELETE /api/folders - Delete a folder (feeds move to uncategorized)
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
        }

        // Move feeds to uncategorized (null folder)
        await db
            .update(feeds)
            .set({ folderId: null })
            .where(eq(feeds.folderId, id));

        // Delete folder
        await db.delete(folders).where(eq(folders.id, id));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('DELETE /api/folders error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
