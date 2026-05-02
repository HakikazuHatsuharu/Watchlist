import { db, verifyToken } from "./_utils/supabase.js";
import { ok, err, unauthorized, notFound, parseBody, CORS } from "./_utils/http.js";

function genId() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
function genCode() { return Math.random().toString(36).slice(2,8).toUpperCase(); }

// ─── Global role helpers ────────────────────────────────────────────────────────
const ROLE_LEVELS = { superadmin:5, admin:4, moderator:3, vip:2, user:1 };
function canModerate(role) { return ROLE_LEVELS[role] >= 3; }
function canAdmin(role)    { return ROLE_LEVELS[role] >= 4; }

async function getGlobalRole(userId) {
  const { data } = await db.from("profiles").select("global_role").eq("id", userId).single();
  return data?.global_role || "user";
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function register({ username, email, password }) {
  if (!username?.trim() || !password || !email?.trim()) return err("Missing fields");
  const uname = username.trim(); const mail = email.trim().toLowerCase();
  const { data: existing } = await db.auth.admin.listUsers();
  if (existing?.users?.some(u => u.user_metadata?.username?.toLowerCase() === uname.toLowerCase()))
    return err("Ce nom d'utilisateur est déjà pris.");
  if (existing?.users?.some(u => u.email === mail))
    return err("Cet email est déjà utilisé.");
  const { data, error } = await db.auth.admin.createUser({ email: mail, password, user_metadata: { username: uname }, email_confirm: true });
  if (error) return err(error.message);
  // Create profile
  await db.from("profiles").insert({ id: data.user.id, username: uname, avatar_url: "", bio: "" });
  const { data: session, error: sErr } = await db.auth.signInWithPassword({ email: mail, password });
  if (sErr) return err(sErr.message);
  return ok({ user: { id: data.user.id, username: uname, email: mail }, token: session.session.access_token, refreshToken: session.session.refresh_token }, 201);
}

async function login({ username, password }) {
  if (!username?.trim() || !password) return err("Missing fields");
  const { data: existing } = await db.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.user_metadata?.username?.toLowerCase() === username.trim().toLowerCase());
  if (!found) return err("Identifiants incorrects.", 401);
  const { data, error } = await db.auth.signInWithPassword({ email: found.email, password });
  if (error) return err("Identifiants incorrects.", 401);
  return ok({ user: { id: data.user.id, username: data.user.user_metadata?.username || username, email: found.email }, token: data.session.access_token, refreshToken: data.session.refresh_token });
}

async function refreshSession({ refreshToken }) {
  if (!refreshToken) return err("Missing token");
  const { data, error } = await db.auth.refreshSession({ refresh_token: refreshToken });
  if (error) return err("Session expired", 401);
  return ok({ token: data.session.access_token, refreshToken: data.session.refresh_token });
}

async function forgotPassword({ email }) {
  if (!email?.trim()) return err("Email required");
  await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: process.env.SITE_URL + "/reset-password" });
  return ok({ sent: true });
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
async function getProfile(id) {
  const { data, error } = await db.from("profiles").select("*").eq("id", id).single();
  if (error || !data) return notFound();
  return ok(data);
}

// GET /api/profiles/:id/public — full public profile with stats + lists
async function getPublicProfile(id) {
  const { data: profile } = await db.from("profiles").select("*").eq("id", id).single();
  if (!profile) return notFound();

  // Stats: count items by status in all lists where user is member
  const { data: allItems } = await db.from("items").select("user_progress, category");
  let filmsWatched = 0, seriesWatched = 0, totalRatings = 0, ratingSum = 0;
  const tagCount = {};
  (allItems || []).forEach(item => {
    const prog = item.user_progress?.[id];
    if (!prog) return;
    if (prog.status === "termine") {
      if (item.category === "film") filmsWatched++;
      else seriesWatched++;
      if (prog.rating > 0) { totalRatings++; ratingSum += prog.rating; }
    }
    // Count tags
    (item.tags || []).forEach(tag => { tagCount[tag] = (tagCount[tag] || 0) + 1; });
  });

  const favTags = Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([tag])=>tag);
  const avgRating = totalRatings > 0 ? Math.round((ratingSum/totalRatings)*10)/10 : null;

  // Public watchlists
  const { data: allLists } = await db.from("watchlists").select("id, name, members, is_public, created_at");
  const publicLists = (allLists || []).filter(l =>
    l.is_public !== false && l.members?.some(m => m.id === id)
  ).map(l => ({ id: l.id, name: l.name, memberCount: l.members?.length || 1, createdAt: l.created_at }));

  return ok({
    ...profile,
    stats: { filmsWatched, seriesWatched, avgRating, totalWatched: filmsWatched + seriesWatched },
    favTags,
    publicLists,
  });
}

async function updateProfile(user, body) {
  const allowed = {};
  if (body.avatar_url !== undefined) allowed.avatar_url = body.avatar_url;
  if (body.bio !== undefined) allowed.bio = String(body.bio).slice(0, 200);
  if (body.confirm_delete !== undefined) allowed.confirm_delete = Boolean(body.confirm_delete);
  if (body.gender !== undefined) allowed.gender = body.gender;
  if (body.location !== undefined) allowed.location = String(body.location).slice(0, 100);
  if (body.website !== undefined) allowed.website = String(body.website).slice(0, 200);
  // Upsert profile
  const { error } = await db.from("profiles").upsert({ id: user.id, username: user.username, ...allowed });
  if (error) return err(error.message, 500);
  const { data } = await db.from("profiles").select("*").eq("id", user.id).single();
  return ok(data);
}

async function searchUsers(user, query) {
  if (!query?.trim() || query.trim().length < 2) return ok([]);
  const { data: authUsers } = await db.auth.admin.listUsers();
  const matches = (authUsers?.users || [])
    .filter(u => u.id !== user.id && u.user_metadata?.username?.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10)
    .map(u => ({ id: u.id, username: u.user_metadata?.username }));
  // Get their profiles
  const ids = matches.map(m => m.id);
  const { data: profiles } = ids.length ? await db.from("profiles").select("*").in("id", ids) : { data: [] };
  const result = matches.map(m => ({ ...m, ...(profiles?.find(p => p.id === m.id) || {}) }));
  return ok(result);
}

// ─── Friends ──────────────────────────────────────────────────────────────────
async function getFriends(user) {
  const { data } = await db.from("friendships").select("*").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  if (!data) return ok([]);
  // Enrich with profile data
  const otherIds = data.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
  const { data: profiles } = otherIds.length ? await db.from("profiles").select("*").in("id", otherIds) : { data: [] };
  const enriched = data.map(f => {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    const profile = profiles?.find(p => p.id === otherId) || {};
    return { ...f, other: { id: otherId, username: profile.username || "?", avatar_url: profile.avatar_url || "", created_at: profile.created_at } };
  });
  return ok(enriched);
}

async function sendFriendRequest(user, { addresseeId }) {
  if (!addresseeId || addresseeId === user.id) return err("Invalid user");
  const { error } = await db.from("friendships").insert({ id: genId(), requester_id: user.id, addressee_id: addresseeId, status: "pending" });
  if (error) return err(error.message);
  // Send notification to addressee
  await createNotif(db, { userId: addresseeId, type: "friend_request", fromId: user.id, fromName: user.username, content: `${user.username} vous a envoyé une demande d'ami`, link: "/friends" });
  return ok({ sent: true }, 201);
}

async function updateFriendship(user, id, action) {
  const { data: fr } = await db.from("friendships").select("*").eq("id", id).single();
  if (!fr) return notFound();
  if (fr.addressee_id !== user.id && fr.requester_id !== user.id) return unauthorized();
  if (action === "accept") {
    await db.from("friendships").update({ status: "accepted" }).eq("id", id);
  } else if (action === "reject" || action === "remove") {
    await db.from("friendships").delete().eq("id", id);
  }
  return ok({ done: true });
}

// ─── Direct messages ──────────────────────────────────────────────────────────
async function getDMs(user, otherId) {
  const { data } = await db.from("direct_messages").select("*")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
    .order("created_at").limit(200);
  // Mark as read
  await db.from("direct_messages").update({ read: true }).eq("receiver_id", user.id).eq("sender_id", otherId);
  return ok(data || []);
}

async function markRead(user, otherId) {
  await db.from("direct_messages").update({ read: true }).eq("receiver_id", user.id).eq("sender_id", otherId);
  return ok({ done: true });
}

async function sendDM(user, otherId, { content }) {
  if (!content?.trim()) return err("Content required");
  const msg = { id: genId(), sender_id: user.id, receiver_id: otherId, content: content.trim() };
  const { error } = await db.from("direct_messages").insert(msg);
  if (error) return err(error.message, 500);
  return ok(msg, 201);
}

async function getUnreadCount(user) {
  const { count } = await db.from("direct_messages").select("id", { count: "exact", head: true }).eq("receiver_id", user.id).eq("read", false);
  return ok({ count: count || 0 });
}

// ─── Lists ────────────────────────────────────────────────────────────────────
async function getLists(user) {
  const { data } = await db.from("watchlists").select("*");
  return ok((data || []).filter(l => l.members?.some(m => m.id === user.id)));
}

async function createList(user, { name }) {
  if (!name?.trim()) return err("Name required");
  const list = { id: genId(), name: name.trim(), owner_id: user.id, invite_code: genCode(), members: [{ id: user.id, username: user.username, role: "owner", joinedAt: new Date().toISOString() }] };
  await db.from("watchlists").insert(list);
  return ok(list, 201);
}

async function renameList(user, listId, { name }) {
  const { data: list } = await db.from("watchlists").select("*").eq("id", listId).single();
  if (!list) return notFound();
  const me = list.members?.find(m => m.id === user.id);
  if (!me || !["owner","admin"].includes(me.role)) return err("Insufficient permissions", 403);
  await db.from("watchlists").update({ name: name.trim() }).eq("id", listId);
  return ok({ id: listId, name: name.trim() });
}

async function joinList(user, { code }) {
  const { data: list } = await db.from("watchlists").select("*").eq("invite_code", code?.toUpperCase()).single();
  if (!list) return err("Invalid code", 404);
  if (!list.members?.some(m => m.id === user.id)) {
    const newMembers = [...(list.members || []), { id: user.id, username: user.username, role: "member", joinedAt: new Date().toISOString() }];
    await db.from("watchlists").update({ members: newMembers }).eq("id", list.id);
    list.members = newMembers;
  }
  return ok(list);
}

async function updateMemberRole(user, listId, memberId, { role }) {
  const { data: list } = await db.from("watchlists").select("*").eq("id", listId).single();
  if (!list) return notFound();
  const me = list.members?.find(m => m.id === user.id);
  if (!me || me.role !== "owner" && me.role !== "admin") return err("Insufficient permissions", 403);
  const validRoles = ["admin","moderator","member"];
  if (!validRoles.includes(role)) return err("Invalid role");
  const newMembers = list.members.map(m => m.id === memberId ? { ...m, role } : m);
  await db.from("watchlists").update({ members: newMembers }).eq("id", listId);
  return ok({ done: true });
}

async function removeMember(user, listId, memberId) {
  const { data: list } = await db.from("watchlists").select("*").eq("id", listId).single();
  if (!list) return notFound();
  const me = list.members?.find(m => m.id === user.id);
  if (!me || (me.role !== "owner" && me.id !== memberId)) return err("Insufficient permissions", 403);
  const newMembers = list.members.filter(m => m.id !== memberId);
  await db.from("watchlists").update({ members: newMembers }).eq("id", listId);
  return ok({ done: true });
}

// ─── Items ────────────────────────────────────────────────────────────────────
async function getItems(user, listId) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some(m => m.id === user.id)) return unauthorized();
  const { data } = await db.from("items").select("*").eq("watchlist_id", listId).order("created_at");
  return ok(data || []);
}

async function createItem(user, listId, body) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some(m => m.id === user.id)) return unauthorized();
  if (!body.title) return err("Title required");
  const item = { id: body.id || genId(), watchlist_id: listId, title: body.title, category: body.category || "film", tags: body.tags || [], poster_url: body.poster_url || "", added_by: user.id, added_by_name: user.username, user_progress: body.user_progress || {} };
  await db.from("items").insert(item);
  return ok(item, 201);
}

async function updateItem(user, listId, itemId, body) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some(m => m.id === user.id)) return unauthorized();
  const { data: existing } = await db.from("items").select("*").eq("id", itemId).single();
  if (!existing) return notFound();
  const updates = {};
  // Any member can update their own progress
  if (body.user_progress) updates.user_progress = { ...existing.user_progress, ...body.user_progress };
  // Only owner/admin/moderator or item creator can edit metadata
  const me = list.members.find(m => m.id === user.id);
  const canEdit = existing.added_by === user.id || ["owner","admin","moderator"].includes(me?.role);
  if (canEdit) {
    if (body.title) updates.title = body.title;
    if (body.category) updates.category = body.category;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.poster_url !== undefined) updates.poster_url = body.poster_url;
  }
  await db.from("items").update(updates).eq("id", itemId);
  return ok({ ...existing, ...updates });
}

async function deleteItemHandler(user, listId, itemId) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some(m => m.id === user.id)) return unauthorized();
  const { data: item } = await db.from("items").select("added_by").eq("id", itemId).single();
  if (!item) return notFound();
  const me = list.members.find(m => m.id === user.id);
  const canDelete = item.added_by === user.id || ["owner","admin"].includes(me?.role);
  if (!canDelete) return err("Only the creator or an admin can delete this item", 403);
  await db.from("items").delete().eq("id", itemId);
  return ok({ deleted: true });
}

// ─── Messages ─────────────────────────────────────────────────────────────────
async function getMessages(user, listId, query) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some(m => m.id === user.id)) return unauthorized();
  const limit = Math.min(parseInt(query.limit || "100"), 200);
  const { data } = await db.from("messages").select("*").eq("watchlist_id", listId).order("created_at", { ascending: false }).limit(limit);
  return ok((data || []).reverse());
}

async function sendMessage(user, listId, { content }) {
  const { data: list } = await db.from("watchlists").select("members").eq("id", listId).single();
  if (!list?.members?.some(m => m.id === user.id)) return unauthorized();
  if (!content?.trim()) return err("Content required");
  const msg = { id: genId(), watchlist_id: listId, user_id: user.id, username: user.username, content: content.trim() };
  await db.from("messages").insert(msg);
  return ok(msg, 201);
}

async function getGlobalChat() {
  const { data } = await db.from("messages").select("*").eq("watchlist_id", "__global__").order("created_at", { ascending: false }).limit(100);
  return ok((data || []).reverse());
}

async function sendGlobalMsg(user, { content }) {
  if (!content?.trim()) return err("Content required");
  const msg = { id: genId(), watchlist_id: "__global__", user_id: user.id, username: user.username, content: content.trim() };
  await db.from("messages").insert(msg);
  return ok(msg, 201);
}

// ─── Poster search ────────────────────────────────────────────────────────────
async function searchPosters({ title, category }) {
  if (!title) return err("Title required");
  const results = [];
  try {
    if (category === "film") {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=movie&limit=8&country=fr`);
      const d = await r.json();
      for (const item of d.results || []) if (item.artworkUrl100) results.push({ url: item.artworkUrl100.replace("100x100bb","600x900bb"), label: item.trackName });
    }
    const r2 = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
    const d2 = await r2.json();
    for (const item of d2 || []) { const img = item.show?.image?.original || item.show?.image?.medium; if (img) results.push({ url: img, label: item.show.name }); }
    const r3 = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=tvShow&limit=5&country=fr`);
    const d3 = await r3.json();
    for (const item of d3.results || []) if (item.artworkUrl100) { const url = item.artworkUrl100.replace("100x100bb","600x900bb"); if (!results.find(x=>x.url===url)) results.push({ url, label: item.collectionName }); }
  } catch {}
  return ok(results.slice(0, 10));
}

// ─── Notifications ───────────────────────────────────────────────────────────
async function createNotif(db, { userId, type, fromId, fromName, content, link="" }) {
  const id = Math.random().toString(36).slice(2,9)+Date.now().toString(36);
  await db.from("notifications").insert({ id, user_id:userId, type, from_id:fromId, from_name:fromName, content, link, read:false });
}

async function getNotifications(user) {
  const { data } = await db.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending:false }).limit(50);
  return ok(data || []);
}

async function markNotifsRead(user) {
  await db.from("notifications").update({ read:true }).eq("user_id", user.id);
  return ok({ done:true });
}

async function getUnreadCountNotifs(user) {
  const { count:friendCount } = await db.from("notifications").select("id", { count:"exact", head:true }).eq("user_id", user.id).eq("read", false);
  return ok({ count: friendCount || 0 });
}

// ─── Watchlog (perso sans liste) ─────────────────────────────────────────────
async function getWatchlog(user) {
  const { data } = await db.from("watchlog").select("*").eq("user_id", user.id).order("updated_at", { ascending:false });
  return ok(data || []);
}

async function addToWatchlog(user, body) {
  if (!body.title) return err("Title required");
  const item = {
    id: Math.random().toString(36).slice(2,9)+Date.now().toString(36),
    user_id: user.id,
    title: body.title,
    category: body.category || "film",
    status: body.status || "a_voir",
    poster_url: body.poster_url || "",
    tags: body.tags || [],
    rating: body.rating || 0,
    minutes: body.minutes || 0,
    season: body.season || 0,
    episode: body.episode || 0,
    notes: body.notes || "",
    tmdb_id: body.tmdb_id || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("watchlog").insert(item);
  if (error) return err(error.message, 500);
  return ok(item, 201);
}

async function updateWatchlogItem(user, id, body) {
  const { data } = await db.from("watchlog").select("user_id").eq("id", id).single();
  if (!data || data.user_id !== user.id) return unauthorized();
  const updates = { ...body, updated_at: new Date().toISOString() };
  delete updates.id; delete updates.user_id;
  await db.from("watchlog").update(updates).eq("id", id);
  return ok({ done:true });
}

async function deleteWatchlogItem(user, id) {
  const { data } = await db.from("watchlog").select("user_id").eq("id", id).single();
  if (!data || data.user_id !== user.id) return unauthorized();
  await db.from("watchlog").delete().eq("id", id);
  return ok({ deleted:true });
}

// ─── News ─────────────────────────────────────────────────────────────────────
async function getNews(query) {
  const page = Math.max(1, parseInt(query.page||"1"));
  const { data } = await db.from("news").select("*").order("created_at", { ascending:false }).range((page-1)*20, page*20-1);
  return ok(data || []);
}

async function createNewsItem(user, body) {
  if (!body.title?.trim() || !body.content?.trim()) return err("Title and content required");
  const item = {
    id: Math.random().toString(36).slice(2,9)+Date.now().toString(36),
    author_id: user.id, author_name: user.username,
    title: body.title.trim(), content: body.content.trim(),
    cover_url: body.cover_url || "",
    tags: body.tags || [],
    tmdb_id: body.tmdb_id || null,
  };
  await db.from("news").insert(item);
  return ok(item, 201);
}

async function likeNews(user, id) {
  await db.from("news").update({ likes: db.raw("likes + 1") }).eq("id", id);
  return ok({ done:true });
}

// ─── Home feed ────────────────────────────────────────────────────────────────
async function getHomeFeed(user) {
  // Get user profile for tag preferences
  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).single();
  // Get recent news
  const { data: recentNews } = await db.from("news").select("*").order("created_at", { ascending:false }).limit(10);
  // Get user watchlog for activity
  const { data: recentActivity } = await db.from("watchlog").select("title,poster_url,status,category,tags").eq("user_id", user.id).order("updated_at", { ascending:false }).limit(5);
  // Get friend activity (watchlog of friends)
  const { data: friendships } = await db.from("friendships").select("requester_id,addressee_id").eq("status","accepted").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  const friendIds = (friendships||[]).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
  let friendActivity = [];
  if (friendIds.length) {
    const { data } = await db.from("watchlog").select("user_id,title,poster_url,status,category,updated_at").in("user_id", friendIds).order("updated_at", { ascending:false }).limit(20);
    // Enrich with usernames
    const { data: friendProfiles } = await db.from("profiles").select("id,username,avatar_url").in("id", friendIds);
    friendActivity = (data||[]).map(a => ({ ...a, username: friendProfiles?.find(p=>p.id===a.user_id)?.username || "?", avatar_url: friendProfiles?.find(p=>p.id===a.user_id)?.avatar_url || "" }));
  }
  return ok({ news: recentNews||[], friendActivity, myActivity: recentActivity||[] });
}

// ─── Moderation ─────────────────────────────────────────────────────────────────
async function moderationAction(actor, { targetId, action, reason, newRole }) {
  const actorRole = await getGlobalRole(actor.id);
  if (!canModerate(actorRole)) return err("Insufficient permissions", 403);

  if (action === "role_change") {
    if (!canAdmin(actorRole)) return err("Only admins can change roles", 403);
    const validRoles = ["moderator","vip","user"];
    if (actorRole === "superadmin") validRoles.push("admin");
    if (!validRoles.includes(newRole)) return err("Invalid role");
    await db.from("profiles").update({ global_role: newRole }).eq("id", targetId);
  }

  // Log the action
  const { data: targetProfile } = await db.from("profiles").select("username").eq("id", targetId).single();
  await db.from("moderation_actions").insert({
    id: Math.random().toString(36).slice(2,9) + Date.now().toString(36),
    target_id: targetId,
    mod_id: actor.id,
    mod_name: actor.username,
    action,
    reason: reason || "",
  });

  return ok({ done: true, action, target: targetProfile?.username });
}

async function getModerationLog(actor) {
  const actorRole = await getGlobalRole(actor.id);
  if (!canModerate(actorRole)) return err("Insufficient permissions", 403);
  const { data } = await db.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(100);
  return ok(data || []);
}

async function deleteMessage(actor, msgId) {
  const actorRole = await getGlobalRole(actor.id);
  if (!canModerate(actorRole)) return err("Insufficient permissions", 403);
  await db.from("messages").delete().eq("id", msgId);
  return ok({ deleted: true });
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  const method = event.httpMethod;
  const rawPath = event.path
    .replace(/^\/.netlify\/functions\/api/, "")
    .replace(/^\/api/, "")
    .replace(/^\//, "");
  const segments = rawPath.split("/").filter(Boolean);
  const body = parseBody(event);
  const query = event.queryStringParameters || {};

  try {
    // ── Public ────────────────────────────────────────────────────────────────
    if (segments[0] === "auth") {
      if (method === "POST" && segments[1] === "register") return await register(body);
      if (method === "POST" && segments[1] === "login")    return await login(body);
      if (method === "POST" && segments[1] === "refresh")  return await refreshSession(body);
      if (method === "POST" && segments[1] === "forgot-password") return await forgotPassword(body);
      return notFound();
    }
    if (method === "GET" && segments[0] === "posters") return await searchPosters(query);

    // ── Protected ─────────────────────────────────────────────────────────────
    const user = await verifyToken(event.headers?.authorization || event.headers?.Authorization);
    if (!user) return unauthorized();

    // Profiles
    if (segments[0] === "profiles") {
      if (method === "GET"  && segments[1] === "search")          return await searchUsers(user, query.q);
      if (method === "GET"  && segments[1] && segments[2] === "public") return await getPublicProfile(segments[1]);
      if (method === "GET"  && segments[1])                       return await getProfile(segments[1]);
      if (method === "PUT"  && segments[1] === "me")              return await updateProfile(user, body);
    }

    // Moderation
    if (segments[0] === "mod") {
      if (method === "POST" && segments[1] === "action")          return await moderationAction(user, body);
      if (method === "GET"  && segments[1] === "log")             return await getModerationLog(user);
      if (method === "DELETE" && segments[1] === "message" && segments[2]) return await deleteMessage(user, segments[2]);
    }

    // Friends
    if (segments[0] === "friends") {
      if (method === "GET"  && segments.length === 1)            return await getFriends(user);
      if (method === "POST" && segments[1] === "request")        return await sendFriendRequest(user, body);
      if (method === "PUT"  && segments[1] && segments[2] === "accept") return await updateFriendship(user, segments[1], "accept");
      if (method === "PUT"  && segments[1] && segments[2] === "reject") return await updateFriendship(user, segments[1], "reject");
      if (method === "DELETE" && segments[1])                    return await updateFriendship(user, segments[1], "remove");
    }

    // DMs
    if (segments[0] === "dm") {
      const otherId = segments[1];
      if (!otherId) return notFound();
      if (method === "GET")  return await getDMs(user, otherId);
      if (method === "POST") return await sendDM(user, otherId, body);
      if (method === "PUT" && segments[2] === "read") return await markRead(user, otherId);
    }

    // Global chat
    if (segments[0] === "chat" && segments[1] === "global") {
      if (method === "GET")  return await getGlobalChat();
      if (method === "POST") return await sendGlobalMsg(user, body);
    }

    // Lists
    if (segments[0] === "lists") {
      if (method === "GET"  && segments.length === 1) return await getLists(user);
      if (method === "POST" && segments.length === 1) return await createList(user, body);
      if (method === "POST" && segments[1] === "join") return await joinList(user, body);

      const listId = segments[1]; if (!listId) return notFound();

      if (method === "PUT"  && segments.length === 2) return await renameList(user, listId, body);

      // Members
      if (segments[2] === "members") {
        const memberId = segments[3];
        if (method === "PUT"    && memberId) return await updateMemberRole(user, listId, memberId, body);
        if (method === "DELETE" && memberId) return await removeMember(user, listId, memberId);
      }

      // Items
      if (segments[2] === "items") {
        if (method === "GET"    && segments.length === 3) return await getItems(user, listId);
        if (method === "POST"   && segments.length === 3) return await createItem(user, listId, body);
        const itemId = segments[3]; if (!itemId) return notFound();
        if (method === "PUT")    return await updateItem(user, listId, itemId, body);
        if (method === "DELETE") return await deleteItemHandler(user, listId, itemId);
      }

      // Messages
      if (segments[2] === "messages") {
        if (method === "GET")  return await getMessages(user, listId, query);
        if (method === "POST") return await sendMessage(user, listId, body);
      }
    }

    // Notifications
    if (segments[0] === "notifications") {
      if (method === "GET" && segments.length === 1)          return await getNotifications(user);
      if (method === "PUT" && segments[1] === "read")         return await markNotifsRead(user);
      if (method === "GET" && segments[1] === "unread")       return await getUnreadCountNotifs(user);
    }

    // Watchlog
    if (segments[0] === "watchlog") {
      if (method === "GET"    && segments.length === 1)       return await getWatchlog(user);
      if (method === "POST"   && segments.length === 1)       return await addToWatchlog(user, body);
      if (method === "PUT"    && segments[1])                 return await updateWatchlogItem(user, segments[1], body);
      if (method === "DELETE" && segments[1])                 return await deleteWatchlogItem(user, segments[1]);
    }

    // News
    if (segments[0] === "news") {
      if (method === "GET"  && segments.length === 1)         return await getNews(query);
      if (method === "POST" && segments.length === 1)         return await createNewsItem(user, body);
      if (method === "POST" && segments[2] === "like")        return await likeNews(user, segments[1]);
    }

    // Home
    if (method === "GET" && segments[0] === "home")           return await getHomeFeed(user);

    return notFound();
  } catch (e) {
    console.error("API Error:", e);
    return err("Internal server error", 500);
  }
};
