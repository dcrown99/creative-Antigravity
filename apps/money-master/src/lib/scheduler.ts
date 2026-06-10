
import cron, { ScheduledTask } from 'node-cron';
import { syncAllDividends } from '@/services/dividend-sync.service';

/**
 * Singleton Scheduler to prevent duplicate jobs in HMR/Dev
 */
class Scheduler {
    private static instance: Scheduler;
    private jobs: ScheduledTask[] = [];

    private constructor() { }

    public static getInstance(): Scheduler {
        if (!Scheduler.instance) {
            Scheduler.instance = new Scheduler();
        }
        return Scheduler.instance;
    }

    public init() {
        if (this.jobs.length > 0) {
            console.log('[Scheduler] Already initialized.');
            return; // Already running
        }

        console.log('[Scheduler] Initializing Dividend Sync Job (Monday 09:00)');

        // Schedule: Every Monday at 09:00
        const job = cron.schedule('0 9 * * 1', async () => {
            console.log('[Scheduler] Triggering Scheduled Dividend Sync...');
            await syncAllDividends();
        }, {
            timezone: "Asia/Tokyo"
        });

        this.jobs.push(job);

        // Optional: Run once on startup for verification? 
        // Better not to spam API, but useful for first deployment.
        // setTimeout(() => syncAllDividends(), 10000); 
    }
}

export const initScheduler = () => {
    // Ensure this only runs in Node environment (not Edge/Browser)
    if (process.env.NEXT_RUNTIME === 'nodejs' || typeof process !== 'undefined') {
        const scheduler = Scheduler.getInstance();
        scheduler.init();
    }
};
