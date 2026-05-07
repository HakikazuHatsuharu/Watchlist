import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  }
);

// ─── Debug helper ─────────────────────────────────────────────────────────────
function makeCh(name, table, filter, event, cb) {
  const config = { event, schema: "public", table };
  if (filter) config.filter = filter;
  const ch = supabase.channel(name)
    .on("postgres_changes", config, (p) => {
      cb(p.new || p);
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn(`[realtime] channel error on ${name}`);
      }
    });
  return () => supabase.removeChannel(ch);
}

export function subscribeToMessages(listId, cb) {
  return makeCh(`msgs-${listId}`, "messages", `watchlist_id=eq.${listId}`, "INSERT", cb);
}

export function subscribeToGlobalChat(cb) {
  return makeCh("global-chat", "messages", `watchlist_id=eq.__global__`, "INSERT", cb);
}

export function subscribeToDMs(userId, cb) {
  return makeCh(`dm-${userId}`, "direct_messages", `receiver_id=eq.${userId}`, "INSERT", cb);
}

export function subscribeToItems(listId, cb) {
  return makeCh(`items-${listId}`, "items", `watchlist_id=eq.${listId}`, "*", cb);
}

export function subscribeToLists(cb) {
  return makeCh("wl-changes", "watchlists", null, "*", cb);
}

export function subscribeToFriendships(userId, cb) {
  return makeCh(`friends-${userId}`, "friendships", null, "*", cb);
}

export function subscribeToNotifications(userId, cb) {
  return makeCh(`notifs-${userId}`, "notifications", `user_id=eq.${userId}`, "INSERT", cb);
}
