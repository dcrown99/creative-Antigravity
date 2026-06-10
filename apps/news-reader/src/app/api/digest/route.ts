import { NextResponse } from 'next/server';
import { db, articles, articleAnalysis, feeds } from '@/lib/db';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_NEWS_API_KEY || '');

/**
 * GET /api/digest - Get AI-generated daily digest
 */
export async function GET() {
    try {
        // Get articles from last 24 hours with AI analysis
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentArticles = await db
            .select({
                id: articles.id,
                title: articles.title,
                contentSnippet: articles.contentSnippet,
                feedId: articles.feedId,
                pubDate: articles.pubDate,
                isoDate: articles.isoDate,
                aiPriority: articleAnalysis.priority,
                aiSummary: articleAnalysis.summary,
                aiTopics: articleAnalysis.topics,
            })
            .from(articles)
            .leftJoin(articleAnalysis, eq(articles.id, articleAnalysis.articleId))
            .where(gte(articles.createdAt, oneDayAgo))
            .orderBy(desc(articles.pubDate))
            .limit(50);

        if (recentArticles.length === 0) {
            return NextResponse.json({
                digest: null,
                message: '過去24時間に新着記事がありません',
                articleCount: 0,
            });
        }

        // Get high priority articles
        const highPriority = recentArticles.filter(a => a.aiPriority === 'High');
        const mediumPriority = recentArticles.filter(a => a.aiPriority === 'Medium');

        // Extract topics
        const allTopics: string[] = [];
        recentArticles.forEach(a => {
            if (a.aiTopics && Array.isArray(a.aiTopics)) {
                allTopics.push(...a.aiTopics);
            }
        });

        // Count topic frequency
        const topicCounts = allTopics.reduce((acc, topic) => {
            acc[topic] = (acc[topic] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const trendingTopics = Object.entries(topicCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([topic]) => topic);

        // Generate AI digest summary if we have enough content
        let digestSummary = '';

        if (process.env.GEMINI_NEWS_API_KEY && highPriority.length > 0) {
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

                const articlesForDigest = [...highPriority, ...mediumPriority.slice(0, 5)]
                    .map(a => `- ${a.title}: ${a.aiSummary || a.contentSnippet?.substring(0, 200) || ''}`)
                    .join('\n');

                const prompt = `以下のニュース記事を元に、今日の重要ニュースを3文でまとめてください。
日本語で回答してください。

記事一覧:
${articlesForDigest}

重要ポイントを簡潔にまとめてください。`;

                const result = await model.generateContent(prompt);
                digestSummary = result.response.text();
            } catch (error) {
                console.error('Digest AI error:', error);
                // Fallback to simple summary
                digestSummary = highPriority.length > 0
                    ? `本日は${highPriority.length}件の重要ニュースがあります。`
                    : '本日の重要ニュースはありません。';
            }
        } else {
            digestSummary = highPriority.length > 0
                ? `本日は${highPriority.length}件の重要ニュースと${mediumPriority.length}件の注目ニュースがあります。`
                : `本日は${recentArticles.length}件の新着記事があります。`;
        }

        return NextResponse.json({
            digest: {
                summary: digestSummary,
                trendingTopics,
                stats: {
                    total: recentArticles.length,
                    high: highPriority.length,
                    medium: mediumPriority.length,
                },
                highlights: highPriority.slice(0, 5).map(a => ({
                    id: a.id,
                    title: a.title,
                    summary: a.aiSummary,
                })),
            },
            generatedAt: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Digest error:', error);
        return NextResponse.json({ error: 'Failed to generate digest' }, { status: 500 });
    }
}
