/**
 * Article type - unified across the application
 * Matches the API response from /api/articles
 */
export interface Article {
    id: string;
    feedId: string;
    link: string;
    title: string;
    content?: string;
    contentSnippet?: string;
    thumbnail?: string; // サムネイル画像URL
    author?: string;
    pubDate?: string;
    isoDate?: string;
    isRead: boolean;
    isStarred: boolean;
    readAt?: string;
    createdAt?: string;

    // AI Enrichment
    ai?: {
        summary: string;
        priority: 'High' | 'Medium' | 'Low';
        topics: string[];
        sentiment: 'Positive' | 'Negative' | 'Neutral';
    } | null;
}

export interface FeedResponse {
    title?: string;
    description?: string;
    link?: string;
    items: Article[];
}
