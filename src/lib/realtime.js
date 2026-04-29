import { createClient } from "@supabase/supabase-js";

// Anon client — ONLY used for realtime subscriptions, not for DB writes
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function subscribeToItems(listId, onUpdate) {
  const ch = supabase.channel(`items-${listId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "items",
      filter: `watchlist_id=eq.${listId}`,
    }, onUpdate)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeToMessages(listId, onInsert) {
  const ch = supabase.channel(`messages-${listId}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "messages",
      filter: `watchlist_id=eq.${listId}`,
    }, (payload) => onInsert(payload.new))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeToLists(onUpdate) {
  const ch = supabase.channel("watchlists-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "watchlists" }, onUpdate)
    .subscribe();
  return () => supabase.removeChannel(ch);
}
