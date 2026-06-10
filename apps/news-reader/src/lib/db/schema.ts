import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// Core Tables
// =============================================================================

/**
 * Folders for organizing feeds
 */
export const folders = sqliteTable('folders', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    order: integer('order').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * RSS Feed subscriptions
 */
export const feeds = sqliteTable('feeds', {
    id: text('id').primaryKey(),
    url: text('url').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    favicon: text('favicon'),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }),
    fetchFrequency: integer('fetch_frequency').default(15), // minutes
    errorCount: integer('error_count').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * Articles from RSS feeds
 */
export const articles = sqliteTable('articles', {
    id: text('id').primaryKey(),
    feedId: text('feed_id').notNull().references(() => feeds.id, { onDelete: 'cascade' }),
    link: text('link').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    contentSnippet: text('content_snippet'),
    thumbnail: text('thumbnail'), // サムネイル画像URL
    author: text('author'),
    pubDate: integer('pub_date', { mode: 'timestamp' }),
    isoDate: text('iso_date'),

    // User state
    isRead: integer('is_read', { mode: 'boolean' }).default(false),
    isStarred: integer('is_starred', { mode: 'boolean' }).default(false),
    readAt: integer('read_at', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * AI analysis results for articles
 */
export const articleAnalysis = sqliteTable('article_analysis', {
    id: text('id').primaryKey(),
    articleId: text('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
    summary: text('summary'),
    priority: text('priority').$type<'High' | 'Medium' | 'Low'>(),
    topics: text('topics', { mode: 'json' }).$type<string[]>(),
    sentiment: text('sentiment').$type<'Positive' | 'Negative' | 'Neutral'>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// =============================================================================
// Tags & Rules (Phase 6)
// =============================================================================

/**
 * Tags for organizing articles
 */
export const tags = sqliteTable('tags', {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    color: text('color').default('#6366f1'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * Many-to-many relationship between articles and tags
 */
export const articleTags = sqliteTable('article_tags', {
    articleId: text('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
    tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});

/**
 * Automation rules for filtering/tagging
 */
export const rules = sqliteTable('rules', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    conditions: text('conditions', { mode: 'json' }).$type<RuleCondition[]>(),
    actions: text('actions', { mode: 'json' }).$type<RuleAction[]>(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// =============================================================================
// User Preferences
// =============================================================================

export const userPreferences = sqliteTable('user_preferences', {
    id: text('id').primaryKey().default('default'),
    viewMode: text('view_mode').$type<'list' | 'card' | 'magazine'>().default('list'),
    theme: text('theme').$type<'light' | 'dark' | 'system'>().default('system'),
    defaultFilter: text('default_filter').$type<'all' | 'unread' | 'starred'>().default('unread'),
    articlesPerPage: integer('articles_per_page').default(50),
    autoMarkAsRead: integer('auto_mark_as_read', { mode: 'boolean' }).default(true),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// =============================================================================
// Relations
// =============================================================================

export const foldersRelations = relations(folders, ({ many }) => ({
    feeds: many(feeds),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
    folder: one(folders, { fields: [feeds.folderId], references: [folders.id] }),
    articles: many(articles),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
    feed: one(feeds, { fields: [articles.feedId], references: [feeds.id] }),
    analysis: one(articleAnalysis),
    tags: many(articleTags),
}));

export const articleAnalysisRelations = relations(articleAnalysis, ({ one }) => ({
    article: one(articles, { fields: [articleAnalysis.articleId], references: [articles.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
    articles: many(articleTags),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
    article: one(articles, { fields: [articleTags.articleId], references: [articles.id] }),
    tag: one(tags, { fields: [articleTags.tagId], references: [tags.id] }),
}));

// =============================================================================
// Types
// =============================================================================

export type RuleCondition = {
    field: 'title' | 'content' | 'author' | 'feedUrl';
    operator: 'contains' | 'notContains' | 'equals' | 'startsWith';
    value: string;
};

export type RuleAction = {
    type: 'markRead' | 'star' | 'addTag' | 'moveToFolder';
    value?: string; // tagId or folderId for relevant actions
};

// Inferred types from schema
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;

export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;

export type ArticleAnalysis = typeof articleAnalysis.$inferSelect;
export type NewArticleAnalysis = typeof articleAnalysis.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;

export type UserPreferences = typeof userPreferences.$inferSelect;
