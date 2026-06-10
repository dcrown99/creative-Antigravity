import { Worker, Job } from 'bullmq';
import { parseRSS } from '../rss-parser';
import { analyzeArticle } from '../gemini-client';
import { db, articles, feeds, articleAnalysis } from '../db';
import { eq } from 'drizzle-orm';
import { FeedFetchJobData, AIAnalysisJobData, getRedisConnection, scheduleAIAnalysis } from '../queue';

// Lazy worker variables
let feedFetchWorker: Worker<FeedFetchJobData> | null = null;
let aiAnalysisWorker: Worker<AIAnalysisJobData> | null = null;

// =============================================================================
// Worker Registration
// =============================================================================

export function registerWorkers() {
    if (feedFetchWorker && aiAnalysisWorker) {
        console.log('[Workers] Already registered');
        return;
    }

    const connection = getRedisConnection();

    // =============================================================================
    // Feed Fetch Worker
    // =============================================================================
    feedFetchWorker = new Worker<FeedFetchJobData>(
        'feed-fetch',
        async (job: Job<FeedFetchJobData>) => {
            const { feedId, feedUrl } = job.data;
            console.log(`[FeedWorker] Fetching: ${feedUrl}`);

            try {
                // Fetch and parse RSS
                const feed = await parseRSS(feedUrl);
                if (!feed) {
                    throw new Error(`Failed to parse RSS from ${feedUrl}`);
                }

                // Get existing article links to avoid duplicates
                const existingArticles = await db
                    .select({ link: articles.link })
                    .from(articles)
                    .where(eq(articles.feedId, feedId));

                const existingLinks = new Set(existingArticles.map(a => a.link));

                // Insert new articles
                const newArticles = feed.items
                    .filter(item => item.link && !existingLinks.has(item.link))
                    .map(item => ({
                        id: crypto.randomUUID(),
                        feedId,
                        link: item.link!,
                        title: item.title || 'Untitled',
                        content: item.content,
                        contentSnippet: item.contentSnippet,
                        thumbnail: item.thumbnail, // サムネイル画像
                        isoDate: item.isoDate,
                        pubDate: item.pubDate ? new Date(item.pubDate) : undefined,
                        createdAt: new Date(),
                    }));

                if (newArticles.length > 0) {
                    await db.insert(articles).values(newArticles);
                    console.log(`[FeedWorker] Added ${newArticles.length} new articles from ${feedUrl}`);

                    // Schedule AI analysis for top 3 new articles
                    for (const article of newArticles.slice(0, 3)) {
                        if (article.contentSnippet) {
                            await scheduleAIAnalysis(
                                article.id,
                                article.title,
                                article.contentSnippet
                            );
                        }
                    }
                } else {
                    console.log(`[FeedWorker] No new articles from ${feedUrl}`);
                }

                // Update feed's lastFetchedAt
                await db
                    .update(feeds)
                    .set({
                        lastFetchedAt: new Date(),
                        errorCount: 0,
                    })
                    .where(eq(feeds.id, feedId));

                return { success: true, newCount: newArticles.length };

            } catch (error) {
                console.error(`[FeedWorker] Error fetching ${feedUrl}:`, error);

                // Increment error count - just log the error, skip update
                console.log(`[FeedWorker] Would increment error count for feed ${feedId}`);

                throw error;
            }
        },
        {
            connection,
            concurrency: 3, // Process up to 3 feeds concurrently
        }
    );

    // =============================================================================
    // AI Analysis Worker
    // =============================================================================
    aiAnalysisWorker = new Worker<AIAnalysisJobData>(
        'ai-analysis',
        async (job: Job<AIAnalysisJobData>) => {
            const { articleId, title, content } = job.data;
            console.log(`[AIWorker] Analyzing: ${title.substring(0, 50)}...`);

            try {
                const result = await analyzeArticle(title, content);

                if (result) {
                    await db.insert(articleAnalysis).values({
                        id: crypto.randomUUID(),
                        articleId,
                        summary: result.summary,
                        priority: result.priority,
                        topics: result.topics,
                        sentiment: result.sentiment,
                        createdAt: new Date(),
                    });
                    console.log(`[AIWorker] Analysis saved for: ${articleId}`);
                }

                return { success: true, hasResult: !!result };

            } catch (error) {
                console.error(`[AIWorker] Error analyzing ${articleId}:`, error);
                throw error;
            }
        },
        {
            connection,
            concurrency: 2, // Limit AI calls
            limiter: {
                max: 10,
                duration: 60000, // Max 10 per minute to avoid rate limits
            },
        }
    );

    // =============================================================================
    // Worker Event Handlers
    // =============================================================================

    feedFetchWorker.on('completed', (job) => {
        console.log(`[FeedWorker] Job ${job.id} completed`);
    });

    feedFetchWorker.on('failed', (job, err) => {
        console.error(`[FeedWorker] Job ${job?.id} failed:`, err.message);
    });

    aiAnalysisWorker.on('completed', (job) => {
        console.log(`[AIWorker] Job ${job.id} completed`);
    });

    aiAnalysisWorker.on('failed', (job, err) => {
        console.error(`[AIWorker] Job ${job?.id} failed:`, err.message);
    });

    console.log('[Workers] Registered successfully');
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

export async function shutdownWorkers() {
    if (feedFetchWorker) await feedFetchWorker.close();
    if (aiAnalysisWorker) await aiAnalysisWorker.close();
    console.log('[Workers] Shutdown complete');
}

// Handle process signals
if (typeof process !== 'undefined') {
    process.on('SIGTERM', shutdownWorkers);
    process.on('SIGINT', shutdownWorkers);
}
