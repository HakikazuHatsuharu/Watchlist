import { db, verifyToken } from "./_utils/supabase.js";
import { ok, err, unauthorized, notFound, parseBody, route, CORS } from "./_utils/http.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
function genCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
const fakeEmail = (u) => `${u.toLowerCase().replace(/[^a-z0-9]/g, "")}@watchlist.app`;

// ─── Route handlers ───────────────────────────────────────────────────────────

// POST /api/auth/register
async function register({ username, password }) {
  if (!username?.trim() || !password) return err("Missing fields");
  const uname = username.trim();

  // Check uniqueness via existing users
  const { data: existing } = await db.auth.admin.listUsers();
  const taken = existing?.users?.some(
    (u) => u.user_metadata?.username?.toLowerCase() === uname.toLowerCase()
  );
  if (taken) return err("Ce nom d'utilisateur est déjà pris. / Username already taken.");

  const { data, error } = await db.auth.admin.createUser({
    email: fakeEmail(uname),
    password,
    user_metadata: { username: uname },
    email_confirm: true,
  });
  if (error) return err(error.message);

  // Sign in immediately to get a session token
  const { data: session, error: signErr } = await db.auth.signInWithPassword({
    email: fakeEmail(uname), password,
  });
  if (signErr) return err(signErr.message);

  return ok({
    user: { id: data.user.id, username: uname },
    token: session.session.access_token,
    refreshToken: session.session.refresh_token,
  }, 201);
}

// POST /api/auth/login
async function login({ username, password }) {
  if (!username?.trim() || !password) return err("Missing fields");
  const { data, error } = await db.auth.signInWithPassword({
    email: fakeEmail(username.trim()), password,
  });
  if (error) return err("Nom d'utilisateur ou mot de passe incorrect. / Wrong credentials.", 401);
  return ok({
    user: { id: data.user.id, username: data.user.user_metadata?.username || username },
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
}

// POST /api/auth/refresh
async function refreshSession({ refreshToken }) {
  if (!refreshToken) return err("Missing refresh token");
  const { data, error } = await db.auth.refreshSession({ refresh_token: refreshToken });
  if (error) return err("Session expired", 401);
  return ok({
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
}

// GET /api/lists  — get lists where user is a member
async function getLists(user) {
  const { data, error } = await db.from("watchlists").select("*");
  if (error) return err(error.message, 500);
  const mine = (data || []).filter((l) => l.members?.some((m) => m.id === user.id));
  return ok(mine);
}

// POST /api/lists  — create a new list
async function createList(user, body) {
  const { name } = body;
  if (!name?.trim()) return err("Name required");
  const newList = {
    id: genId(),
    name: name.trim(),
    owner_id: user.id,
    invite_code: genCode(),
    members: [{ id: user.id, username: user.username }],
  };
  const { error } = await db.from("watchlists").insert(newList);
  if (error) return err(error.message, 500);
  return ok(newList, 201);
}

// POST /api/lists/join  — join a list by invite code
async function joinList(user, body) {
  const { code } = body;
  if (!code) return err("Code required");
  const { data: list, error } = await db.from("watchlists").select("*").eq("invite_code", code.toUpperCase()).single();
  if (error || !list) return err("Invalid code", 404);

  const already = list.members?.some((m) => m.id === user.id);
  if (!already) {
    const newMembers = [...(list.members || []), { id: user.id, username: user.username }];
    await db.from("watchlists").update({ members: newMembers }).eq("id", list.id);
    list.members = newMembers;
  }
  return ok(list);
}

// GET /api/lists/:id/items
async function getItems(user, listId) {
  // Verify membership
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some((m) => m.id === user.id)) return unauthorized();

  const { data, error } = await db.from("items").select("*").eq("watchlist_id", listId).order("created_at");
  if (error) return err(error.message, 500);
  return ok(data || []);
}

// POST /api/lists/:id/items  — create item
async function createItem(user, listId, body) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some((m) => m.id === user.id)) return unauthorized();

  const item = {
    id: body.id || genId(),
    watchlist_id: listId,
    title: body.title,
    category: body.category || "film",
    tags: body.tags || [],
    poster_url: body.poster_url || "",
    added_by: user.id,
    added_by_name: user.username,
    user_progress: body.user_progress || {},
  };
  if (!item.title) return err("Title required");
  const { error } = await db.from("items").insert(item);
  if (error) return err(error.message, 500);
  return ok(item, 201);
}

// PUT /api/lists/:id/items/:itemId  — update item (progress, poster, etc.)
async function updateItem(user, listId, itemId, body) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some((m) => m.id === user.id)) return unauthorized();

  // Allow any member to update user_progress; only owner can update other fields
  const { data: existing } = await db.from("items").select("*").eq("id", itemId).single();
  if (!existing) return notFound();

  const updates = { user_progress: { ...existing.user_progress, ...body.user_progress } };
  // Owner can edit metadata
  if (existing.added_by === user.id) {
    if (body.title) updates.title = body.title;
    if (body.category) updates.category = body.category;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.poster_url !== undefined) updates.poster_url = body.poster_url;
  }

  const { error } = await db.from("items").update(updates).eq("id", itemId);
  if (error) return err(error.message, 500);
  return ok({ ...existing, ...updates });
}

// DELETE /api/lists/:id/items/:itemId
async function deleteItem(user, listId, itemId) {
  const { data: item } = await db.from("items").select("added_by, watchlist_id").eq("id", itemId).single();
  if (!item) return notFound();
  if (item.watchlist_id !== listId) return err("Mismatch");
  if (item.added_by !== user.id) return err("Only the creator can delete this item", 403);

  const { error } = await db.from("items").delete().eq("id", itemId);
  if (error) return err(error.message, 500);
  return ok({ deleted: true });
}

// GET /api/lists/:id/messages?limit=100&before=<timestamp>
async function getMessages(user, listId, query) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some((m) => m.id === user.id)) return unauthorized();

  const limit = Math.min(parseInt(query.limit || "100"), 200);
  let q = db.from("messages").select("*").eq("watchlist_id", listId).order("created_at", { ascending: false }).limit(limit);
  if (query.before) q = q.lt("created_at", query.before);

  const { data, error } = await q;
  if (error) return err(error.message, 500);
  return ok((data || []).reverse());
}

// POST /api/lists/:id/messages
async function sendMessage(user, listId, body) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some((m) => m.id === user.id)) return unauthorized();

  const { content } = body;
  if (!content?.trim()) return err("Content required");

  const msg = {
    id: genId(),
    watchlist_id: listId,
    user_id: user.id,
    username: user.username,
    content: content.trim(),
  };
  const { error } = await db.from("messages").insert(msg);
  if (error) return err(error.message, 500);
  return ok(msg, 201);
}

// ─── Search posters (proxied through backend to avoid CORS issues) ────────────
async function searchPosters(query) {
  const { title, category } = query;
  if (!title) return err("Title required");
  const results = [];

  try {
    if (category === "film") {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=movie&limit=8&country=fr`);
      const d = await r.json();
      for (const item of d.results || []) {
        if (item.artworkUrl100) results.push({
          url: item.artworkUrl100.replace("100x100bb", "600x900bb"),
          label: item.trackName || item.collectionName,
        });
      }
    }
    // TVMaze for series
    if (category === "serie" || results.length < 3) {
      const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
      const d = await r.json();
      for (const item of d || []) {
        const img = item.show?.image?.original || item.show?.image?.medium;
        if (img) results.push({ url: img, label: item.show.name });
      }
    }
    // iTunes TV shows
    const r2 = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=tvShow&limit=5&country=fr`);
    const d2 = await r2.json();
    for (const item of d2.results || []) {
      if (item.artworkUrl100) {
        const url = item.artworkUrl100.replace("100x100bb", "600x900bb");
        if (!results.find((x) => x.url === url))
          results.push({ url, label: item.collectionName || item.trackName });
      }
    }
  } catch { /* silent */ }

  return ok(results.slice(0, 10));
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const method = event.httpMethod;
  const rawPath = event.path.replace(/^\/.netlify\/functions\/api\/?/, "").replace(/^api\/?/, "");
  const segments = rawPath.split("/").filter(Boolean);
  const body = parseBody(event);
  const query = event.queryStringParameters || {};

  try {
    // ── Public routes (no auth needed) ──────────────────────────────────────
    if (segments[0] === "auth") {
      if (method === "POST" && segments[1] === "register") return await register(body);
      if (method === "POST" && segments[1] === "login") return await login(body);
      if (method === "POST" && segments[1] === "refresh") return await refreshSession(body);
      return notFound();
    }

    // ── Poster search (auth optional but recommended) ─────────────────────
    if (method === "GET" && segments[0] === "posters") return await searchPosters(query);

    // ── Protected routes ─────────────────────────────────────────────────────
    const user = await verifyToken(event.headers?.authorization || event.headers?.Authorization);
    if (!user) return unauthorized();

    // Lists
    if (segments[0] === "lists") {
      if (method === "GET" && segments.length === 1) return await getLists(user);
      if (method === "POST" && segments.length === 1) return await createList(user, body);
      if (method === "POST" && segments[1] === "join") return await joinList(user, body);

      const listId = segments[1];
      if (!listId) return notFound();

      // Items
      if (segments[2] === "items") {
        if (method === "GET" && segments.length === 3) return await getItems(user, listId);
        if (method === "POST" && segments.length === 3) return await createItem(user, listId, body);
        const itemId = segments[3];
        if (itemId) {
          if (method === "PUT") return await updateItem(user, listId, itemId, body);
          if (method === "DELETE") return await deleteItem(user, listId, itemId);
        }
      }

      // Messages
      if (segments[2] === "messages") {
        if (method === "GET") return await getMessages(user, listId, query);
        if (method === "POST") return await sendMessage(user, listId, body);
      }
    }

    return notFound();
  } catch (e) {
    console.error("API Error:", e);
    return err("Internal server error", 500);
  }
};
