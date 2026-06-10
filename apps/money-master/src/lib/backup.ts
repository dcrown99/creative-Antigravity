import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';

const DB_PATH = path.join(process.cwd(), 'data', 'money-master.db');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create backup directory:', error);
        throw error;
    }
}

/**
 * Create a backup of the database
 * @returns Backup file path
 */
export async function createBackup(): Promise<string> {
    await ensureBackupDir();

    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const backupFileName = `backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    try {
        await fs.copyFile(DB_PATH, backupPath);
        console.log(`Backup created: ${backupPath}`);
        return backupPath;
    } catch (error) {
        console.error('Failed to create backup:', error);
        throw error;
    }
}

/**
 * List all backup files
 * @returns Array of backup file info
 */
export async function listBackups(): Promise<Array<{ name: string; size: number; date: Date }>> {
    await ensureBackupDir();

    try {
        const files = await fs.readdir(BACKUP_DIR);
        const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.db'));

        const backupInfo = await Promise.all(
            backupFiles.map(async (fileName) => {
                const filePath = path.join(BACKUP_DIR, fileName);
                const stats = await fs.stat(filePath);
                return {
                    name: fileName,
                    size: stats.size,
                    date: stats.mtime,
                };
            })
        );

        // Sort by date descending (newest first)
        return backupInfo.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
        console.error('Failed to list backups:', error);
        return [];
    }
}

/**
 * Restore database from backup
 * @param backupFileName Backup file name to restore from
 */
export async function restoreBackup(backupFileName: string): Promise<void> {
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // Validate backup file exists
    try {
        await fs.access(backupPath);
    } catch {
        throw new Error(`Backup file not found: ${backupFileName}`);
    }

    // Create pre-restore backup
    const preRestoreTimestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const preRestorePath = path.join(BACKUP_DIR, `pre-restore-${preRestoreTimestamp}.db`);

    try {
        await fs.copyFile(DB_PATH, preRestorePath);
        console.log(`Pre-restore backup created: ${preRestorePath}`);
    } catch (error) {
        console.error('Failed to create pre-restore backup:', error);
        throw error;
    }

    // Restore from backup
    try {
        await fs.copyFile(backupPath, DB_PATH);
        console.log(`Database restored from: ${backupFileName}`);
    } catch (error) {
        console.error('Failed to restore database:', error);
        throw error;
    }
}

/**
 * Delete a backup file
 * @param backupFileName Backup file name to delete
 */
export async function deleteBackup(backupFileName: string): Promise<void> {
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // Validate it's a backup file
    if (!backupFileName.startsWith('backup-') && !backupFileName.startsWith('pre-restore-')) {
        throw new Error('Invalid backup file name');
    }

    try {
        await fs.unlink(backupPath);
        console.log(`Backup deleted: ${backupFileName}`);
    } catch (error) {
        console.error('Failed to delete backup:', error);
        throw error;
    }
}

/**
 * Get the full path to a backup file (for download)
 * @param backupFileName Backup file name
 * @returns Full path to the backup file, or null if invalid/not found
 */
export async function getBackupPath(backupFileName: string): Promise<string | null> {
    // Security: Prevent path traversal
    if (backupFileName.includes('..') || backupFileName.includes('/') || backupFileName.includes('\\')) {
        return null;
    }

    // Validate it's a backup file
    if (!backupFileName.startsWith('backup-') && !backupFileName.startsWith('pre-restore-')) {
        return null;
    }

    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // Check if file exists
    try {
        await fs.access(backupPath);
        return backupPath;
    } catch {
        return null;
    }
}

/**
 * Clean up old backups (older than 30 days)
 */
export async function cleanOldBackups(retentionDays: number = 30): Promise<number> {
    const backups = await listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;

    for (const backup of backups) {
        if (backup.date < cutoffDate && !backup.name.startsWith('pre-restore-')) {
            try {
                await deleteBackup(backup.name);
                deletedCount++;
            } catch (error) {
                console.error(`Failed to delete old backup ${backup.name}:`, error);
            }
        }
    }

    console.log(`Cleaned up ${deletedCount} old backups`);
    return deletedCount;
}
