import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "./lib/api";
import { subscribeToItems, subscribeToLists, subscribeToMessages } from "./lib/realtime";
import { t } from "./lib/i18n";

// ─── Utils ────────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0b0b18", surface: "#111128", card: "#181830", border: "rgba(255,255,255,0.07)",
  gold: "#C9A84C", blue: "#60A5FA", text: "#F0EBE0", muted: "#5C6070",
  success: "#10B981", warning: "#F59E0B", danger: "#F87171",
};
const getStatus = (lang) => ({
  a_voir: { label: t(lang, "to_watch"), color: C.muted },
  en_cours: { label: t(lang, "watching"), color: C.warning },
  termine: { label: t(lang, "watched"), color: C.success },
});
const AV_COLORS = ["#C9A84C", "#60A5FA", "#A78BFA", "#10B981", "#F87171", "#FB923C", "#F472B6"];
const IS = { background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "inherit", width: "100%" };
const BP = { background: C.gold, color: "#0b0b18", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" };
const BS = { background: "transparent", color: C.muted, border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 8, padding: "9px 18px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" };
const LB = { display: "block", fontSize: 10, color: C.muted, marginBottom: 4, letterSpacing: 0.8, textTransform: "uppercase" };

// ─── Micro components ─────────────────────────────────────────────────────────
function Stars({ value = 0, onChange, size = 16 }) {
  const [hov, setHov] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} onClick={() => onChange && onChange(n === value ? 0 : n)}
          onMouseEnter={() => onChange && setHov(n)} onMouseLeave={() => onChange && setHov(0)}
          style={{ fontSize: size, cursor: onChange ? "pointer" : "default", color: (hov || value) >= n ? C.gold : "rgba(255,255,255,0.12)", transition: "color 0.1s", lineHeight: 1, userSelect: "none" }}>★</span>
      ))}
    </div>
  );
}

function Avatar({ username, index = 0, size = 24 }) {
  const color = AV_COLORS[index % AV_COLORS.length];
  return (
    <div title={username} style={{ width: size, height: size, borderRadius: "50%", background: `${color}18`, border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 700, color, flexShrink: 0 }}>
      {username[0].toUpperCase()}
    </div>
  );
}

function TagInput({ tags = [], onChange, lang }) {
  const [input, setInput] = useState("");
  const add = () => { const tg = input.trim().toLowerCase(); if (tg && !tags.includes(tg)) onChange([...tags, tg]); setInput(""); };
  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {tags.map((tg) => (
            <span key={tg} style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.22)", borderRadius: 99, padding: "2px 8px", fontSize: 11, color: C.gold, display: "flex", alignItems: "center", gap: 4 }}>
              #{tg}<span onClick={() => onChange(tags.filter((x) => x !== tg))} style={{ cursor: "pointer", opacity: 0.5, fontSize: 14, lineHeight: 1 }}>×</span>
            </span>
          ))}
        </div>
      )}
      <input value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        placeholder={t(lang, "tags_placeholder")} style={IS} />
    </div>
  );
}

function FBtn({ label, active, color, onClick }) {
  const c = color || C.gold;
  return <button onClick={onClick} style={{ background: active ? `${c}18` : "transparent", border: `1px solid ${active ? `${c}50` : C.border}`, borderRadius: 99, padding: "4px 11px", fontSize: 11, color: active ? c : C.muted, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s" }}>{label}</button>;
}

function LangToggle({ lang, setLang }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {["fr", "en"].map((l) => (
        <button key={l} onClick={() => setLang(l)} style={{ flex: 1, background: lang === l ? `${C.gold}18` : "transparent", border: `1px solid ${lang === l ? C.gold : C.border}`, borderRadius: 6, padding: "3px 0", fontSize: 11, color: lang === l ? C.gold : C.muted, cursor: "pointer", fontFamily: "inherit" }}>
          {l === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
        </button>
      ))}
    </div>
  );
}

// ─── Poster Picker ────────────────────────────────────────────────────────────
function PosterPicker({ title, category, currentUrl, onSelect, lang }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showGrid, setShowGrid] = useState(false);
  const fileRef = useRef();

  const doSearch = async () => {
    if (!title.trim()) return;
    setLoading(true); setErr(""); setShowGrid(false);
    try {
      const res = await api.searchPosters(title, category);
      if (!res.length) { setErr(t(lang, "poster_not_found")); }
      else { setResults(res); setShowGrid(true); }
    } catch { setErr(t(lang, "poster_not_found")); }
    setLoading(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 1_200_000) { setErr(t(lang, "image_too_large")); return; }
    const reader = new FileReader();
    reader.onload = () => { onSelect(reader.result); setShowGrid(false); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div>
      <label style={LB}>{t(lang, "poster")}</label>
      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        {/* Preview */}
        <div style={{ width: 72, height: 104, borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {currentUrl
            ? <img src={currentUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => onSelect("")} />
            : <span style={{ fontSize: 26, opacity: 0.15 }}>{category === "film" ? "🎬" : "📺"}</span>}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
          <button onClick={() => fileRef.current?.click()} style={{ ...BS, fontSize: 12, padding: "7px 10px", textAlign: "left" }}>
            📁 {t(lang, "poster_upload")}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={doSearch} disabled={loading || !title.trim()} style={{ ...BS, fontSize: 12, padding: "7px 10px", textAlign: "left", opacity: (loading || !title.trim()) ? 0.5 : 1 }}>
            {loading ? t(lang, "poster_searching") : t(lang, "poster_search")}
          </button>
          <input onChange={(e) => onSelect(e.target.value)} defaultValue={currentUrl?.startsWith("http") ? currentUrl : ""}
            placeholder="https://…" style={{ ...IS, fontSize: 11 }} />
        </div>
      </div>
      {err && <p style={{ fontSize: 11, color: C.danger, margin: "0 0 8px" }}>⚠ {err}</p>}
      {showGrid && results.length > 0 && (
        <div>
          <p style={{ margin: "0 0 7px", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{t(lang, "poster_choose")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))", gap: 7 }}>
            {results.map((r, i) => (
              <div key={i} onClick={() => { onSelect(r.url); setShowGrid(false); }} title={r.label}
                style={{ cursor: "pointer", borderRadius: 6, overflow: "hidden", aspectRatio: "2/3", background: "rgba(255,255,255,0.04)", border: `2px solid ${currentUrl === r.url ? C.gold : "transparent"}` }}>
                <img src={r.url} alt={r.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => e.currentTarget.parentElement.style.display = "none"} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
function ChatPanel({ listId, user, members, lang, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef();

  useEffect(() => {
    api.getMessages(listId).then((msgs) => { setMessages(msgs); setLoading(false); });
    const unsub = subscribeToMessages(listId, (msg) => setMessages((p) => [...p, msg]));
    return unsub;
  }, [listId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const content = input.trim(); if (!content) return;
    setInput("");
    try { await api.sendMessage(listId, content); } catch { /* realtime will update */ }
  };

  const memberIdx = (uid) => members.findIndex((m) => m.id === uid);

  // Group consecutive messages from same user
  const groups = messages.reduce((acc, msg) => {
    const last = acc[acc.length - 1];
    if (last && last.user_id === msg.user_id && Date.parse(msg.created_at) - Date.parse(last.items[last.items.length - 1].created_at) < 120000)
      last.items.push(msg);
    else acc.push({ user_id: msg.user_id, username: msg.username, items: [msg] });
    return acc;
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "flex-end", zIndex: 300 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 380, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", height: "100vh" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontFamily: "'Playfair Display',serif", color: C.text }}>{t(lang, "chat_title")}</h3>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>{members.map((m, i) => <Avatar key={m.id} username={m.username} index={i} size={18} />)}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px" }}>
          {loading && <p style={{ textAlign: "center", color: C.muted, fontSize: 13 }}>…</p>}
          {!loading && messages.length === 0 && <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 40 }}>{t(lang, "no_messages")}</p>}
          {groups.map((grp, gi) => {
            const isMe = grp.user_id === user.id;
            const idx = memberIdx(grp.user_id);
            const color = AV_COLORS[Math.max(idx, 0) % AV_COLORS.length];
            return (
              <div key={gi} style={{ marginBottom: 14, display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Avatar username={grp.username} index={Math.max(idx, 0)} size={18} />
                    <span style={{ fontSize: 11, color, fontWeight: 600 }}>{grp.username}</span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: isMe ? "flex-end" : "flex-start" }}>
                  {grp.items.map((msg) => (
                    <div key={msg.id} style={{ background: isMe ? `${C.gold}20` : "rgba(255,255,255,0.06)", border: `1px solid ${isMe ? `${C.gold}35` : C.border}`, borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "7px 12px", fontSize: 13, color: C.text, maxWidth: 240, wordBreak: "break-word", lineHeight: 1.45 }}>
                      {msg.content}
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                  {new Date(grp.items[grp.items.length - 1].created_at).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder={t(lang, "message_placeholder")} style={{ ...IS, flex: 1 }} />
          <button onClick={send} style={{ ...BP, padding: "9px 14px" }}>{t(lang, "send")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, lang, setLang }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setError(""); setSuccess(""); };

  const submit = async () => {
    if (mode === "forgot") {
      if (!email.trim()) { setError(t(lang, "email_required")); return; }
      setError(""); setLoading(true);
      try {
        await api.forgotPassword(email.trim());
        setSuccess(t(lang, "reset_sent"));
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
      return;
    }
    if (!username.trim() || !password) { setError(t(lang, "fill_fields")); return; }
    if (mode === "register" && !email.trim()) { setError(t(lang, "email_required")); return; }
    setError(""); setLoading(true);
    try {
      const user = mode === "register"
        ? await api.register(username.trim(), email.trim(), password)
        : await api.login(username.trim(), password);
      onLogin(user);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "fixed", top: 16, right: 16 }}><LangToggle lang={lang} setLang={setLang} /></div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 360 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>🎞</div>
          <h1 style={{ margin: "0 0 4px", fontFamily: "'Playfair Display',serif", fontSize: 24, background: `linear-gradient(90deg,${C.gold},#F5D688)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Watchlist</h1>
          <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>
            {mode === "login" ? t(lang, "tagline_login") : mode === "register" ? t(lang, "tagline_register") : t(lang, "forgot_desc")}
          </p>
        </div>

        {/* Forgot password form */}
        {mode === "forgot" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={LB}>{t(lang, "email")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} style={IS} placeholder={t(lang, "email_placeholder")} autoFocus />
            </div>
            {error && <p style={{ color: C.danger, fontSize: 12, margin: 0, background: "rgba(248,113,113,0.08)", padding: "7px 10px", borderRadius: 8 }}>⚠ {error}</p>}
            {success && <p style={{ color: C.success, fontSize: 12, margin: 0, background: "rgba(16,185,129,0.08)", padding: "7px 10px", borderRadius: 8 }}>✓ {success}</p>}
            {!success && (
              <button onClick={submit} disabled={loading} style={{ ...BP, width: "100%", opacity: loading ? 0.7 : 1 }}>
                {loading ? "…" : t(lang, "send_reset")}
              </button>
            )}
            <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 4, marginBottom: 0 }}>
              <span onClick={() => { setMode("login"); reset(); }} style={{ color: C.gold, cursor: "pointer", fontWeight: 600 }}>
                ← {t(lang, "back_to_login")}
              </span>
            </p>
          </div>
        ) : (
          /* Login / Register form */
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={LB}>{t(lang, "username")}</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} style={IS} placeholder="ex: alice" autoFocus />
              </div>
              {mode === "register" && (
                <div><label style={LB}>{t(lang, "email")}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={IS} placeholder={t(lang, "email_placeholder")} />
                </div>
              )}
              <div><label style={LB}>{t(lang, "password")}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} style={IS} placeholder="••••••••" />
              </div>
              {error && <p style={{ color: C.danger, fontSize: 12, margin: 0, background: "rgba(248,113,113,0.08)", padding: "7px 10px", borderRadius: 8 }}>⚠ {error}</p>}
              <button onClick={submit} disabled={loading} style={{ ...BP, width: "100%", marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                {loading ? "…" : mode === "login" ? t(lang, "login") : t(lang, "register")}
              </button>
            </div>

            {mode === "login" && (
              <p style={{ textAlign: "center", fontSize: 12, marginTop: 10, marginBottom: 0 }}>
                <span onClick={() => { setMode("forgot"); reset(); }} style={{ color: C.muted, cursor: "pointer", textDecoration: "underline" }}>
                  {t(lang, "forgot_password")}
                </span>
              </p>
            )}

            <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 14, marginBottom: 0 }}>
              {mode === "login" ? t(lang, "no_account") + " " : t(lang, "has_account") + " "}
              <span onClick={() => { setMode(mode === "login" ? "register" : "login"); reset(); }} style={{ color: C.gold, cursor: "pointer", fontWeight: 600 }}>
                {mode === "login" ? t(lang, "register") : t(lang, "login")}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Item Modal ───────────────────────────────────────────────────────────────
function ItemModal({ item, user, listId, onSaved, onClose, lang }) {
  const blank = { title: "", category: "film", tags: [], poster_url: "", user_progress: {} };
  const [form, setForm] = useState(item ? { ...item } : blank);
  const [saving, setSaving] = useState(false);
  const STATUS = getStatus(lang);

  const myProg = form.user_progress[user.id] || { status: "a_voir", minutes: "", season: "", episode: "", rating: 0 };
  const setMyProg = (k, v) => setForm((f) => ({ ...f, user_progress: { ...f.user_progress, [user.id]: { ...myProg, [k]: v } } }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isFilm = form.category === "film";
  const statusMeta = STATUS[myProg.status] || STATUS.a_voir;

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      let saved;
      if (item?.id) {
        saved = await api.updateItem(listId, item.id, form);
      } else {
        saved = await api.createItem(listId, form);
      }
      onSaved(saved);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16, overflowY: "auto" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 520, boxSizing: "border-box", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ margin: "0 0 18px", fontSize: 17, fontFamily: "'Playfair Display',serif", color: C.text }}>{item ? t(lang, "edit_title") : t(lang, "add_title")}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={LB}>{t(lang, "title_field")}</label><input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t(lang, "title_placeholder")} style={IS} autoFocus /></div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={LB}>{t(lang, "category")}</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} style={IS}>
                <option value="film">{t(lang, "film")}</option>
                <option value="serie">{t(lang, "serie")}</option>
              </select>
            </div>
            <div><label style={LB}>{t(lang, "my_status")}</label>
              <select value={myProg.status} onChange={(e) => setMyProg("status", e.target.value)} style={{ ...IS, color: statusMeta.color }}>
                <option value="a_voir">{t(lang, "to_watch")}</option>
                <option value="en_cours">{t(lang, "watching")}</option>
                <option value="termine">{t(lang, "watched")}</option>
              </select>
            </div>
          </div>

          {myProg.status === "en_cours" && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 13 }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{t(lang, "my_progress")}</p>
              {isFilm ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" min="0" value={myProg.minutes} onChange={(e) => setMyProg("minutes", e.target.value)} placeholder="25" style={{ ...IS, width: 80 }} />
                  <span style={{ color: C.muted, fontSize: 13 }}>{t(lang, "minutes")}</span>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><label style={LB}>{t(lang, "season")}</label><input type="number" min="1" value={myProg.season} onChange={(e) => setMyProg("season", e.target.value)} placeholder="1" style={IS} /></div>
                  <div><label style={LB}>{t(lang, "episode")}</label><input type="number" min="1" value={myProg.episode} onChange={(e) => setMyProg("episode", e.target.value)} placeholder="1" style={IS} /></div>
                </div>
              )}
            </div>
          )}

          {myProg.status === "termine" && (
            <div><label style={LB}>{t(lang, "my_rating")}</label><Stars value={myProg.rating || 0} onChange={(v) => setMyProg("rating", v)} size={24} /></div>
          )}

          <div><label style={LB}>{t(lang, "tags")}</label><TagInput tags={form.tags || []} onChange={(v) => set("tags", v)} lang={lang} /></div>
          <PosterPicker title={form.title} category={form.category} currentUrl={form.poster_url} onSelect={(url) => set("poster_url", url)} lang={lang} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 22, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={BS}>{t(lang, "cancel")}</button>
          <button onClick={save} disabled={saving} style={{ ...BP, opacity: saving ? 0.7 : 1 }}>{saving ? "…" : t(lang, "save")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({ item, user, members, onEdit, onDelete, lang }) {
  const STATUS = getStatus(lang);
  const myProg = item.user_progress[user.id] || { status: "a_voir" };
  const isFilm = item.category === "film";
  const meta = STATUS[myProg.status] || STATUS.a_voir;
  const [imgOk, setImgOk] = useState(true);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", transition: "border-color 0.15s, transform 0.15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.28)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}>

      <div style={{ position: "relative", height: 190, background: "rgba(255,255,255,0.03)", overflow: "hidden", flexShrink: 0 }}>
        {item.poster_url && imgOk
          ? <img src={item.poster_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={() => setImgOk(false)} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, opacity: 0.1 }}>{isFilm ? "🎬" : "📺"}</div>}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(11,11,24,0.65) 0%, transparent 55%)" }} />
        <div style={{ position: "absolute", top: 8, left: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: isFilm ? C.gold : C.blue, background: isFilm ? "rgba(201,168,76,0.15)" : "rgba(96,165,250,0.15)", padding: "2px 7px", borderRadius: 99, border: `1px solid ${isFilm ? "rgba(201,168,76,0.3)" : "rgba(96,165,250,0.3)"}` }}>
            {isFilm ? t(lang, "film").toUpperCase() : "SÉRIE"}
          </span>
        </div>
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <span style={{ fontSize: 9, background: `${meta.color}20`, color: meta.color, padding: "2px 7px", borderRadius: 99, border: `1px solid ${meta.color}40` }}>{meta.label}</span>
        </div>
      </div>

      <div style={{ padding: "11px 13px", flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontFamily: "'Playfair Display',serif", color: C.text, lineHeight: 1.3 }}>{item.title}</h3>
        {item.tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {item.tags.slice(0, 3).map((tg) => <span key={tg} style={{ fontSize: 9, color: "rgba(201,168,76,0.6)", background: "rgba(201,168,76,0.06)", padding: "1px 6px", borderRadius: 99 }}>#{tg}</span>)}
            {item.tags.length > 3 && <span style={{ fontSize: 9, color: C.muted }}>+{item.tags.length - 3}</span>}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: "auto", paddingTop: 7, borderTop: `1px solid ${C.border}` }}>
          {members.map((m, i) => {
            const ST = getStatus(lang);
            const prog = item.user_progress[m.id];
            const st = ST[prog?.status] || ST.a_voir;
            let detail = "";
            if (prog?.status === "en_cours") {
              if (isFilm && prog.minutes) detail = ` · ${prog.minutes}min`;
              if (!isFilm && (prog?.season || prog?.episode)) detail = ` · S${prog.season || "?"}E${prog.episode || "?"}`;
            }
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Avatar username={m.username} index={i} size={16} />
                <span style={{ fontSize: 10, color: C.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.username}</span>
                {prog ? <>
                  <span style={{ fontSize: 10, color: st.color, whiteSpace: "nowrap" }}>{st.label}{detail}</span>
                  {prog.rating > 0 && <Stars value={prog.rating} size={9} />}
                </> : <span style={{ fontSize: 10, color: "rgba(255,255,255,0.1)" }}>—</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "6px 13px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.12)" }}>{t(lang, "by")} {item.added_by_name}</span>
        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={() => onEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12, padding: "3px 5px" }}>✏️</button>
          {item.added_by === user.id && <button onClick={() => onDelete(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12, padding: "3px 5px" }}>🗑️</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({ list, onClose, lang }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(list.invite_code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 340 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17, fontFamily: "'Playfair Display',serif", color: C.text }}>« {list.name} »</h2>
        <p style={{ margin: "0 0 20px", color: C.muted, fontSize: 13 }}>{t(lang, "share_desc")}</p>
        <div style={{ background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.22)", borderRadius: 12, padding: "16px 24px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>{t(lang, "invite_code")}</div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 10, color: C.gold, fontFamily: "monospace" }}>{list.invite_code}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{t(lang, "share_members")} ({list.members?.length || 0})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {(list.members || []).map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Avatar username={m.username} index={i} size={24} />
                <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{m.username}</span>
                {m.id === list.owner_id && <span style={{ fontSize: 9, color: C.gold, background: "rgba(201,168,76,0.1)", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>{t(lang, "creator")}</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copy} style={{ ...BP, flex: 1 }}>{copied ? t(lang, "copied") : t(lang, "copy_code")}</button>
          <button onClick={onClose} style={BS}>{t(lang, "close")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => api.getUser());
  const [lang, setLang] = useState(() => localStorage.getItem("wl_lang") || "fr");
  const [lists, setLists] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [items, setItems] = useState([]);
  const [itemModal, setItemModal] = useState(null); // null | {} | item
  const [shareModal, setShareModal] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [sideMsg, setSideMsg] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("");
  const [search, setSearch] = useState("");

  const changeLang = (l) => { setLang(l); localStorage.setItem("wl_lang", l); };

  // Logout event from api.js (session expired)
  useEffect(() => {
    const handler = () => { setUser(null); setLists([]); setCurrentId(null); };
    window.addEventListener("wl:logout", handler);
    return () => window.removeEventListener("wl:logout", handler);
  }, []);

  const loadLists = useCallback(async () => {
    if (!api.getUser()) return;
    try { const data = await api.getLists(); setLists(data); return data; }
    catch { return []; }
  }, []);

  useEffect(() => { if (user) loadLists(); }, [user, loadLists]);

  // Load items for current list + realtime
  useEffect(() => {
    if (!currentId) return;
    api.getItems(currentId).then(setItems).catch(() => {});
    const unsub = subscribeToItems(currentId, () => api.getItems(currentId).then(setItems).catch(() => {}));
    return unsub;
  }, [currentId]);

  // Realtime list updates (member joins etc.)
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToLists(() => loadLists());
    return unsub;
  }, [user, loadLists]);

  const createListAction = async () => {
    const name = newName.trim(); if (!name) return;
    try {
      const list = await api.createList(name);
      setNewName(""); await loadLists(); setCurrentId(list.id);
    } catch (e) { setSideMsg("❌ " + e.message); setTimeout(() => setSideMsg(""), 2500); }
  };

  const joinListAction = async () => {
    const code = joinCode.trim(); if (!code) return;
    try {
      const list = await api.joinList(code);
      setJoinCode(""); setSideMsg(t(lang, "joined")); setTimeout(() => setSideMsg(""), 2000);
      await loadLists(); setCurrentId(list.id);
    } catch { setSideMsg(t(lang, "invalid_code")); setTimeout(() => setSideMsg(""), 2500); }
  };

  const handleSaved = async (saved) => {
    // Reload items from server
    const fresh = await api.getItems(currentId);
    setItems(fresh);
    setItemModal(null);
  };

  const removeItem = async (id) => {
    try {
      await api.deleteItem(currentId, id);
      setItems((p) => p.filter((i) => i.id !== id));
    } catch (e) { alert(e.message); }
  };

  const logout = () => { api.logout(); setUser(null); setLists([]); setCurrentId(null); };

  const STATUS = getStatus(lang);
  if (!user) return <AuthScreen onLogin={(u) => { api.saveUser(u); setUser(u); }} lang={lang} setLang={changeLang} />;

  const currentList = lists.find((l) => l.id === currentId);
  const members = currentList?.members || [];
  const allTags = [...new Set(items.flatMap((i) => i.tags || []))];

  const filtered = items.filter((i) => {
    const p = i.user_progress[user.id] || {};
    if (filterCat !== "all" && i.category !== filterCat) return false;
    if (filterStatus !== "all" && (p.status || "a_voir") !== filterStatus) return false;
    if (filterTag && !(i.tags || []).includes(filterTag)) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    a_voir: items.filter((i) => (i.user_progress[user.id]?.status || "a_voir") === "a_voir").length,
    en_cours: items.filter((i) => i.user_progress[user.id]?.status === "en_cours").length,
    termine: items.filter((i) => i.user_progress[user.id]?.status === "termine").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex" }}>
      {/* ── Sidebar ─────────────────────────────────────── */}
      <div style={{ width: 214, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: "18px 12px", gap: 16, minHeight: "100vh", boxSizing: "border-box", overflowY: "auto" }}>
        <div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, background: `linear-gradient(90deg,${C.gold},#F5D688)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🎞 Watchlist</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 8, cursor: "pointer", marginBottom: 8 }} onClick={logout}>
            <Avatar username={user.username} index={0} size={20} />
            <span style={{ fontSize: 12, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{user.username}</span>
            <span style={{ fontSize: 11, color: C.muted }} title="Déconnexion">⏻</span>
          </div>
          <LangToggle lang={lang} setLang={changeLang} />
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 6px 2px", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2 }}>{t(lang, "my_lists")}</p>
          {lists.length === 0 && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.12)", margin: "4px 0 0 2px" }}>—</p>}
          {lists.map((l) => (
            <div key={l.id} onClick={() => { setCurrentId(l.id); setChatOpen(false); }} style={{ padding: "7px 9px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: currentId === l.id ? C.gold : C.text, background: currentId === l.id ? "rgba(201,168,76,0.08)" : "transparent", marginBottom: 2, display: "flex", alignItems: "center", gap: 7 }}>
              <span>{l.members?.length > 1 ? "👥" : "📋"}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
              <span style={{ fontSize: 10, color: C.muted, background: "rgba(255,255,255,0.05)", borderRadius: 99, padding: "0 5px" }}>{l.members?.length || 1}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <p style={{ margin: "0 0 6px 2px", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2 }}>{t(lang, "create_list")}</p>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createListAction()} placeholder={t(lang, "list_name")} style={{ ...IS, fontSize: 12, marginBottom: 6 }} />
          <button onClick={createListAction} style={{ ...BP, width: "100%", fontSize: 12, padding: "7px" }}>{t(lang, "create")}</button>
        </div>

        <div>
          <p style={{ margin: "0 0 6px 2px", fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2 }}>{t(lang, "join")}</p>
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && joinListAction()} placeholder={t(lang, "join_code")} style={{ ...IS, fontSize: 14, marginBottom: 6, fontFamily: "monospace", letterSpacing: 5, textTransform: "uppercase", textAlign: "center" }} maxLength={6} />
          <button onClick={joinListAction} style={{ ...BS, width: "100%", fontSize: 12, padding: "7px" }}>{t(lang, "join")}</button>
          {sideMsg && <p style={{ fontSize: 11, color: sideMsg.startsWith("✓") ? C.success : C.danger, textAlign: "center", margin: "5px 0 0" }}>{sideMsg}</p>}
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, maxHeight: "100vh", overflowY: "auto" }}>
        {!currentList ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.muted, gap: 14, padding: 40 }}>
            <div style={{ fontSize: 52 }}>🎬</div>
            <p style={{ margin: 0, fontSize: 15, textAlign: "center", maxWidth: 320 }}>{t(lang, "select_list")}</p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.15)", textAlign: "center" }}>{t(lang, "join_hint")}</p>
          </div>
        ) : (<>
          {/* Header */}
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontFamily: "'Playfair Display',serif" }}>{currentList.name}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                {members.map((m, i) => <Avatar key={m.id} username={m.username} index={i} size={18} />)}
                <span style={{ fontSize: 11, color: C.muted }}>{members.length} {members.length > 1 ? t(lang, "members") : t(lang, "member")} · {items.length} {items.length > 1 ? t(lang, "titles") : t(lang, "title")}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ k: "a_voir", l: t(lang, "to_watch") }, { k: "en_cours", l: t(lang, "watching") }, { k: "termine", l: t(lang, "watched") }].map((s) => (
                <div key={s.k} style={{ textAlign: "center", padding: "4px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: STATUS[s.k].color, lineHeight: 1.2 }}>{counts[s.k]}</div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setChatOpen(true)} style={{ ...BS, fontSize: 12, padding: "7px 12px" }}>{t(lang, "chat")}</button>
            <button onClick={() => setShareModal(true)} style={{ ...BS, fontSize: 12, padding: "7px 12px" }}>{t(lang, "share")}</button>
            <button onClick={() => setItemModal({})} style={{ ...BP, fontSize: 13 }}>{t(lang, "add")}</button>
          </div>

          {/* Filters */}
          <div style={{ padding: "10px 22px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t(lang, "search")} style={{ ...IS, background: "rgba(255,255,255,0.03)", fontSize: 12, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
              <FBtn label={t(lang, "all")} active={filterCat === "all"} onClick={() => setFilterCat("all")} />
              <FBtn label={t(lang, "films")} active={filterCat === "film"} onClick={() => setFilterCat("film")} />
              <FBtn label={t(lang, "series")} active={filterCat === "serie"} onClick={() => setFilterCat("serie")} />
              <span style={{ color: C.border, margin: "0 3px" }}>|</span>
              <FBtn label={t(lang, "all")} active={filterStatus === "all"} onClick={() => setFilterStatus("all")} />
              <FBtn label={t(lang, "to_watch")} active={filterStatus === "a_voir"} color={C.muted} onClick={() => setFilterStatus("a_voir")} />
              <FBtn label={t(lang, "watching")} active={filterStatus === "en_cours"} color={C.warning} onClick={() => setFilterStatus("en_cours")} />
              <FBtn label={t(lang, "watched")} active={filterStatus === "termine"} color={C.success} onClick={() => setFilterStatus("termine")} />
              {allTags.length > 0 && <>
                <span style={{ color: C.border, margin: "0 3px" }}>|</span>
                {allTags.slice(0, 6).map((tg) => <FBtn key={tg} label={`#${tg}`} active={filterTag === tg} color="rgba(201,168,76,0.75)" onClick={() => setFilterTag(filterTag === tg ? "" : tg)} />)}
              </>}
            </div>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, padding: "18px 22px" }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, paddingTop: 60 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🎬</div>
                <p style={{ margin: 0 }}>{items.length === 0 ? t(lang, "add_first") : t(lang, "no_results")}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 14 }}>
                {filtered.map((item) => <ItemCard key={item.id} item={item} user={user} members={members} onEdit={setItemModal} onDelete={removeItem} lang={lang} />)}
              </div>
            )}
          </div>
        </>)}
      </div>

      {/* Modals */}
      {itemModal !== null && (
        <ItemModal
          item={itemModal && Object.keys(itemModal).length ? itemModal : null}
          user={user} listId={currentId}
          onSaved={handleSaved} onClose={() => setItemModal(null)} lang={lang}
        />
      )}
      {shareModal && currentList && <ShareModal list={currentList} onClose={() => setShareModal(false)} lang={lang} />}
      {chatOpen && currentList && <ChatPanel listId={currentId} user={user} members={members} lang={lang} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
