import { NextResponse } from 'next/server';
import { db, feeds } from '@/lib/db';
import { scheduleAllFeeds } from '@/lib/queue';

/**
 * Cron endpoint to trigger periodic feed fetching.
 * 
 * This endpoint can be called by:
 * - Vercel Cron (vercel.json configuration)
 * - External scheduler (e.g., cron-job.org)
 * - Docker container internal scheduler
 * 
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: Request) {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get all active feeds
        const allFeeds = await db
            .select({
                id: feeds.id,
                url: feeds.url,
                fetchFrequency: feeds.fetchFrequency,
            })
            .from(feeds);

        if (allFeeds.length === 0) {
            return NextResponse.json({ message: 'No feeds to fetch', count: 0 });
        }

        // Schedule all feeds for fetching
        await scheduleAllFeeds(
            allFeeds.map(f => ({
                id: f.id,
                url: f.url,
                fetchFrequency: f.fetchFrequency || 15,
            }))
        );

        console.log(`[Cron] Scheduled ${allFeeds.length} feeds for fetching`);

        return NextResponse.json({
            success: true,
            message: `Scheduled ${allFeeds.length} feeds for fetching`,
            count: allFeeds.length,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('[Cron] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
