import { NextResponse } from 'next/server';
import { db, feeds, folders } from '@/lib/db';
import { eq } from 'drizzle-orm';
import * as cheerio from 'cheerio';

/**
 * GET /api/opml - Export feeds as OPML
 */
export async function GET() {
    try {
        const allFolders = await db.select().from(folders).orderBy(folders.order);
        const allFeeds = await db.select().from(feeds).orderBy(feeds.title);

        // Build OPML XML
        let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>News Reader Export</title>
        <dateCreated>${new Date().toISOString()}</dateCreated>
    </head>
    <body>
`;

        // Group feeds by folder
        const feedsByFolder = new Map<string | null, typeof allFeeds>();
        allFeeds.forEach(feed => {
            const folderId = feed.folderId;
            const existing = feedsByFolder.get(folderId) || [];
            feedsByFolder.set(folderId, [...existing, feed]);
        });

        // Output folders with their feeds
        for (const folder of allFolders) {
            const folderFeeds = feedsByFolder.get(folder.id) || [];
            if (folderFeeds.length > 0) {
                opml += `        <outline text="${escapeXml(folder.name)}" title="${escapeXml(folder.name)}">\n`;
                for (const feed of folderFeeds) {
                    opml += `            <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" />\n`;
                }
                opml += `        </outline>\n`;
            }
        }

        // Output uncategorized feeds
        const uncategorizedFeeds = feedsByFolder.get(null) || [];
        for (const feed of uncategorizedFeeds) {
            opml += `        <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" />\n`;
        }

        opml += `    </body>
</opml>`;

        return new NextResponse(opml, {
            headers: {
                'Content-Type': 'application/xml',
                'Content-Disposition': 'attachment; filename="news-reader-export.opml"',
            },
        });
    } catch (error) {
        console.error('OPML export error:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}

/**
 * POST /api/opml - Import feeds from OPML
 */

// ... (existing imports)

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const content = await file.text();
        const $ = cheerio.load(content, { xmlMode: true });

        const imported = {
            folders: 0,
            feeds: 0,
            skipped: 0,
        };

        // Parse outlines
        const outlines = $('body > outline');

        for (const outline of outlines) {
            const $outline = $(outline);
            const xmlUrl = $outline.attr('xmlUrl');

            if (xmlUrl) {
                // Direct feed (no folder)
                await importFeed($outline, null, imported);
            } else {
                // This is a folder
                const folderName = $outline.attr('text') || $outline.attr('title') || 'Imported';
                const folderId = crypto.randomUUID();

                // Create folder
                await db.insert(folders).values({
                    id: folderId,
                    name: folderName,
                    order: 0,
                    createdAt: new Date(),
                }).onConflictDoNothing();
                imported.folders++;

                // Import feeds in folder
                const childOutlines = $outline.find('outline');
                for (const child of childOutlines) {
                    await importFeed($(child), folderId, imported);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Imported ${imported.feeds} feeds in ${imported.folders} folders (${imported.skipped} skipped)`,
            ...imported,
        });

    } catch (error: any) {
        console.error('OPML import error:', error);
        return NextResponse.json({
            error: `Import failed: ${error.message || 'Unknown error'}`
        }, { status: 500 });
    }
}

async function importFeed(
    $outline: cheerio.Cheerio<any>,
    folderId: string | null,
    stats: { feeds: number; skipped: number }
) {
    const xmlUrl = $outline.attr('xmlUrl');
    if (!xmlUrl) return;

    const title = $outline.attr('text') || $outline.attr('title') || xmlUrl;

    try {
        await db.insert(feeds).values({
            id: crypto.randomUUID(),
            url: xmlUrl,
            title: title,
            folderId: folderId,
            createdAt: new Date(),
        }).onConflictDoNothing();
        stats.feeds++;
    } catch (e) {
        console.warn(`Skipping feed ${xmlUrl}:`, e);
        stats.skipped++;
    }
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
