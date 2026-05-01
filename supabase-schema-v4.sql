-- ============================================================
-- WATCHLIST — Schema v4 : rôles globaux + profils publics
-- Colle dans Supabase > SQL Editor > Run
-- ============================================================

-- Ajouter colonne global_role aux profils (si elle n'existe pas)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS global_role TEXT NOT NULL DEFAULT 'user';
-- Valeurs : 'superadmin' | 'admin' | 'moderator' | 'vip' | 'user'

-- Ajouter genre et localisation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';

-- Visibilité des listes sur le profil
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

-- Avertissements / sanctions modération
CREATE TABLE IF NOT EXISTS moderation_actions (
  id          TEXT PRIMARY KEY,
  target_id   TEXT NOT NULL,        -- user profile id
  mod_id      TEXT NOT NULL,        -- moderator who acted
  mod_name    TEXT NOT NULL,
  action      TEXT NOT NULL,        -- 'warn' | 'mute' | 'ban' | 'unban' | 'role_change'
  reason      TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_mod" ON moderation_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE moderation_actions;

-- ⚠️ Pour te définir toi-même comme superadmin, remplace TON_USER_ID
-- par ton vrai ID Supabase (visible dans Authentication > Users)
-- UPDATE profiles SET global_role = 'superadmin' WHERE id = 'TON_USER_ID';
