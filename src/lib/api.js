const BASE = "/api";

// ─── Session ──────────────────────────────────────────────────────────────────
export const getToken = () => localStorage.getItem("wl_token");
export const getRefreshToken = () => localStorage.getItem("wl_refresh");
export const saveSession = (t, r) => { localStorage.setItem("wl_token", t); if (r) localStorage.setItem("wl_refresh", r); };
export const clearSession = () => { localStorage.removeItem("wl_token"); localStorage.removeItem("wl_refresh"); localStorage.removeItem("wl_user"); };
export const getUser = () => { try { return JSON.parse(localStorage.getItem("wl_user") || "null"); } catch { return null; } };
export const saveUser = (u) => localStorage.setItem("wl_user", JSON.stringify(u));

// ─── Fetch core ───────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}, retry = true) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 && retry) {
    const ok = await tryRefresh();
    if (ok) return apiFetch(path, options, false);
    clearSession(); window.dispatchEvent(new Event("wl:logout")); throw new Error("Session expired");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function tryRefresh() {
  const rt = getRefreshToken(); if (!rt) return false;
  try { const d = await apiFetch("/auth/refresh", { method: "POST", body: { refreshToken: rt } }, false); saveSession(d.token, d.refreshToken); return true; }
  catch { return false; }
}

const get  = (path, q) => apiFetch(path + (q ? "?" + new URLSearchParams(q) : ""));
const post = (path, b) => apiFetch(path, { method: "POST",   body: b });
const put  = (path, b) => apiFetch(path, { method: "PUT",    body: b });
const del  = (path)    => apiFetch(path, { method: "DELETE" });

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function register(username, email, password) {
  const d = await post("/auth/register", { username, email, password });
  saveSession(d.token, d.refreshToken); saveUser(d.user); return d.user;
}
export async function login(username, password) {
  const d = await post("/auth/login", { username, password });
  saveSession(d.token, d.refreshToken); saveUser(d.user); return d.user;
}
export const forgotPassword = (email) => post("/auth/forgot-password", { email });
export const logout = () => { clearSession(); window.dispatchEvent(new Event("wl:logout")); };

// ─── Profiles ─────────────────────────────────────────────────────────────────
export const getProfile     = (id) => get(`/profiles/${id}`);
export const updateProfile  = (data) => put("/profiles/me", data);
export const searchUsers    = (q) => get("/profiles/search", { q });

// ─── Friends ──────────────────────────────────────────────────────────────────
export const getFriends       = () => get("/friends");
export const sendFriendReq    = (addresseeId) => post("/friends/request", { addresseeId });
export const acceptFriend     = (id) => put(`/friends/${id}/accept`);
export const rejectFriend     = (id) => put(`/friends/${id}/reject`);
export const removeFriend     = (id) => del(`/friends/${id}`);

// ─── Direct messages ──────────────────────────────────────────────────────────
export const getDMs    = (userId) => get(`/dm/${userId}`);
export const sendDM    = (userId, content) => post(`/dm/${userId}`, { content });
export const markRead  = (userId) => put(`/dm/${userId}/read`);

// ─── Lists ────────────────────────────────────────────────────────────────────
export const getLists    = () => get("/lists");
export const createList  = (name) => post("/lists", { name });
export const joinList    = (code) => post("/lists/join", { code });
export const renameList  = (id, name) => put(`/lists/${id}`, { name });
export const updateMemberRole = (listId, userId, role) => put(`/lists/${listId}/members/${userId}`, { role });
export const removeMember     = (listId, userId) => del(`/lists/${listId}/members/${userId}`);

// ─── Items ────────────────────────────────────────────────────────────────────
export const getItems    = (listId) => get(`/lists/${listId}/items`);
export const createItem  = (listId, item) => post(`/lists/${listId}/items`, item);
export const updateItem  = (listId, itemId, updates) => put(`/lists/${listId}/items/${itemId}`, updates);
export const deleteItem  = (listId, itemId) => del(`/lists/${listId}/items/${itemId}`);

// ─── Messages (list chat + global) ───────────────────────────────────────────
export const getMessages    = (listId, p) => get(`/lists/${listId}/messages`, p);
export const sendMessage    = (listId, content) => post(`/lists/${listId}/messages`, { content });
export const getGlobalChat  = () => get("/chat/global");
export const sendGlobalMsg  = (content) => post("/chat/global", { content });

// ─── Poster search ────────────────────────────────────────────────────────────
export const searchPosters = (title, category) => get("/posters", { title, category });

// ─── Public profiles ──────────────────────────────────────────────────────────
export const getPublicProfile = (id) => get(`/profiles/${id}/public`);

// ─── Moderation ───────────────────────────────────────────────────────────────
export const modAction      = (data) => post("/mod/action", data);
export const getModerationLog = () => get("/mod/log");
export const deleteGlobalMsg  = (msgId) => del(`/mod/message/${msgId}`);

// ─── Watchlog (perso, sans liste) ─────────────────────────────────────────────
export const getWatchlog     = () => get("/watchlog");
export const addToWatchlog   = (item) => post("/watchlog", item);
export const updateWatchlog  = (id, data) => put(`/watchlog/${id}`, data);
export const deleteWatchlog  = (id) => del(`/watchlog/${id}`);

// ─── Notifications ────────────────────────────────────────────────────────────
export const getNotifications   = () => get("/notifications");
export const markNotifsRead     = () => put("/notifications/read");
export const getUnreadCount     = () => get("/notifications/unread");

// ─── News ─────────────────────────────────────────────────────────────────────
export const getNews     = (page=1) => get("/news", { page });
export const createNews  = (data) => post("/news", data);
export const likeNews    = (id) => post(`/news/${id}/like`);

// ─── Home feed (trending + perso) ────────────────────────────────────────────
export const getHomeFeed = () => get("/home");
