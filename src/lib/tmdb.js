// ─── TMDB API (free, no key needed via public proxy) ─────────────────────────
// On utilise l'API TMDB avec une clé publique read-only
// Si pas de clé dispo, fallback sur iTunes + TVMaze

const TMDB_KEY = import.meta.env.VITE_TMDB_KEY || "";
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export async function searchTMDB(query, type = "multi") {
  if (!query?.trim()) return [];
  try {
    // Try TMDB first if key available
    if (TMDB_KEY) {
      const url = `${TMDB}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=fr-FR&page=1`;
      const r = await fetch(url);
      const d = await r.json();
      return (d.results || []).slice(0, 12).map(item => ({
        tmdb_id: item.id,
        title: item.title || item.name,
        poster_url: item.poster_path ? `${IMG}/w500${item.poster_path}` : "",
        backdrop_url: item.backdrop_path ? `${IMG}/w780${item.backdrop_path}` : "",
        overview: item.overview || "",
        category: item.media_type === "tv" ? "serie" : "film",
        year: (item.release_date || item.first_air_date || "").slice(0, 4),
        rating: item.vote_average ? Math.round(item.vote_average / 2 * 10) / 10 : 0,
      }));
    }
    // Fallback: iTunes + TVMaze
    return await fallbackSearch(query);
  } catch {
    return await fallbackSearch(query);
  }
}

export async function getTMDBTrending(type = "all") {
  if (!TMDB_KEY) return [];
  try {
    const r = await fetch(`${TMDB}/trending/${type}/week?api_key=${TMDB_KEY}&language=fr-FR`);
    const d = await r.json();
    return (d.results || []).slice(0, 20).map(item => ({
      tmdb_id: item.id,
      title: item.title || item.name,
      poster_url: item.poster_path ? `${IMG}/w500${item.poster_path}` : "",
      backdrop_url: item.backdrop_path ? `${IMG}/w780${item.backdrop_path}` : "",
      overview: item.overview || "",
      category: item.media_type === "tv" ? "serie" : "film",
      year: (item.release_date || item.first_air_date || "").slice(0, 4),
      rating: item.vote_average ? Math.round(item.vote_average / 2 * 10) / 10 : 0,
    }));
  } catch { return []; }
}

async function fallbackSearch(query) {
  const results = [];
  try {
    const [r1, r2, r3] = await Promise.allSettled([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=movie&limit=6&country=fr`).then(r => r.json()),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=tvShow&limit=4&country=fr`).then(r => r.json()),
      fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`).then(r => r.json()),
    ]);
    if (r1.status === "fulfilled") {
      for (const item of r1.value.results || []) {
        if (item.artworkUrl100) results.push({
          title: item.trackName || item.collectionName,
          poster_url: item.artworkUrl100.replace("100x100bb", "600x900bb"),
          category: "film",
          year: item.releaseDate?.slice(0, 4) || "",
          overview: item.longDescription || item.shortDescription || "",
        });
      }
    }
    if (r2.status === "fulfilled") {
      for (const item of r2.value.results || []) {
        if (item.artworkUrl100) results.push({
          title: item.collectionName || item.trackName,
          poster_url: item.artworkUrl100.replace("100x100bb", "600x900bb"),
          category: "serie",
          year: item.releaseDate?.slice(0, 4) || "",
          overview: item.longDescription || "",
        });
      }
    }
    if (r3.status === "fulfilled") {
      for (const item of r3.value || []) {
        const img = item.show?.image?.original || item.show?.image?.medium;
        if (img) results.push({
          title: item.show.name,
          poster_url: img,
          category: "serie",
          year: item.show.premiered?.slice(0, 4) || "",
          overview: (item.show.summary || "").replace(/<[^>]+>/g, ""),
        });
      }
    }
  } catch {}
  return results.slice(0, 12);
}
