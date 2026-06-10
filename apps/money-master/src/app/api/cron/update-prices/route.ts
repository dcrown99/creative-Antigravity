import { NextResponse } from 'next/server';
import * as AssetService from '@/services/asset.service';
import { updateLastPriceUpdate } from '@/lib/price-settings';

/**
 * Internal API endpoint for scheduled price updates.
 * Called by the price-scheduler cron job to execute price updates
 * within a proper Next.js request context (required for revalidateTag).
 */
export async function POST() {
    console.log('[CronAPI] Received price update request');

    try {
        const result = await AssetService.updateAllAssetPrices();
        console.log(`[CronAPI] Price update completed: ${result.updated}/${result.updated + result.failed} assets updated`);

        // Update settings with success timestamp
        await updateLastPriceUpdate();

        return NextResponse.json({
            success: true,
            updated: result.updated,
            failed: result.failed,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[CronAPI] Price update failed:', error);

        // Update settings with error
        await updateLastPriceUpdate(errorMessage);

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
