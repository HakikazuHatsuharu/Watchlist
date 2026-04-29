export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

export const ok = (data, status = 200) => ({
  statusCode: status,
  headers: CORS,
  body: JSON.stringify(data),
});

export const err = (message, status = 400) => ({
  statusCode: status,
  headers: CORS,
  body: JSON.stringify({ error: message }),
});

export const unauthorized = () => err("Unauthorized", 401);
export const notFound = () => err("Not found", 404);

export function parseBody(event) {
  try { return JSON.parse(event.body || "{}"); }
  catch { return {}; }
}

// Simple router: matches method + path segments
// path like "/lists/abc123/items"  → segments ["lists", "abc123", "items"]
export function route(method, segments, routes) {
  for (const [pattern, handler] of routes) {
    const [patMethod, ...patSegs] = pattern.split(" ");
    if (patMethod !== method && patMethod !== "*") continue;
    if (patSegs.length !== segments.length) continue;
    const params = {};
    const match = patSegs.every((seg, i) => {
      if (seg.startsWith(":")) { params[seg.slice(1)] = segments[i]; return true; }
      return seg === segments[i];
    });
    if (match) return handler(params);
  }
  return null;
}
