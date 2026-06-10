
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('[Instrumentation] Registering hooks...');
        try {
            // Initialize dividend sync scheduler
            const { initScheduler } = await import('@/lib/scheduler');
            initScheduler();

            // Initialize price update scheduler
            const { startPriceScheduler } = await import('@/lib/cron/price-scheduler');
            await startPriceScheduler();
            console.log('[Instrumentation] Price scheduler initialized');

            // Initialize backup scheduler
            const { startBackupScheduler } = await import('@/lib/cron/backup-scheduler');
            await startBackupScheduler();
            console.log('[Instrumentation] Backup scheduler initialized');

            // Initialize daily history scheduler
            const { startHistoryScheduler } = await import('@/lib/cron/history-scheduler');
            await startHistoryScheduler();
            console.log('[Instrumentation] History scheduler initialized');
        } catch (e) {
            console.error('[Instrumentation] Failed to init scheduler:', e);
        }
    }
}
