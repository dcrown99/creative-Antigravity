import { NextRequest, NextResponse } from 'next/server';
import { loadBackupSettings, saveBackupSettings } from '@/lib/backup-settings';
import { restartBackupScheduler, getSchedulerStatus } from '@/lib/cron/backup-scheduler';

export const dynamic = 'force-dynamic';

/**
 * Calculate next run time based on schedule hour (JST)
 */
function calculateNextRun(scheduleHour: number, enabled: boolean): string | null {
    if (!enabled) return null;

    const now = new Date();

    // Get current time in JST
    const jstOffset = 9 * 60; // JST is UTC+9
    const nowUTC = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const nowJST = new Date(nowUTC + jstOffset * 60 * 1000);

    // Create next run date in JST
    const nextRunJST = new Date(nowJST);
    nextRunJST.setHours(scheduleHour, 0, 0, 0);

    // If the scheduled time has passed today (in JST), move to tomorrow
    if (nowJST.getHours() >= scheduleHour) {
        nextRunJST.setDate(nextRunJST.getDate() + 1);
    }

    // Convert JST back to UTC for ISO string
    // nextRunJST is in "fake local time" representing JST
    // We need to subtract 9 hours to get actual UTC
    const nextRunUTC = new Date(nextRunJST.getTime() - jstOffset * 60 * 1000);

    return nextRunUTC.toISOString();
}

/**
 * GET /api/backup-settings - Get current backup settings with scheduler status
 */
export async function GET() {
    try {
        const settings = await loadBackupSettings();
        const schedulerStatus = getSchedulerStatus();
        const nextRun = calculateNextRun(settings.scheduleHour, settings.enabled);

        return NextResponse.json({
            success: true,
            settings,
            scheduler: {
                running: schedulerStatus.running,
                nextRun,
            },
        });
    } catch (error) {
        console.error('Failed to load backup settings:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to load backup settings' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/backup-settings - Update backup settings
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        if (typeof body.enabled !== 'boolean') {
            return NextResponse.json(
                { success: false, error: 'enabled must be a boolean' },
                { status: 400 }
            );
        }
        if (typeof body.scheduleHour !== 'number') {
            return NextResponse.json(
                { success: false, error: 'scheduleHour must be a number' },
                { status: 400 }
            );
        }
        if (typeof body.retentionDays !== 'number') {
            return NextResponse.json(
                { success: false, error: 'retentionDays must be a number' },
                { status: 400 }
            );
        }

        await saveBackupSettings({
            enabled: body.enabled,
            scheduleHour: body.scheduleHour,
            retentionDays: body.retentionDays,
        });

        // Restart scheduler with new settings
        await restartBackupScheduler();

        return NextResponse.json({
            success: true,
            message: 'Backup settings updated successfully',
        });
    } catch (error) {
        console.error('Failed to update backup settings:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update backup settings';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
