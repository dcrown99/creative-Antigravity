import { parseRSS } from '../lib/rss-parser';

// Mock rss-parser
jest.mock('rss-parser', () => {
    return jest.fn().mockImplementation(() => {
        return {
            parseURL: jest.fn().mockResolvedValue({
                title: 'Mock Feed',
                description: 'Test Description',
                items: [
                    {
                        title: 'Test Article 1',
                        link: 'https://example.com/1',
                        contentSnippet: 'Summary 1',
                    },
                ],
            }),
        };
    });
});

describe('RSS Parser', () => {
    it('should parse valid RSS feed', async () => {
        const feed = await parseRSS('https://example.com/rss');
        expect(feed).not.toBeNull();
        expect(feed?.title).toBe('Mock Feed');
        expect(feed?.items).toHaveLength(1);
        expect(feed?.items[0].title).toBe('Test Article 1');
    });

    it('should handle errors gracefully (mocking error case)', async () => {
        // Reset mock to throw error
        const Parser = require('rss-parser');
        Parser.mockImplementationOnce(() => ({
            parseURL: jest.fn().mockRejectedValue(new Error('Network Error')),
        }));

        const feed = await parseRSS('https://example.com/error');
        expect(feed).toBeNull();
    });
});
