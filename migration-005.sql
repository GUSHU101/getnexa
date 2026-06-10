-- Migration 005: Blog system, age verification, Nexa Starter subscription

-- Blog posts (auto-generated every 8h via cron)
CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'gaming',
  tags TEXT NOT NULL DEFAULT '[]',
  author TEXT NOT NULL DEFAULT 'NEXA Editorial',
  meta_description TEXT NOT NULL,
  meta_keywords TEXT NOT NULL DEFAULT '',
  image_emoji TEXT NOT NULL DEFAULT '🎮',
  read_time INTEGER NOT NULL DEFAULT 5,
  featured INTEGER NOT NULL DEFAULT 0,
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category, published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);

-- Age verification for cash tournament access
ALTER TABLE users ADD COLUMN date_of_birth TEXT;
ALTER TABLE users ADD COLUMN age_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN age_verified_at INTEGER;

-- Subscription tracking (recurring management)
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status);
