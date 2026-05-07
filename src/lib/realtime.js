import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function sub(channelName, table, event, filter, cb) {
  const opts = { event, schema: "public", table };
  if (filter) opts.filter = filter;
  const ch = supabase.channel(channelName)
    .on("postgres_changes", opts, payload => {
      if (payload?.new) cb(payload.new);
    })
    .subscribe(status => {
      if (import.meta.env.DEV) console.log(`[rt] ${channelName}: ${status}`);
    });
  return () => supabase.removeChannel(ch);
}

// List messages (filter by watchlist_id)
export function subscribeToMessages(listId, cb) {
  return sub(`msgs-${listId}`, "messages", "INSERT", `watchlist_id=eq.${listId}`, cb);
}

// Global chat — NO filter (fetch all, filter client-side to avoid __global__ encoding issues)
export function subscribeToGlobalChat(cb) {
  return sub("global-chat-all", "messages", "INSERT", null, msg => {
    if (msg.watchlist_id === "__global__") cb(msg);
  });
}

// Direct messages
export function subscribeToDMs(userId, cb) {
  return sub(`dm-${userId}`, "direct_messages", "INSERT", `receiver_id=eq.${userId}`, cb);
}

// Item changes in a list
export function subscribeToItems(listId, cb) {
  const ch = supabase.channel(`items-${listId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `watchlist_id=eq.${listId}` }, cb)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// Watchlist changes (membership, rename, etc.)
export function subscribeToLists(cb) {
  const ch = supabase.channel("wl-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "watchlists" }, cb)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// Friendship changes
export function subscribeToFriendships(userId, cb) {
  return sub(`friends-${userId}`, "friendships", "*", null, cb);
}

// Notifications
export function subscribeToNotifications(userId, cb) {
  return sub(`notifs-${userId}`, "notifications", "INSERT", `user_id=eq.${userId}`, cb);
}
