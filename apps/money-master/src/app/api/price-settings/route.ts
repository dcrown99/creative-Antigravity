import { NextRequest, NextResponse } from 'next/server';
import { loadPriceSettings, savePriceSettings, PriceUpdateSettings } from '@/lib/price-settings';
import { restartPriceScheduler, getPriceSchedulerStatus, triggerManualPriceUpdate } from '@/lib/cron/price-scheduler';

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
    const nextRunUTC = new Date(nextRunJST.getTime() - jstOffset * 60 * 1000);

    return nextRunUTC.toISOString();
}

/**
 * GET /api/price-settings - Get current price update settings with scheduler status
 */
export async function GET() {
    try {
        const settings = await loadPriceSettings();
        const schedulerStatus = getPriceSchedulerStatus();
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
        console.error('Failed to load price settings:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to load price settings' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/price-settings - Update price update settings
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

        const currentSettings = await loadPriceSettings();
        const newSettings: PriceUpdateSettings = {
            enabled: body.enabled,
            scheduleHour: body.scheduleHour,
            lastUpdatedAt: currentSettings.lastUpdatedAt,
            lastError: currentSettings.lastError,
        };

        await savePriceSettings(newSettings);

        // Restart scheduler with new settings
        await restartPriceScheduler();

        return NextResponse.json({
            success: true,
            message: 'Price settings updated successfully',
        });
    } catch (error) {
        console.error('Failed to update price settings:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update price settings';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}

/**
 * POST /api/price-settings - Trigger manual price update
 */
export async function POST() {
    try {
        await triggerManualPriceUpdate();
        const settings = await loadPriceSettings();

        return NextResponse.json({
            success: true,
            message: 'Price update completed',
            lastUpdatedAt: settings.lastUpdatedAt,
            lastError: settings.lastError,
        });
    } catch (error) {
        console.error('Failed to trigger price update:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to trigger price update';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
