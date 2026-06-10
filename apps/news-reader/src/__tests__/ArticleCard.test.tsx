import React from 'react';
import { render, screen } from '@testing-library/react';
import { ArticleCard } from '../components/ArticleCard';
import { Article } from '../types/article';
import '@testing-library/jest-dom';

const mockArticle: Article = {
    id: 'test-1',
    feedId: 'feed-1',
    title: 'Test AI Article',
    link: 'https://example.com/ai',
    contentSnippet: 'This is a test snippet.',
    isRead: false,
    isStarred: false,
    ai: {
        summary: 'AI Generated Summary',
        priority: 'High',
        topics: ['AI', 'Tech'],
        sentiment: 'Positive',
    },
};

describe('ArticleCard', () => {
    it('renders article title and AI badge', () => {
        render(<ArticleCard article={mockArticle} />);

        expect(screen.getByText('Test AI Article')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByText('AI Generated Summary')).toBeInTheDocument();
    });

    it('renders fallback when no AI data', () => {
        const plainArticle: Article = {
            id: 'test-2',
            feedId: 'feed-1',
            title: 'Plain Article',
            link: 'https://example.com/plain',
            contentSnippet: 'Plain content.',
            isRead: false,
            isStarred: false,
        };
        render(<ArticleCard article={plainArticle} />);

        expect(screen.getByText('Plain Article')).toBeInTheDocument();
        expect(screen.queryByText('High')).not.toBeInTheDocument();
        expect(screen.getByText('Plain content.')).toBeInTheDocument();
    });
});
