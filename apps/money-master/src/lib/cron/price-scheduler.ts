import cron, { ScheduledTask } from 'node-cron';
import { loadPriceSettings, PriceUpdateSettings } from '../price-settings';

let scheduledTask: ScheduledTask | null = null;
let currentSettings: PriceUpdateSettings | null = null;

// Internal API URL for price updates (runs within Next.js request context)
const PRICE_UPDATE_API_URL = 'http://localhost:3000/api/cron/update-prices';

/**
 * Execute price update job by calling internal API
 * This ensures the update runs within a proper Next.js request context
 */
async function runPriceUpdateJob(): Promise<void> {
    console.log('[PriceScheduler] Running scheduled price update via API...');
    try {
        const response = await fetch(PRICE_UPDATE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API returned ${response.status}`);
        }

        const result = await response.json();
        console.log(`[PriceScheduler] Price update completed: ${result.updated}/${result.updated + result.failed} assets updated`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[PriceScheduler] Price update failed:', errorMessage);
    }
}


/**
 * Start the automatic price update scheduler
 * Reads settings from price-settings.json
 */
export async function startPriceScheduler(): Promise<void> {
    // Stop existing scheduler if running
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }

    const settings = await loadPriceSettings();
    currentSettings = settings;

    if (!settings.enabled) {
        console.log('[PriceScheduler] Auto price update is disabled');
        return;
    }

    // Schedule price update at specified hour every day (Japan Standard Time)
    // Cron format: minute hour * * * (0 19 * * * = 19:00 daily)
    const cronExpression = `0 ${settings.scheduleHour} * * *`;

    scheduledTask = cron.schedule(cronExpression, async () => {
        await runPriceUpdateJob();
    }, {
        timezone: 'Asia/Tokyo'
    });

    console.log(`[PriceScheduler] Started - will run daily at ${settings.scheduleHour}:00 JST`);
}

/**
 * Restart the price scheduler with current settings
 * Call this after settings are updated
 */
export async function restartPriceScheduler(): Promise<void> {
    console.log('[PriceScheduler] Restarting with new settings...');
    await startPriceScheduler();
}

/**
 * Get current scheduler status
 */
export function getPriceSchedulerStatus(): {
    running: boolean;
    settings: PriceUpdateSettings | null;
} {
    return {
        running: scheduledTask !== null,
        settings: currentSettings,
    };
}

/**
 * Manually trigger a price update (for testing or manual refresh)
 */
export async function triggerManualPriceUpdate(): Promise<string> {
    await runPriceUpdateJob();
    return 'Price update completed';
}
