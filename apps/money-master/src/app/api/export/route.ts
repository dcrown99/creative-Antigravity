import { NextResponse } from 'next/server';
import { exportAssets } from '@/services/export.service';

/**
 * GET /api/export - Export all assets as Markdown
 */
export async function GET() {
    try {
        const markdown = await exportAssets();
        const today = new Date().toISOString().split('T')[0];
        const fileName = `assets_${today}.md`;

        return new Response(markdown, {
            headers: {
                'Content-Type': 'text/markdown; charset=utf-8',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        console.error('Failed to export assets:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to export assets' },
            { status: 500 }
        );
    }
}
