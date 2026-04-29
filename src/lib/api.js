// All calls go through our backend. No Supabase keys in frontend.
const BASE = "/api";

// ─── Session management ───────────────────────────────────────────────────────
function getToken() { return localStorage.getItem("wl_token"); }
function getRefreshToken() { return localStorage.getItem("wl_refresh"); }
export function saveSession(token, refreshToken) {
  localStorage.setItem("wl_token", token);
  if (refreshToken) localStorage.setItem("wl_refresh", refreshToken);
}
export function clearSession() {
  localStorage.removeItem("wl_token");
  localStorage.removeItem("wl_refresh");
  localStorage.removeItem("wl_user");
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem("wl_user") || "null"); } catch { return null; }
}
export function saveUser(user) { localStorage.setItem("wl_user", JSON.stringify(user)); }

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function apiFetch(path, options = {}, retry = true) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch(path, options, false);
    clearSession();
    window.dispatchEvent(new Event("wl:logout"));
    throw new Error("Session expired");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function tryRefresh() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const data = await apiFetch("/auth/refresh", { method: "POST", body: { refreshToken: rt } }, false);
    saveSession(data.token, data.refreshToken);
    return true;
  } catch { return false; }
}

const get = (path, query) => {
  const qs = query ? "?" + new URLSearchParams(query).toString() : "";
  return apiFetch(path + qs);
};
const post = (path, body) => apiFetch(path, { method: "POST", body });
const put = (path, body) => apiFetch(path, { method: "PUT", body });
const del = (path) => apiFetch(path, { method: "DELETE" });

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function register(username, password) {
  const data = await post("/auth/register", { username, password });
  saveSession(data.token, data.refreshToken);
  saveUser(data.user);
  return data.user;
}
export async function login(username, password) {
  const data = await post("/auth/login", { username, password });
  saveSession(data.token, data.refreshToken);
  saveUser(data.user);
  return data.user;
}
export function logout() {
  clearSession();
  window.dispatchEvent(new Event("wl:logout"));
}

// ─── Lists ────────────────────────────────────────────────────────────────────
export const getLists = () => get("/lists");
export const createList = (name) => post("/lists", { name });
export const joinList = (code) => post("/lists/join", { code });

// ─── Items ────────────────────────────────────────────────────────────────────
export const getItems = (listId) => get(`/lists/${listId}/items`);
export const createItem = (listId, item) => post(`/lists/${listId}/items`, item);
export const updateItem = (listId, itemId, updates) => put(`/lists/${listId}/items/${itemId}`, updates);
export const deleteItem = (listId, itemId) => del(`/lists/${listId}/items/${itemId}`);

// ─── Messages ─────────────────────────────────────────────────────────────────
export const getMessages = (listId, params) => get(`/lists/${listId}/messages`, params);
export const sendMessage = (listId, content) => post(`/lists/${listId}/messages`, { content });

// ─── Poster search (via backend proxy) ───────────────────────────────────────
export const searchPosters = (title, category) => get("/posters", { title, category });

// ─── Supabase realtime (read-only subscription, anon key only) ───────────────
export function createRealtimeClient() {
  const { createClient } = window.__supabaseModule;
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}
