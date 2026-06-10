import fs from 'fs/promises';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'backup-settings.json');

/**
 * Backup settings configuration
 */
export interface BackupSettings {
    /** Whether auto-backup is enabled */
    enabled: boolean;
    /** Hour of day to run backup (0-23) */
    scheduleHour: number;
    /** Number of days to retain backups */
    retentionDays: number;
}

/**
 * Default backup settings
 */
export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
    enabled: true,
    scheduleHour: 9,
    retentionDays: 30,
};

/**
 * Load backup settings from file
 * @returns Current backup settings (or defaults if file doesn't exist)
 */
export async function loadBackupSettings(): Promise<BackupSettings> {
    try {
        const content = await fs.readFile(SETTINGS_PATH, 'utf-8');
        const settings = JSON.parse(content) as Partial<BackupSettings>;

        // Merge with defaults to ensure all fields exist
        return {
            ...DEFAULT_BACKUP_SETTINGS,
            ...settings,
        };
    } catch (error) {
        // File doesn't exist or is invalid, return defaults
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.log('[BackupSettings] No settings file found, using defaults');
        } else {
            console.error('[BackupSettings] Failed to load settings:', error);
        }
        return { ...DEFAULT_BACKUP_SETTINGS };
    }
}

/**
 * Save backup settings to file
 * @param settings Settings to save
 */
export async function saveBackupSettings(settings: BackupSettings): Promise<void> {
    // Validate settings
    if (settings.scheduleHour < 0 || settings.scheduleHour > 23) {
        throw new Error('scheduleHour must be between 0 and 23');
    }
    if (settings.retentionDays < 1 || settings.retentionDays > 365) {
        throw new Error('retentionDays must be between 1 and 365');
    }

    try {
        // Ensure data directory exists
        await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });

        await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
        console.log('[BackupSettings] Settings saved:', settings);
    } catch (error) {
        console.error('[BackupSettings] Failed to save settings:', error);
        throw error;
    }
}
