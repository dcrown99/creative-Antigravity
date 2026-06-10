import { NextResponse } from 'next/server';
import { db, articles, articleAnalysis, feeds } from '@/lib/db';
import { eq, and, desc, sql, like, inArray } from 'drizzle-orm';
import { searchArticles } from '@/lib/db';

/**
 * GET /api/articles - Get articles with filtering and search
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const feedId = searchParams.get('feedId');
        const filter = searchParams.get('filter') || 'all'; // all, unread, starred
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Full-text search if query provided
        if (search) {
            const results = searchArticles(search, limit);
            return NextResponse.json({ articles: results, total: results.length });
        }

        // Build query conditions
        const conditions = [];

        if (feedId) {
            conditions.push(eq(articles.feedId, feedId));
        }

        if (filter === 'unread') {
            conditions.push(eq(articles.isRead, false));
        } else if (filter === 'starred') {
            conditions.push(eq(articles.isStarred, true));
        }

        // Get total count
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(articles)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        const total = countResult[0]?.count || 0;

        // Get articles with AI analysis
        const articlesData = await db
            .select({
                id: articles.id,
                feedId: articles.feedId,
                link: articles.link,
                title: articles.title,
                contentSnippet: articles.contentSnippet,
                thumbnail: articles.thumbnail, // サムネイル画像
                author: articles.author,
                pubDate: articles.pubDate,
                isoDate: articles.isoDate,
                isRead: articles.isRead,
                isStarred: articles.isStarred,
                readAt: articles.readAt,
                createdAt: articles.createdAt,
                // AI Analysis
                aiSummary: articleAnalysis.summary,
                aiPriority: articleAnalysis.priority,
                aiTopics: articleAnalysis.topics,
                aiSentiment: articleAnalysis.sentiment,
            })
            .from(articles)
            .leftJoin(articleAnalysis, eq(articles.id, articleAnalysis.articleId))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(articles.pubDate), desc(articles.createdAt))
            .limit(limit)
            .offset(offset);

        // Transform to match expected format
        const formattedArticles = articlesData.map(article => ({
            id: article.id,
            feedId: article.feedId,
            link: article.link,
            title: article.title,
            contentSnippet: article.contentSnippet,
            thumbnail: article.thumbnail, // サムネイル画像
            author: article.author,
            pubDate: article.pubDate,
            isoDate: article.isoDate,
            isRead: article.isRead,
            isStarred: article.isStarred,
            readAt: article.readAt,
            createdAt: article.createdAt,
            ai: article.aiSummary ? {
                summary: article.aiSummary,
                priority: article.aiPriority,
                topics: article.aiTopics,
                sentiment: article.aiSentiment,
            } : null,
        }));

        return NextResponse.json({
            articles: formattedArticles,
            total,
            hasMore: offset + limit < total,
        });

    } catch (error) {
        console.error('GET /api/articles error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * PATCH /api/articles - Update article state (mark read, star, etc.)
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ids, isRead, isStarred, markAllAsRead, feedId } = body;

        // Bulk mark all as read for a feed
        if (markAllAsRead && feedId) {
            await db
                .update(articles)
                .set({
                    isRead: true,
                    readAt: new Date()
                })
                .where(and(
                    eq(articles.feedId, feedId),
                    eq(articles.isRead, false)
                ));

            return NextResponse.json({ success: true, action: 'markAllAsRead' });
        }

        // Bulk update multiple articles
        if (ids && Array.isArray(ids)) {
            const updateData: Partial<typeof articles.$inferInsert> = {};

            if (typeof isRead === 'boolean') {
                updateData.isRead = isRead;
                if (isRead) updateData.readAt = new Date();
            }

            if (typeof isStarred === 'boolean') {
                updateData.isStarred = isStarred;
            }

            await db
                .update(articles)
                .set(updateData)
                .where(inArray(articles.id, ids));

            return NextResponse.json({ success: true, updated: ids.length });
        }

        // Single article update
        if (!id) {
            return NextResponse.json({ error: 'Article ID is required' }, { status: 400 });
        }

        const updateData: Partial<typeof articles.$inferInsert> = {};

        if (typeof isRead === 'boolean') {
            updateData.isRead = isRead;
            if (isRead) updateData.readAt = new Date();
        }

        if (typeof isStarred === 'boolean') {
            updateData.isStarred = isStarred;
        }

        await db
            .update(articles)
            .set(updateData)
            .where(eq(articles.id, id));

        return NextResponse.json({ success: true, id });

    } catch (error) {
        console.error('PATCH /api/articles error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
