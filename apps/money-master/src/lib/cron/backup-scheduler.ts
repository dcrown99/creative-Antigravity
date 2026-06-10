import cron, { ScheduledTask } from 'node-cron';
import { createBackup, cleanOldBackups } from '../backup';
import { loadBackupSettings, BackupSettings } from '../backup-settings';

let scheduledTask: ScheduledTask | null = null;
let currentSettings: BackupSettings | null = null;

/**
 * Execute backup job
 */
async function runBackupJob(retentionDays: number): Promise<void> {
    console.log('[BackupScheduler] Running scheduled backup...');
    try {
        const backupPath = await createBackup();
        console.log(`[BackupScheduler] Backup created: ${backupPath}`);

        // Clean up old backups
        const deletedCount = await cleanOldBackups(retentionDays);
        console.log(`[BackupScheduler] Cleaned up ${deletedCount} old backups`);
    } catch (error) {
        console.error('[BackupScheduler] Backup failed:', error);
    }
}

/**
 * Start the automatic backup scheduler
 * Reads settings from backup-settings.json
 */
export async function startBackupScheduler(): Promise<void> {
    // Stop existing scheduler if running
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }

    const settings = await loadBackupSettings();
    currentSettings = settings;

    if (!settings.enabled) {
        console.log('[BackupScheduler] Auto-backup is disabled');
        return;
    }

    // Schedule backup at specified hour every day (Japan Standard Time)
    // Cron format: minute hour * * * (0 9 * * * = 9:00 AM daily)
    const cronExpression = `0 ${settings.scheduleHour} * * *`;

    scheduledTask = cron.schedule(cronExpression, async () => {
        await runBackupJob(settings.retentionDays);
    }, {
        timezone: 'Asia/Tokyo'
    });

    console.log(`[BackupScheduler] Started - will run daily at ${settings.scheduleHour}:00 JST`);
    console.log(`[BackupScheduler] Retention: ${settings.retentionDays} days`);
}

/**
 * Restart the backup scheduler with current settings
 * Call this after settings are updated
 */
export async function restartBackupScheduler(): Promise<void> {
    console.log('[BackupScheduler] Restarting with new settings...');
    await startBackupScheduler();
}

/**
 * Get current scheduler status
 */
export function getSchedulerStatus(): {
    running: boolean;
    settings: BackupSettings | null;
} {
    return {
        running: scheduledTask !== null,
        settings: currentSettings,
    };
}

/**
 * Manually trigger a backup (for testing)
 */
export async function triggerManualBackup(): Promise<string> {
    const settings = await loadBackupSettings();
    await runBackupJob(settings.retentionDays);
    return 'Backup completed';
}
