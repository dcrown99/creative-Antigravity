import 'server-only';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Database file location
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'news-reader.db');

// Lazy instances
let _sqlite: Database.Database | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

// Ensure data directory exists
function ensureDbDir() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
}

// Lazy getter for SQLite instance
export function getSqliteInstance() {
    if (!_sqlite) {
        ensureDbDir();
        console.log('[DB] Initializing SQLite connection...');
        _sqlite = new Database(DB_PATH);
        _sqlite.pragma('journal_mode = WAL');
        _sqlite.pragma('foreign_keys = ON');

        // Auto-initialize tables on first connection
        initializeDatabase(_sqlite);
    }
    return _sqlite;
}

// Lazy getter for Drizzle instance
export function getDbInstance() {
    if (!_db) {
        const sqlite = getSqliteInstance();
        _db = drizzle(sqlite, { schema });
    }
    return _db;
}

// Proxy to maintain API compatibility while loading lazily
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
    get: (_target, prop) => {
        const instance = getDbInstance();
        return Reflect.get(instance, prop);
    },
    // Useful for handling applying as function if drizzle instance was a function (it's an object usually)
    apply: (_target, _thisArg, args) => {
        const instance = getDbInstance();
        // @ts-expect-error Proxy target type mismatch
        return Reflect.apply(instance, _thisArg, args);
    }
});

// Export schema for convenience
export * from './schema';

// Initialize database tables
export function initializeDatabase(sqlite: Database.Database) {
    // Create folders table
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            "order" INTEGER DEFAULT 0,
            created_at INTEGER
        )
    `);

    // Create feeds table
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS feeds (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT,
            favicon TEXT,
            folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
            last_fetched_at INTEGER,
            fetch_frequency INTEGER DEFAULT 15,
            error_count INTEGER DEFAULT 0,
            created_at INTEGER
        )
    `);

    // Create articles table (with thumbnail column)
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
            link TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            content_snippet TEXT,
            thumbnail TEXT,
            author TEXT,
            pub_date INTEGER,
            iso_date TEXT,
            is_read INTEGER DEFAULT 0,
            is_starred INTEGER DEFAULT 0,
            read_at INTEGER,
            created_at INTEGER
        )
    `);

    // Migration: Add thumbnail column if not exists (for existing databases)
    try {
        const columns = sqlite.pragma('table_info(articles)') as { name: string }[];
        const hasThumbnail = columns.some(col => col.name === 'thumbnail');
        if (!hasThumbnail) {
            sqlite.exec('ALTER TABLE articles ADD COLUMN thumbnail TEXT');
            console.log('✅ Added thumbnail column to articles table');
        }
    } catch (e) {
        // Column might already exist or table might not exist yet
        console.log('Thumbnail migration check:', (e as Error).message);
    }

    // Create article_analysis table
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS article_analysis (
            id TEXT PRIMARY KEY,
            article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            summary TEXT,
            priority TEXT,
            topics TEXT,
            sentiment TEXT,
            created_at INTEGER
        )
    `);

    // Create tags table
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#6366f1',
            created_at INTEGER
        )
    `);

    // Create article_tags junction table
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS article_tags (
            article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (article_id, tag_id)
        )
    `);

    // Create rules table
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            conditions TEXT,
            actions TEXT,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER
        )
    `);

    // Create user_preferences table
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS user_preferences (
            id TEXT PRIMARY KEY DEFAULT 'default',
            view_mode TEXT DEFAULT 'list',
            theme TEXT DEFAULT 'system',
            default_filter TEXT DEFAULT 'unread',
            articles_per_page INTEGER DEFAULT 50,
            auto_mark_as_read INTEGER DEFAULT 1,
            updated_at INTEGER
        )
    `);

    // Create FTS5 virtual table for full-text search
    sqlite.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
            title,
            content,
            content='articles',
            content_rowid='rowid'
        )
    `);

    // Create triggers to keep FTS in sync
    sqlite.exec(`
        CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
            INSERT INTO articles_fts(rowid, title, content) 
            VALUES (NEW.rowid, NEW.title, NEW.content);
        END
    `);

    sqlite.exec(`
        CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
            INSERT INTO articles_fts(articles_fts, rowid, title, content) 
            VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
        END
    `);

    sqlite.exec(`
        CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
            INSERT INTO articles_fts(articles_fts, rowid, title, content) 
            VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
            INSERT INTO articles_fts(rowid, title, content) 
            VALUES (NEW.rowid, NEW.title, NEW.content);
        END
    `);

    // Create indexes for common queries
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_articles_is_starred ON articles(is_starred)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date DESC)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_feeds_folder_id ON feeds(folder_id)`);

    console.log('✅ Database initialized successfully');
}

// Full-text search helper
export function searchArticles(query: string, limit = 50) {
    const sqlite = getSqliteInstance();
    const stmt = sqlite.prepare(`
        SELECT articles.* 
        FROM articles_fts 
        JOIN articles ON articles.rowid = articles_fts.rowid
        WHERE articles_fts MATCH ?
        ORDER BY rank
        LIMIT ?
    `);
    return stmt.all(query, limit);
}

// Close database connection (for graceful shutdown)
export function closeDatabase() {
    if (_sqlite) {
        _sqlite.close();
        _sqlite = null;
        _db = null;
    }
}
