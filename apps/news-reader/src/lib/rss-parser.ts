import Parser from 'rss-parser';

export type FeedItem = {
    title: string;
    link: string;
    pubDate?: string;
    content?: string;
    contentSnippet?: string;
    guid?: string;
    isoDate?: string;
    thumbnail?: string; // サムネイル画像URL
    enclosure?: { url?: string; type?: string };
    media?: { $?: { url?: string; medium?: string } };
};

export type ParsedFeed = {
    title?: string;
    description?: string;
    link?: string;
    items: FeedItem[];
};

import * as cheerio from 'cheerio';

// Helper to find RSS URL from HTML
const findFeedUrl = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        // Try common feed link types
        const feedUrl = $('link[type="application/rss+xml"]').attr('href') ||
            $('link[type="application/atom+xml"]').attr('href') ||
            $('link[type="application/json"]').attr('href');

        if (feedUrl) {
            // Handle relative URLs
            return new URL(feedUrl, url).toString();
        }
        return null;
    } catch (e) {
        console.warn(`Failed to discover feed from ${url}`, e);
        return null;
    }
};

export const parseRSS = async (url: string): Promise<ParsedFeed | null> => {
    try {
        const parser = new Parser({
            customFields: {
                item: [
                    ['media:content', 'media'],
                    ['enclosure', 'enclosure'],
                ],
            },
        });

        // Try parsing directly
        try {
            const feed = await parser.parseURL(url);
            // Extract thumbnails from media:content or enclosure
            const itemsWithThumbnails = (feed.items || []).map((item: any) => {
                let thumbnail = item.thumbnail;

                // Try enclosure first (common for podcasts/images)
                if (!thumbnail && item.enclosure?.url && item.enclosure.type?.startsWith('image')) {
                    thumbnail = item.enclosure.url;
                }

                // Try media:content
                if (!thumbnail && item.media?.$?.url) {
                    thumbnail = item.media.$.url;
                }

                // Try to extract first image from content
                if (!thumbnail && item.content) {
                    const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (imgMatch) {
                        thumbnail = imgMatch[1];
                    }
                }

                return { ...item, thumbnail };
            });

            return { ...feed, items: itemsWithThumbnails } as ParsedFeed;
        } catch (e) {
            // If direct parsing fails, try discovery
            console.log(`Direct parse failed for ${url}, trying discovery...`);
            const discoveredUrl = await findFeedUrl(url);

            if (discoveredUrl && discoveredUrl !== url) {
                console.log(`Discovered feed URL: ${discoveredUrl}`);
                const feed = await parser.parseURL(discoveredUrl);
                return feed as ParsedFeed;
            }
            throw e;
        }
    } catch (error) {
        console.error(`Error parsing RSS feed from ${url}:`, error);
        return null;
    }
};
