import { NextResponse } from 'next/server';
import { db, tags, articleTags, articles } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

/**
 * GET /api/tags - Get all tags with article counts
 */
export async function GET() {
    try {
        const allTags = await db
            .select({
                id: tags.id,
                name: tags.name,
                color: tags.color,
                createdAt: tags.createdAt,
            })
            .from(tags)
            .orderBy(tags.name);

        // Get article counts for each tag
        const tagCounts = await db
            .select({
                tagId: articleTags.tagId,
                count: sql<number>`count(*)`.as('count'),
            })
            .from(articleTags)
            .groupBy(articleTags.tagId);

        const countsMap = new Map(tagCounts.map(tc => [tc.tagId, tc.count]));

        const tagsWithCounts = allTags.map(tag => ({
            ...tag,
            articleCount: countsMap.get(tag.id) || 0,
        }));

        return NextResponse.json({ tags: tagsWithCounts });
    } catch (error) {
        console.error('GET /api/tags error:', error);
        return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }
}

/**
 * POST /api/tags - Create a new tag
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, color } = body;

        if (!name) {
            return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
        }

        const id = crypto.randomUUID();

        await db.insert(tags).values({
            id,
            name,
            color: color || '#6366f1',
            createdAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            tag: { id, name, color: color || '#6366f1' },
        });

    } catch (error) {
        console.error('POST /api/tags error:', error);
        return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }
}

/**
 * PATCH /api/tags - Update a tag or add/remove tag from article
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, name, color, articleId, action } = body;

        // Add/remove tag from article
        if (articleId && action) {
            if (action === 'add' && id) {
                await db.insert(articleTags).values({
                    articleId,
                    tagId: id,
                }).onConflictDoNothing();
                return NextResponse.json({ success: true, action: 'added' });
            } else if (action === 'remove' && id) {
                await db.delete(articleTags)
                    .where(sql`article_id = ${articleId} AND tag_id = ${id}`);
                return NextResponse.json({ success: true, action: 'removed' });
            }
        }

        // Update tag itself
        if (!id) {
            return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (color !== undefined) updateData.color = color;

        await db
            .update(tags)
            .set(updateData)
            .where(eq(tags.id, id));

        return NextResponse.json({ success: true, id });

    } catch (error) {
        console.error('PATCH /api/tags error:', error);
        return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
    }
}

/**
 * DELETE /api/tags - Delete a tag
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 });
        }

        await db.delete(tags).where(eq(tags.id, id));

        return NextResponse.json({ success: true, id });

    } catch (error) {
        console.error('DELETE /api/tags error:', error);
        return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }
}
