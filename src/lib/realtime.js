import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function subscribeToItems(listId, cb) {
  const ch = supabase.channel(`items-${listId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `watchlist_id=eq.${listId}` }, cb)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeToMessages(listId, cb) {
  const ch = supabase.channel(`msgs-${listId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `watchlist_id=eq.${listId}` }, (p) => cb(p.new))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeToGlobalChat(cb) {
  const ch = supabase.channel("global-chat")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `watchlist_id=eq.__global__` }, (p) => cb(p.new))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeToDMs(userId, cb) {
  const ch = supabase.channel(`dm-${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${userId}` }, (p) => cb(p.new))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeToLists(cb) {
  const ch = supabase.channel("wl-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "watchlists" }, cb)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeToFriendships(userId, cb) {
  const ch = supabase.channel(`friends-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, cb)
    .subscribe();
  return () => supabase.removeChannel(ch);
}
