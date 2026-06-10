import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { getBackupPath } from '@/lib/backup';

export const dynamic = 'force-dynamic';

/**
 * GET /api/backup/download?file=xxx - Download a backup file
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get('file');

    if (!fileName) {
        return NextResponse.json(
            { success: false, error: 'Backup file name is required' },
            { status: 400 }
        );
    }

    try {
        // Get validated backup path (includes security checks)
        const backupPath = await getBackupPath(fileName);

        if (!backupPath) {
            return NextResponse.json(
                { success: false, error: 'Backup file not found or invalid' },
                { status: 404 }
            );
        }

        // Read file contents
        const fileBuffer = await fs.readFile(backupPath);

        // Return file as download
        return new Response(fileBuffer, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': fileBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('Failed to download backup:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to download backup' },
            { status: 500 }
        );
    }
}
