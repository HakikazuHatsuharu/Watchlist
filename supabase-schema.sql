-- ============================================================
-- WATCHLIST — Schema Supabase (v2 avec chat)
-- Colle ce SQL dans : Supabase > SQL Editor > New query > Run
-- ============================================================

CREATE TABLE IF NOT EXISTS watchlists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  members     JSONB DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id             TEXT PRIMARY KEY,
  watchlist_id   TEXT REFERENCES watchlists(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  category       TEXT NOT NULL,
  tags           JSONB DEFAULT '[]'::jsonb,
  poster_url     TEXT DEFAULT '',
  added_by       TEXT,
  added_by_name  TEXT,
  user_progress  JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,
  watchlist_id TEXT REFERENCES watchlists(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  username     TEXT NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_watchlists" ON watchlists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_items"      ON items      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_messages"   ON messages   FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE watchlists;
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
