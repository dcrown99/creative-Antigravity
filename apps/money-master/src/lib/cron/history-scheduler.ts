import cron, { ScheduledTask } from 'node-cron';

let scheduledTask: ScheduledTask | null = null;

// Internal API URL for history recording (runs within Next.js request context)
const HISTORY_RECORD_API_URL = 'http://localhost:3000/api/cron/record-history';

/**
 * Execute daily history recording by calling internal API
 * This ensures the recording runs within a proper Next.js request context
 */
async function runHistoryRecordJob(): Promise<void> {
    console.log('[HistoryScheduler] Running scheduled daily history recording via API...');
    try {
        const response = await fetch(HISTORY_RECORD_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API returned ${response.status}`);
        }

        const result = await response.json();
        console.log(`[HistoryScheduler] Daily history recorded: ${result.message}`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[HistoryScheduler] Daily history recording failed:', errorMessage);
    }
}

/**
 * Start the daily history recording scheduler
 * Records portfolio snapshot at 23:50 JST daily
 */
export async function startHistoryScheduler(): Promise<void> {
    // Stop existing scheduler if running
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }

    // Schedule at 23:50 JST daily - end of day snapshot
    const cronExpression = '50 23 * * *';

    scheduledTask = cron.schedule(cronExpression, async () => {
        await runHistoryRecordJob();
    }, {
        timezone: 'Asia/Tokyo'
    });

    console.log('[HistoryScheduler] Started - will run daily at 23:50 JST');
}

/**
 * Restart the history scheduler
 */
export async function restartHistoryScheduler(): Promise<void> {
    console.log('[HistoryScheduler] Restarting...');
    await startHistoryScheduler();
}

/**
 * Get current scheduler status
 */
export function getHistorySchedulerStatus(): { running: boolean } {
    return {
        running: scheduledTask !== null,
    };
}
