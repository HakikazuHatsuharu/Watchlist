export const C = {
  bg: "#0b0b18", surface: "#111128", card: "#181830", border: "rgba(255,255,255,0.07)",
  gold: "#C9A84C", blue: "#60A5FA", text: "#F0EBE0", muted: "#5C6070",
  success: "#10B981", warning: "#F59E0B", danger: "#F87171", purple: "#A78BFA",
};

export const AV_COLORS = ["#C9A84C","#60A5FA","#A78BFA","#10B981","#F87171","#FB923C","#F472B6"];

export const IS = {
  background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "8px 10px", color: C.text, fontSize: 13, boxSizing: "border-box",
  outline: "none", fontFamily: "inherit", width: "100%",
};
export const BP = {
  background: C.gold, color: "#0b0b18", border: "none", borderRadius: 8,
  padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit", whiteSpace: "nowrap",
};
export const BS = {
  background: "transparent", color: C.muted, border: `1px solid rgba(255,255,255,0.12)`,
  borderRadius: 8, padding: "9px 18px", fontSize: 13, cursor: "pointer",
  fontFamily: "inherit", whiteSpace: "nowrap",
};
export const LB = {
  display: "block", fontSize: 10, color: C.muted, marginBottom: 4,
  letterSpacing: 0.8, textTransform: "uppercase",
};

export const ROLES = {
  owner:     { label: "👑 Owner",     color: "#C9A84C", level: 4 },
  admin:     { label: "⚡ Admin",     color: "#F87171", level: 3 },
  moderator: { label: "🛡 Modo",      color: "#60A5FA", level: 2 },
  member:    { label: "👤 Membre",    color: "#5C6070", level: 1 },
};

export const BADGES = [
  { min: 730, icon: "👑", label: "Légende",   color: "#C9A84C" },
  { min: 365, icon: "💎", label: "Vétéran",   color: "#A78BFA" },
  { min: 180, icon: "🔥", label: "Passionné", color: "#F87171" },
  { min: 30,  icon: "⭐", label: "Régulier",  color: "#60A5FA" },
  { min: 0,   icon: "🌱", label: "Nouveau",   color: "#10B981" },
];

export function getBadge(createdAt) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  return BADGES.find(b => days >= b.min) || BADGES[BADGES.length - 1];
}

export function genId() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
export function genCode() { return Math.random().toString(36).slice(2,8).toUpperCase(); }

export function gravatarUrl(email, size = 80) {
  if (!email) return "";
  // Simple hash using btoa as a fallback (not real MD5, but works for UI)
  const encoded = encodeURIComponent(email.trim().toLowerCase());
  return `https://gravatar.com/avatar/${encoded}?s=${size}&d=identicon`;
}


// ─── Global app roles ────────────────────────────────────────────────────────
export const GLOBAL_ROLES = {
  superadmin: { label: "👑 Super Admin", color: "#C9A84C", level: 5, bg: "rgba(201,168,76,0.15)" },
  admin:      { label: "⚡ Admin",       color: "#F87171", level: 4, bg: "rgba(248,113,113,0.12)" },
  moderator:  { label: "🛡 Modérateur",  color: "#60A5FA", level: 3, bg: "rgba(96,165,250,0.12)" },
  vip:        { label: "💎 VIP",         color: "#A78BFA", level: 2, bg: "rgba(167,139,250,0.12)" },
  user:       { label: "",               color: "#5C6070", level: 1, bg: "transparent" },
};

export function canModerate(globalRole) {
  return ["superadmin","admin","moderator"].includes(globalRole);
}
export function canAdmin(globalRole) {
  return ["superadmin","admin"].includes(globalRole);
}
export function isSuperAdmin(globalRole) {
  return globalRole === "superadmin";
}
