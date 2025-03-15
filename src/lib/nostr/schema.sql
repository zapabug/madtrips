-- SQLite schema for Nostr social graph data
-- This schema can be used in the future when migrating from JSON to SQLite

-- Table for pubkeys (users)
CREATE TABLE IF NOT EXISTS pubkeys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pubkey TEXT UNIQUE NOT NULL,
  npub TEXT UNIQUE NOT NULL,
  is_core BOOLEAN NOT NULL DEFAULT 0,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  name TEXT,
  display_name TEXT,
  picture TEXT,
  about TEXT,
  nip05 TEXT
);

-- Table for follows/connections
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL,
  followed_id INTEGER NOT NULL,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES pubkeys(id),
  FOREIGN KEY (followed_id) REFERENCES pubkeys(id),
  UNIQUE(follower_id, followed_id)
);

-- Table for interactions between users
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  interaction_type TEXT NOT NULL, -- follows, mentioned, replied, reposted, liked, zapped
  event_id TEXT NOT NULL,
  event_kind INTEGER NOT NULL,
  content TEXT,
  created_at TIMESTAMP NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES pubkeys(id),
  FOREIGN KEY (target_id) REFERENCES pubkeys(id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pubkeys_pubkey ON pubkeys(pubkey);
CREATE INDEX IF NOT EXISTS idx_pubkeys_npub ON pubkeys(npub);
CREATE INDEX IF NOT EXISTS idx_connections_follower ON connections(follower_id);
CREATE INDEX IF NOT EXISTS idx_connections_followed ON connections(followed_id);
CREATE INDEX IF NOT EXISTS idx_interactions_source ON interactions(source_id);
CREATE INDEX IF NOT EXISTS idx_interactions_target ON interactions(target_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(interaction_type);

-- View for mutual follows
CREATE VIEW IF NOT EXISTS mutual_follows AS
SELECT 
  a.follower_id, a.followed_id
FROM 
  connections a
JOIN 
  connections b ON a.follower_id = b.followed_id AND a.followed_id = b.follower_id;

-- View for core-connected users
CREATE VIEW IF NOT EXISTS core_connected AS
SELECT DISTINCT
  p.id, p.pubkey, p.npub, p.name, p.display_name,
  CASE
    WHEN p.is_core = 1 THEN 'core'
    WHEN m.follower_id IS NOT NULL THEN 'mutual'
    WHEN cf.followed_id IS NOT NULL THEN 'follower'
    WHEN cf.follower_id IS NOT NULL THEN 'following'
    ELSE 'unknown'
  END as connection_type
FROM 
  pubkeys p
LEFT JOIN 
  connections cf ON p.id = cf.follower_id AND cf.followed_id IN (SELECT id FROM pubkeys WHERE is_core = 1)
LEFT JOIN 
  connections cf2 ON p.id = cf2.followed_id AND cf2.follower_id IN (SELECT id FROM pubkeys WHERE is_core = 1)
LEFT JOIN 
  mutual_follows m ON p.id = m.follower_id AND m.followed_id IN (SELECT id FROM pubkeys WHERE is_core = 1)
WHERE
  p.is_core = 1 OR cf.followed_id IS NOT NULL OR cf2.follower_id IS NOT NULL;

-- View for interaction counts
CREATE VIEW IF NOT EXISTS interaction_summary AS
SELECT
  source_id,
  target_id,
  interaction_type,
  COUNT(*) as count
FROM
  interactions
GROUP BY
  source_id, target_id, interaction_type; 