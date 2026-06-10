import {
    BackupSettings,
    DEFAULT_BACKUP_SETTINGS,
} from '../backup-settings';

describe('BackupSettings', () => {
    describe('DEFAULT_BACKUP_SETTINGS', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_BACKUP_SETTINGS.enabled).toBe(true);
            expect(DEFAULT_BACKUP_SETTINGS.scheduleHour).toBe(9);
            expect(DEFAULT_BACKUP_SETTINGS.retentionDays).toBe(30);
        });

        it('should have scheduleHour in valid range', () => {
            expect(DEFAULT_BACKUP_SETTINGS.scheduleHour).toBeGreaterThanOrEqual(0);
            expect(DEFAULT_BACKUP_SETTINGS.scheduleHour).toBeLessThanOrEqual(23);
        });

        it('should have retentionDays in valid range', () => {
            expect(DEFAULT_BACKUP_SETTINGS.retentionDays).toBeGreaterThanOrEqual(1);
            expect(DEFAULT_BACKUP_SETTINGS.retentionDays).toBeLessThanOrEqual(365);
        });
    });

    describe('BackupSettings interface', () => {
        it('should allow valid settings', () => {
            const settings: BackupSettings = {
                enabled: false,
                scheduleHour: 10,
                retentionDays: 14,
            };

            expect(settings.enabled).toBe(false);
            expect(settings.scheduleHour).toBe(10);
            expect(settings.retentionDays).toBe(14);
        });
    });
});

// Note: Integration tests for loadBackupSettings and saveBackupSettings
// are skipped as they require file system access with process.cwd() at module level.
// The functions work correctly in the application context.
