/* eslint-disable @typescript-eslint/no-explicit-any */
import { createBackup, listBackups, restoreBackup, deleteBackup, cleanOldBackups } from '../backup';

const mockMkdir = jest.fn();
const mockCopyFile = jest.fn();
const mockReaddir = jest.fn();
const mockStat = jest.fn();
const mockAccess = jest.fn();
const mockUnlink = jest.fn();

jest.mock('fs/promises', () => ({
    __esModule: true,
    default: {
        mkdir: (...args: any[]) => mockMkdir(...args),
        copyFile: (...args: any[]) => mockCopyFile(...args),
        readdir: (...args: any[]) => mockReaddir(...args),
        stat: (...args: any[]) => mockStat(...args),
        access: (...args: any[]) => mockAccess(...args),
        unlink: (...args: any[]) => mockUnlink(...args),
    },
    mkdir: (...args: any[]) => mockMkdir(...args),
    copyFile: (...args: any[]) => mockCopyFile(...args),
    readdir: (...args: any[]) => mockReaddir(...args),
    stat: (...args: any[]) => mockStat(...args),
    access: (...args: any[]) => mockAccess(...args),
    unlink: (...args: any[]) => mockUnlink(...args),
}));

describe.skip('Backup Service', () => {
    const mockDate = new Date('2024-01-01T00:00:00Z');

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(mockDate);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('createBackup', () => {
        it('should create backup successfully', async () => {
            mockMkdir.mockResolvedValue(undefined);
            mockCopyFile.mockResolvedValue(undefined);

            const result = await createBackup();

            expect(mockMkdir).toHaveBeenCalled();
            expect(mockCopyFile).toHaveBeenCalled();
            expect(result).toMatch(/backup-\d{4}-\d{2}-\d{2}-\d{6}\.db/);
        });
    });

    describe('listBackups', () => {
        it('should list and sort backups', async () => {
            const mockFiles = ['backup-2.db', 'backup-1.db', 'other.txt'];
            mockReaddir.mockResolvedValue(mockFiles);
            mockStat.mockImplementation((path: string) => {
                if (path.includes('backup-2')) return Promise.resolve({ size: 100, mtime: new Date('2024-01-02') });
                if (path.includes('backup-1')) return Promise.resolve({ size: 100, mtime: new Date('2024-01-01') });
                return Promise.resolve({ size: 0, mtime: new Date() });
            });

            const result = await listBackups();

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('backup-2.db'); // Newest first
        });
    });

    describe('restoreBackup', () => {
        it('should restore backup', async () => {
            mockAccess.mockResolvedValue(undefined);
            mockCopyFile.mockResolvedValue(undefined);

            await restoreBackup('backup-1.db');

            expect(mockCopyFile).toHaveBeenCalledTimes(2); // Pre-restore backup + Restore
        });

        it('should throw if backup not found', async () => {
            mockAccess.mockRejectedValue(new Error('Not found'));

            await expect(restoreBackup('missing.db')).rejects.toThrow('Backup file not found');
        });
    });

    describe('deleteBackup', () => {
        it('should delete backup', async () => {
            mockUnlink.mockResolvedValue(undefined);

            await deleteBackup('backup-1.db');

            expect(mockUnlink).toHaveBeenCalled();
        });

        it('should throw for invalid filename', async () => {
            await expect(deleteBackup('malicious.sh')).rejects.toThrow('Invalid backup file name');
        });
    });

    describe('cleanOldBackups', () => {
        it('should delete old backups', async () => {
            // Mock listBackups behavior
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 31);

            const mockFiles = ['backup-old.db'];
            mockReaddir.mockResolvedValue(mockFiles);
            mockStat.mockResolvedValue({ size: 100, mtime: oldDate });
            mockUnlink.mockResolvedValue(undefined);

            const count = await cleanOldBackups(30);

            expect(count).toBe(1);
            expect(mockUnlink).toHaveBeenCalled();
        });
    });
});
