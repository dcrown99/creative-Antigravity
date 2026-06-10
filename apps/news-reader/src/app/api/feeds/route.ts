import { NextResponse } from 'next/server';
import { db, feeds, folders, articles } from '@/lib/db';
import { parseRSS } from '@/lib/rss-parser';
import { eq, sql } from 'drizzle-orm';
import { scheduleFeedFetch } from '@/lib/queue';

/**
 * GET /api/feeds - Get all feeds with unread counts
 */
export async function GET() {
    try {
        const allFeeds = await db
            .select({
                id: feeds.id,
                url: feeds.url,
                title: feeds.title,
                description: feeds.description,
                favicon: feeds.favicon,
                folderId: feeds.folderId,
                lastFetchedAt: feeds.lastFetchedAt,
                createdAt: feeds.createdAt,
            })
            .from(feeds)
            .orderBy(feeds.title);

        // Get unread counts for each feed
        const unreadCounts = await db
            .select({
                feedId: articles.feedId,
                count: sql<number>`count(*)`.as('count'),
            })
            .from(articles)
            .where(eq(articles.isRead, false))
            .groupBy(articles.feedId);

        const countsMap = new Map(unreadCounts.map(uc => [uc.feedId, uc.count]));

        const feedsWithCounts = allFeeds.map(feed => ({
            ...feed,
            unreadCount: countsMap.get(feed.id) || 0,
        }));

        return NextResponse.json({ feeds: feedsWithCounts });
    } catch (error) {
        console.error('GET /api/feeds error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * POST /api/feeds - Add a new feed
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, folderId } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Check if feed already exists
        const existing = await db
            .select({ id: feeds.id })
            .from(feeds)
            .where(eq(feeds.url, url))
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json({ error: 'Feed already exists' }, { status: 409 });
        }

        // Parse feed to get title and description
        const parsedFeed = await parseRSS(url);

        if (!parsedFeed) {
            return NextResponse.json({ error: 'Failed to parse RSS feed' }, { status: 400 });
        }

        // Create new feed
        const newFeed = {
            id: crypto.randomUUID(),
            url,
            title: parsedFeed.title || url,
            description: parsedFeed.description || null,
            folderId: folderId || null,
            createdAt: new Date(),
        };

        await db.insert(feeds).values(newFeed);

        // Try to schedule via BullMQ, but also fetch synchronously as fallback
        try {
            await scheduleFeedFetch(newFeed.id, url);
        } catch (queueError) {
            console.log('BullMQ unavailable, fetching synchronously...');
        }

        // Synchronous fetch: Save articles directly from parsed feed
        let savedCount = 0;
        if (parsedFeed.items && parsedFeed.items.length > 0) {
            for (const item of parsedFeed.items) {
                try {
                    await db.insert(articles).values({
                        id: crypto.randomUUID(),
                        feedId: newFeed.id,
                        title: item.title || 'Untitled',
                        link: item.link || '',
                        pubDate: item.pubDate ? new Date(item.pubDate) : null,
                        isoDate: item.isoDate || null,
                        content: item.content || null,
                        contentSnippet: item.contentSnippet || null,
                        isRead: false,
                        isStarred: false,
                        createdAt: new Date(),
                    }).onConflictDoNothing();
                    savedCount++;
                } catch (e) {
                    // Skip duplicates
                }
            }
            console.log(`✅ Saved ${savedCount} articles from ${url}`);
        }

        return NextResponse.json({
            success: true,
            feed: {
                ...newFeed,
                unreadCount: savedCount,
            }
        }, { status: 201 });

    } catch (error) {
        console.error('POST /api/feeds error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * PATCH /api/feeds - Update a feed (move to folder, change settings)
 *
 * Body: {
 *   id: string,
 *   folderId?: string | null,
 *   fetchFrequency?: number,
 *   title?: string
 * }
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, folderId, fetchFrequency, title } = body;

        if (!id) {
            return NextResponse.json({ error: 'Feed ID is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};

        if (folderId !== undefined) {
            updateData.folderId = folderId;
        }

        if (fetchFrequency !== undefined) {
            updateData.fetchFrequency = fetchFrequency;
        }

        if (title !== undefined) {
            updateData.title = title;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
        }

        await db
            .update(feeds)
            .set(updateData)
            .where(eq(feeds.id, id));

        return NextResponse.json({ success: true, id });

    } catch (error) {
        console.error('PATCH /api/feeds error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * DELETE /api/feeds - Delete a feed
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Feed ID is required' }, { status: 400 });
        }

        // Delete feed (articles will cascade delete due to FK constraint)
        await db.delete(feeds).where(eq(feeds.id, id));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('DELETE /api/feeds error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
