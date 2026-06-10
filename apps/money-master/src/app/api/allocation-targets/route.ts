import { NextRequest, NextResponse } from 'next/server';
import { getAllocationTargets, saveAllocationTargets, getDefaultTargets } from '@/services/allocation.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/allocation-targets - Get current allocation targets
 */
export async function GET() {
    try {
        const targets = await getAllocationTargets();
        const defaults = getDefaultTargets();

        return NextResponse.json({
            success: true,
            targets,
            defaults,
        });
    } catch (error) {
        console.error('Failed to load allocation targets:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to load allocation targets' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/allocation-targets - Save allocation targets
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate: body.targets should be an object with string keys and number values
        if (!body.targets || typeof body.targets !== 'object') {
            return NextResponse.json(
                { success: false, error: 'targets must be an object' },
                { status: 400 }
            );
        }

        // Validate each target
        for (const [key, value] of Object.entries(body.targets)) {
            if (typeof value !== 'number' || value < 0 || value > 100) {
                return NextResponse.json(
                    { success: false, error: `Invalid value for ${key}: must be a number between 0 and 100` },
                    { status: 400 }
                );
            }
        }

        await saveAllocationTargets(body.targets);

        return NextResponse.json({
            success: true,
            message: 'Allocation targets saved successfully',
        });
    } catch (error) {
        console.error('Failed to save allocation targets:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save allocation targets';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
