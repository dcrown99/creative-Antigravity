import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

// Redis connection for BullMQ
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Lazy initialization variables
let redisConnection: Redis | null = null;
let feedFetchQueue: Queue | null = null;
let aiAnalysisQueue: Queue | null = null;

// =============================================================================
// Lazy Getters
// =============================================================================

export function getRedisConnection(): Redis {
    if (!redisConnection) {
        redisConnection = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null, // Required for BullMQ
            family: 4, // Force IPv4
        });
        redisConnection.on('connect', () => console.log('[Redis] Connected'));
        redisConnection.on('error', (err) => console.error('[Redis] Error:', err));
    }
    return redisConnection;
}

export function getFeedFetchQueue(): Queue {
    if (!feedFetchQueue) {
        feedFetchQueue = new Queue('feed-fetch', {
            connection: getRedisConnection(),
            defaultJobOptions: {
                removeOnComplete: 100, // Keep last 100 completed jobs
                removeOnFail: 50,      // Keep last 50 failed jobs
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        });
    }
    return feedFetchQueue;
}

export function getAiAnalysisQueue(): Queue {
    if (!aiAnalysisQueue) {
        aiAnalysisQueue = new Queue('ai-analysis', {
            connection: getRedisConnection(),
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 50,
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 10000,
                },
            },
        });
    }
    return aiAnalysisQueue;
}

// =============================================================================
// Job Types
// =============================================================================

export interface FeedFetchJobData {
    feedId: string;
    feedUrl: string;
}

export interface AIAnalysisJobData {
    articleId: string;
    title: string;
    content: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Schedule a feed to be fetched
 */
export async function scheduleFeedFetch(feedId: string, feedUrl: string, delayMs = 0) {
    return getFeedFetchQueue().add(
        'fetch',
        { feedId, feedUrl } as FeedFetchJobData,
        { delay: delayMs }
    );
}

/**
 * Schedule all feeds for periodic fetching
 */
export async function scheduleAllFeeds(feeds: Array<{ id: string; url: string; fetchFrequency: number }>) {
    const queue = getFeedFetchQueue();
    const jobs = feeds.map((feed, index) => ({
        name: 'fetch',
        data: { feedId: feed.id, feedUrl: feed.url } as FeedFetchJobData,
        opts: {
            delay: index * 1000, // Stagger jobs to prevent overwhelming
            jobId: `feed-${feed.id}`, // Prevent duplicates
        },
    }));

    return queue.addBulk(jobs);
}

/**
 * Schedule AI analysis for an article
 */
export async function scheduleAIAnalysis(articleId: string, title: string, content: string) {
    return getAiAnalysisQueue().add(
        'analyze',
        { articleId, title, content } as AIAnalysisJobData,
        { jobId: `analysis-${articleId}` }
    );
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
    const feedQueue = getFeedFetchQueue();
    const aiQueue = getAiAnalysisQueue();

    const [feedWaiting, feedActive, feedCompleted, feedFailed] = await Promise.all([
        feedQueue.getWaitingCount(),
        feedQueue.getActiveCount(),
        feedQueue.getCompletedCount(),
        feedQueue.getFailedCount(),
    ]);

    const [aiWaiting, aiActive, aiCompleted, aiFailed] = await Promise.all([
        aiQueue.getWaitingCount(),
        aiQueue.getActiveCount(),
        aiQueue.getCompletedCount(),
        aiQueue.getFailedCount(),
    ]);

    return {
        feedFetch: {
            waiting: feedWaiting,
            active: feedActive,
            completed: feedCompleted,
            failed: feedFailed,
        },
        aiAnalysis: {
            waiting: aiWaiting,
            active: aiActive,
            completed: aiCompleted,
            failed: aiFailed,
        },
    };
}

/**
 * Clean up completed/failed jobs
 */
export async function cleanupQueues() {
    const feedQueue = getFeedFetchQueue();
    const aiQueue = getAiAnalysisQueue();

    await Promise.all([
        feedQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'),
        feedQueue.clean(24 * 60 * 60 * 1000, 50, 'failed'),
        aiQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'),
        aiQueue.clean(24 * 60 * 60 * 1000, 50, 'failed'),
    ]);
}
