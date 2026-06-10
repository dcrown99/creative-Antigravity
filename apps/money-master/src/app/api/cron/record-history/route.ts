import { NextResponse } from 'next/server';
import * as AnalyticsService from '@/services/analytics.service';

/**
 * POST /api/cron/record-history
 * Called by the history-scheduler cron job to record daily portfolio history.
 * Can also be called manually for testing.
 */
export async function POST() {
    try {
        await AnalyticsService.recordDailyHistory();
        return NextResponse.json({
            success: true,
            message: 'Daily history recorded successfully',
            date: new Date().toISOString().split('T')[0],
        });
    } catch (error) {
        console.error('[API] Failed to record daily history:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to record daily history' },
            { status: 500 }
        );
    }
}
