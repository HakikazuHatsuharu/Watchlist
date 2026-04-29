# 🎞 Watchlist — Guide de déploiement

## Architecture

```
Frontend (React/Vite)  →  /api/*  →  Netlify Functions (Node.js)  →  Supabase (PostgreSQL)
                                            ↑
                              Clé service_role (secrète, backend only)
```

- Le **frontend** ne connaît que la clé `anon` (lecture realtime uniquement)
- Toutes les écritures passent par le **backend** (Netlify Functions) avec la clé `service_role`
- L'auth est gérée par Supabase Auth

---

## Étape 1 — Supabase

1. Crée un projet sur [supabase.com](https://supabase.com)
2. Va dans **SQL Editor** → **New query** → colle le contenu de `supabase-schema.sql` → **Run**
3. Va dans **Settings > API** et note :
   - `Project URL` → `SUPABASE_URL` et `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY` ⚠️ **ne jamais mettre dans le frontend**

---

## Étape 2 — Netlify

1. Pousse le projet sur GitHub
2. Va sur [netlify.com](https://netlify.com) → **Add new site > Import from Git**
3. Dans **Site settings > Environment variables**, ajoute :

| Variable | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé `anon` |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_KEY` | Clé `service_role` (secrète) |

4. **Deploy** → Netlify build et déploie automatiquement

---

## Développement local

```bash
npm install
cp .env.example .env.local
# Remplis .env.local avec tes clés Supabase

npm run dev   # Lance Vite + Netlify Dev (functions incluses)
```

L'app tourne sur http://localhost:8888

---

## Structure du projet

```
watchlist/
├── netlify/
│   └── functions/
│       ├── api.js              ← Toutes les routes API (backend)
│       └── _utils/
│           ├── supabase.js     ← Client admin Supabase (service key)
│           └── http.js         ← Helpers HTTP / router
├── src/
│   ├── App.jsx                 ← App principale
│   ├── main.jsx
│   └── lib/
│       ├── api.js              ← Client API frontend (fetch vers /api/*)
│       ├── realtime.js         ← Supabase realtime (anon key)
│       └── i18n.js             ← Traductions FR / EN
├── public/
│   └── icon.svg
├── supabase-schema.sql         ← Schema DB à exécuter une fois
├── netlify.toml
├── vite.config.js
└── .env.example
```

---

## Routes API

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/lists` | Mes listes |
| POST | `/api/lists` | Créer une liste |
| POST | `/api/lists/join` | Rejoindre via code |
| GET | `/api/lists/:id/items` | Items d'une liste |
| POST | `/api/lists/:id/items` | Ajouter un item |
| PUT | `/api/lists/:id/items/:itemId` | Modifier un item |
| DELETE | `/api/lists/:id/items/:itemId` | Supprimer un item |
| GET | `/api/lists/:id/messages` | Messages du chat |
| POST | `/api/lists/:id/messages` | Envoyer un message |
| GET | `/api/posters?title=&category=` | Rechercher une affiche |
# Watchlist
