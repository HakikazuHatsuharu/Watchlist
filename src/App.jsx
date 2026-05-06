import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "./lib/api";
import { searchTMDB } from "./lib/tmdb";
import { t } from "./lib/i18n";
import {
  subscribeToItems, subscribeToLists, subscribeToMessages,
  subscribeToGlobalChat, subscribeToDMs,
  subscribeToNotifications
} from "./lib/realtime";

// ─── Responsive hook ─────────────────────────────────────────────────────────
function useIsMobile(){ 
  const [m,setM]=useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const h=()=>setM(window.innerWidth<768);
    window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);
  },[]);
  return m;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg:"#0b0b18",surface:"#111128",card:"#1c1c38",border:"rgba(255,255,255,0.12)",
  gold:"#C9A84C",blue:"#60A5FA",text:"#F0EBE0",muted:"#8B90A0",
  success:"#10B981",warning:"#F59E0B",danger:"#F87171",purple:"#A78BFA",
};
const AV_COLORS = ["#C9A84C","#60A5FA","#A78BFA","#10B981","#F87171","#FB923C","#F472B6"];
const IS = {background:"rgba(255,255,255,0.06)",border:`1px solid rgba(255,255,255,0.15)`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",width:"100%"};
const BP = {background:C.gold,color:"#0b0b18",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"};
const BS = {background:"transparent",color:C.muted,border:`1px solid rgba(255,255,255,0.12)`,borderRadius:8,padding:"9px 18px",fontSize:13,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"};
const BD = {background:"rgba(248,113,113,0.12)",color:C.danger,border:`1px solid rgba(248,113,113,0.3)`,borderRadius:8,padding:"9px 18px",fontSize:13,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"};
const LB = {display:"block",fontSize:12,color:C.muted,marginBottom:4,letterSpacing:0.8,textTransform:"uppercase"};

const CATEGORIES = [
  {id:"film",      label:"🎬 Film",         short:"Film"},
  {id:"serie",     label:"📺 Série",         short:"Série"},
  {id:"anime",     label:"⛩️ Animé",         short:"Animé"},
  {id:"animation", label:"🎨 Animation",     short:"Anim."},
  {id:"documentary",label:"🎙️ Documentaire", short:"Docu"},
  {id:"short",     label:"⏱ Court",          short:"Court"},
  {id:"reality",   label:"📡 Télé-réalité",  short:"Télé"},
  {id:"sport",     label:"🏆 Sport",         short:"Sport"},
];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c=>[c.id,c.label]));
const CAT_SHORT = Object.fromEntries(CATEGORIES.map(c=>[c.id,c.short]));

const GLOBAL_ROLES = {
  superadmin:{label:"👑 Super Admin",color:"#C9A84C",level:5,bg:"rgba(201,168,76,0.15)"},
  admin:     {label:"⚡ Admin",      color:"#F87171",level:4,bg:"rgba(248,113,113,0.1)"},
  moderator: {label:"🛡 Modérateur", color:"#60A5FA",level:3,bg:"rgba(96,165,250,0.1)"},
  vip:       {label:"💎 VIP",        color:"#A78BFA",level:2,bg:"rgba(167,139,250,0.1)"},
  user:      {label:"",              color:"#8B90A0",level:1,bg:"transparent"},
};
function canModerate(r){return["superadmin","admin","moderator"].includes(r);}
function canAdmin(r){return["superadmin","admin"].includes(r);}

const BADGES = [
  {min:730,icon:"👑",label:"Légende",   color:"#C9A84C"},
  {min:365,icon:"💎",label:"Vétéran",   color:"#A78BFA"},
  {min:180,icon:"🔥",label:"Passionné", color:"#F87171"},
  {min:30, icon:"⭐",label:"Régulier",  color:"#60A5FA"},
  {min:0,  icon:"🌱",label:"Nouveau",   color:"#10B981"},
];
// ─── Themes ───────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    name:"Sombre",icon:"🌑",
    bg:"#0b0b18",surface:"#111128",card:"#1c1c38",
    border:"rgba(255,255,255,0.12)",text:"#F0EBE0",muted:"#8B90A0",
    gold:"#C9A84C",accent:"#C9A84C",
  },
  discord: {
    name:"Discord",icon:"💬",
    bg:"#313338",surface:"#2b2d31",card:"#22242a",
    border:"rgba(255,255,255,0.06)",text:"#dbdee1",muted:"#80848e",
    gold:"#5865f2",accent:"#5865f2",
  },
  midnight: {
    name:"Minuit",icon:"🌌",
    bg:"#060612",surface:"#0d0d20",card:"#171730",
    border:"rgba(100,80,255,0.15)",text:"#e8e0ff",muted:"#6060a0",
    gold:"#8b5cf6",accent:"#8b5cf6",
  },
  forest: {
    name:"Forêt",icon:"🌿",
    bg:"#0a1208",surface:"#0f1a0d",card:"#192a16",
    border:"rgba(50,200,80,0.12)",text:"#d4edda",muted:"#4a7055",
    gold:"#4ade80",accent:"#4ade80",
  },
  sakura: {
    name:"Sakura",icon:"🌸",
    bg:"#1a0a14",surface:"#220d1a",card:"#321428",
    border:"rgba(255,100,150,0.12)",text:"#fde8f0",muted:"#a05070",
    gold:"#f472b6",accent:"#f472b6",
  },
  ocean: {
    name:"Océan",icon:"🌊",
    bg:"#060d1a",surface:"#0a1428",card:"#122040",
    border:"rgba(30,150,255,0.12)",text:"#ddeeff",muted:"#4070a0",
    gold:"#38bdf8",accent:"#38bdf8",
  },
};

function getThemeColors(themeKey){
  const t=THEMES[themeKey]||THEMES.dark;
  return{
    bg:t.bg, surface:t.surface, card:t.card, border:t.border,
    text:t.text, muted:t.muted, gold:t.gold, accent:t.accent,
    blue:"#60A5FA", success:"#10B981", warning:"#F59E0B", danger:"#F87171", purple:"#A78BFA",
  };
}

function getBadge(createdAt){
  const days=Math.floor((Date.now()-new Date(createdAt||Date.now()).getTime())/86400000);
  return BADGES.find(b=>days>=b.min)||BADGES[BADGES.length-1];
}
function genId(){return Math.random().toString(36).slice(2,9)+Date.now().toString(36);}
const getStatus=(lang)=>({
  a_voir:  {label:t(lang,"to_watch"), color:C.muted},
  en_cours:{label:t(lang,"watching"), color:C.warning},
  termine: {label:t(lang,"watched"),  color:C.success},
});

// ─── Micro components ─────────────────────────────────────────────────────────
function Stars({value=0,onChange,size=16}){
  const [hov,setHov]=useState(0);
  return(
    <div style={{display:"flex",gap:2}}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onClick={()=>onChange&&onChange(n===value?0:n)}
          onMouseEnter={()=>onChange&&setHov(n)} onMouseLeave={()=>onChange&&setHov(0)}
          style={{fontSize:size,cursor:onChange?"pointer":"default",color:(hov||value)>=n?C.gold:"rgba(255,255,255,0.12)",transition:"color 0.1s",lineHeight:1,userSelect:"none"}}>★</span>
      ))}
    </div>
  );
}

function Avatar({username="?",avatarUrl="",index=0,size=24,createdAt=null,onClick=null}){
  const color=AV_COLORS[Math.abs(index)%AV_COLORS.length];
  const badge=createdAt?getBadge(createdAt):null;
  return(
    <div style={{position:"relative",flexShrink:0,cursor:onClick?"pointer":"default"}} onClick={onClick}>
      <div title={username} style={{width:size,height:size,borderRadius:"50%",background:`${color}18`,border:`1.5px solid ${color}44`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.42,fontWeight:700,color}}>
        {avatarUrl?<img src={avatarUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.currentTarget.style.display="none"}/>:username[0]?.toUpperCase()}
      </div>
      {badge&&size>=28&&<span style={{position:"absolute",bottom:-2,right:-2,fontSize:size*0.38,lineHeight:1}} title={badge.label}>{badge.icon}</span>}
    </div>
  );
}

function GlobalRoleBadge({role,size="normal"}){
  const r=GLOBAL_ROLES[role];
  if(!r||role==="user") return null;
  const fs=size==="small"?9:size==="large"?13:11;
  const pad=size==="small"?"2px 7px":size==="large"?"4px 12px":"3px 9px";
  return<span style={{fontSize:fs,color:r.color,background:r.bg,padding:pad,borderRadius:99,border:`1px solid ${r.color}30`,fontWeight:600,whiteSpace:"nowrap"}}>{r.label}</span>;
}

function NotifBadge({count}){
  if(!count||count<=0) return null;
  return(
    <span style={{position:"absolute",top:-4,right:-4,background:C.danger,color:"white",fontSize:11,fontWeight:700,minWidth:16,height:16,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",lineHeight:1,border:`1.5px solid ${C.bg}`}}>
      {count>99?"99+":count}
    </span>
  );
}

function FBtn({label,active,color,onClick}){
  const c=color||C.gold;
  return<button onClick={onClick} style={{background:active?`${c}18`:"transparent",border:`1px solid ${active?`${c}50`:C.border}`,borderRadius:99,padding:"5px 13px",fontSize:12,color:active?c:C.text,fontWeight:active?700:400,cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"}}>{label}</button>;
}

function LangToggle({lang,setLang}){
  return(
    <div style={{display:"flex",gap:4}}>
      {["fr","en"].map(l=>(
        <button key={l} onClick={()=>setLang(l)} style={{flex:1,background:lang===l?`${C.gold}18`:"transparent",border:`1px solid ${lang===l?C.gold:C.border}`,borderRadius:6,padding:"3px 0",fontSize:11,color:lang===l?C.gold:C.muted,cursor:"pointer",fontFamily:"inherit"}}>{l==="fr"?"🇫🇷 FR":"🇬🇧 EN"}</button>
      ))}
    </div>
  );
}

function TagInput({tags=[],onChange,lang}){
  const [input,setInput]=useState("");
  const add=()=>{const tg=input.trim().toLowerCase();if(tg&&!tags.includes(tg))onChange([...tags,tg]);setInput("");};
  return(
    <div>
      {tags.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
        {tags.map(tg=>(<span key={tg} style={{background:"rgba(201,168,76,0.12)",border:"1px solid rgba(201,168,76,0.22)",borderRadius:99,padding:"2px 8px",fontSize:11,color:C.gold,display:"flex",alignItems:"center",gap:4}}>
          #{tg}<span onClick={()=>onChange(tags.filter(x=>x!==tg))} style={{cursor:"pointer",opacity:0.5,fontSize:14,lineHeight:1}}>×</span>
        </span>))}
      </div>}
      <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();add();}}} placeholder={t(lang,"tags_placeholder")} style={IS}/>
    </div>
  );
}

// ─── Film Detail Modal ────────────────────────────────────────────────────────
function FilmDetailModal({item,user,lang,onClose}){
  const [lists,setLists]=useState([]);
  const [watchlog,setWatchlog]=useState([]);
  const [selectedList,setSelectedList]=useState("");
  const [status,setStatus]=useState("a_voir");
  const [rating,setRating]=useState(0);
  const [minutes,setMinutes]=useState("");
  const [season,setSeason]=useState("");
  const [episode,setEpisode]=useState("");
  const [adding,setAdding]=useState(false);
  const [addingLog,setAddingLog]=useState(false);
  const [msg,setMsg]=useState("");
  const [tab,setTab]=useState("lists"); // "lists" | "log"
  const [tmdbDetails,setTmdbDetails]=useState(null);

  const isFilmType = item.category==="film"||item.category==="short"||item.category==="documentary";

  useEffect(()=>{
    api.getLists().then(setLists);
    api.getWatchlog().then(setWatchlog);
    // Try to fetch extra TMDB details if we have tmdb_id
    if(item.tmdb_id && import.meta.env.VITE_TMDB_KEY){
      const type = item.category==="serie"||item.category==="anime" ? "tv" : "movie";
      fetch(`https://api.themoviedb.org/3/${type}/${item.tmdb_id}?api_key=${import.meta.env.VITE_TMDB_KEY}&language=fr-FR`)
        .then(r=>r.json()).then(setTmdbDetails).catch(()=>{});
    }
  },[item.tmdb_id, item.category]);

  const alreadyInLog = watchlog.find(w=>w.title.toLowerCase()===item.title.toLowerCase());
  const listsWithItem = lists.filter(l=>false); // will check via API in future

  const addToList = async()=>{
    if(!selectedList){setMsg("Choisis une liste.");return;}
    setAdding(true);
    try{
      await api.createItem(selectedList,{
        title:item.title, category:item.category||"film",
        poster_url:item.poster_url||"", tags:[],
        user_progress:{[user.id]:{status,minutes,season,episode,rating}},
        tmdb_id:item.tmdb_id||null,
      });
      setMsg("✓ Ajouté à la liste !");
    }catch(e){setMsg("❌ "+e.message);}
    setAdding(false);
  };

  const addToLog = async()=>{
    setAddingLog(true);
    try{
      await api.addToWatchlog({
        title:item.title, category:item.category||"film",
        poster_url:item.poster_url||"", status, rating:parseInt(rating)||0,
        minutes:parseInt(minutes)||0, season:parseInt(season)||0,
        episode:parseInt(episode)||0, tags:[], tmdb_id:item.tmdb_id||null,
      });
      setMsg("✓ Ajouté à ton journal !");
    }catch(e){setMsg("❌ "+e.message);}
    setAddingLog(false);
  };

  const st = getStatus(lang)[status]||getStatus(lang).a_voir;
  const runtime = tmdbDetails?.runtime ? `${tmdbDetails.runtime} min` : item.year ? item.year : "";
  const genres = tmdbDetails?.genres?.map(g=>g.name).join(", ")||"";
  const overview = tmdbDetails?.overview || item.overview || "";

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:700,overflowY:"auto",padding:"20px 16px"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,borderRadius:18,width:"100%",maxWidth:560,overflow:"hidden",border:`1px solid ${C.border}`}}>

        {/* Backdrop / poster header */}
        <div style={{position:"relative",height:200,background:"#0d0d1a",overflow:"hidden"}}>
          {item.poster_url&&<img src={item.poster_url} alt={item.title} style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.35,filter:"blur(4px)",transform:"scale(1.05)"}}/>}
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 30%,rgba(17,17,40,1) 100%)"}}/>
          <button onClick={onClose} style={{position:"absolute",top:12,right:12,background:"rgba(0,0,0,0.5)",border:"none",color:"white",cursor:"pointer",fontSize:16,width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>×</button>

          {/* Poster + title overlay */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 20px 20px",display:"flex",gap:14,alignItems:"flex-end"}}>
            <div style={{width:72,height:104,borderRadius:8,overflow:"hidden",background:"rgba(255,255,255,0.06)",flexShrink:0,border:`1px solid rgba(255,255,255,0.15)`}}>
              {item.poster_url?<img src={item.poster_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,opacity:0.2}}>🎬</div>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <h2 style={{margin:"0 0 4px",fontSize:20,fontFamily:"'Playfair Display',serif",color:C.text,textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>{item.title}</h2>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:11,color:C.gold,background:"rgba(201,168,76,0.15)",padding:"2px 8px",borderRadius:99}}>{CAT_LABEL[item.category]||item.category}</span>
                {item.year&&<span style={{fontSize:11,color:C.muted}}>{item.year}</span>}
                {runtime&&<span style={{fontSize:11,color:C.muted}}>{runtime}</span>}
                {item.rating>0&&<span style={{fontSize:11,color:C.warning}}>⭐ {item.rating}</span>}
              </div>
              {genres&&<p style={{margin:"3px 0 0",fontSize:11,color:C.muted}}>{genres}</p>}
            </div>
          </div>
        </div>

        <div style={{padding:"16px 20px 20px",display:"flex",flexDirection:"column",gap:16}}>

          {/* Overview */}
          {overview&&<p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.6,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{overview}</p>}

          {/* Already in log badge */}
          {alreadyInLog&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:8}}>
            <span style={{fontSize:13,color:C.success}}>✓ Déjà dans ton journal</span>
            <span style={{fontSize:11,color:C.muted,marginLeft:"auto"}}>{getStatus(lang)[alreadyInLog.status]?.label||alreadyInLog.status}</span>
          </div>}

          {/* Status + progress fields (shared) */}
          <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:14,border:`1px solid ${C.border}`}}>
            <div style={{marginBottom:10}}>
              <label style={LB}>{t(lang,"my_status")}</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={{...IS,color:st.color}}>
                <option value="a_voir">{t(lang,"to_watch")}</option>
                <option value="en_cours">{t(lang,"watching")}</option>
                <option value="termine">{t(lang,"watched")}</option>
              </select>
            </div>
            {status==="en_cours"&&(isFilmType?(
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="number" min="0" value={minutes} onChange={e=>setMinutes(e.target.value)} placeholder="25" style={{...IS,width:80}}/>
                <span style={{color:C.muted,fontSize:13}}>minutes</span>
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={LB}>Saison</label><input type="number" min="1" value={season} onChange={e=>setSeason(e.target.value)} placeholder="1" style={IS}/></div>
                <div><label style={LB}>Épisode</label><input type="number" min="1" value={episode} onChange={e=>setEpisode(e.target.value)} placeholder="1" style={IS}/></div>
              </div>
            ))}
            {status==="termine"&&<div style={{marginTop:8}}><label style={LB}>Ma note</label><Stars value={parseInt(rating)||0} onChange={v=>setRating(v)} size={22}/></div>}
          </div>

          {/* Tabs: add to list vs add to log */}
          <div style={{display:"flex",gap:0,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}>
            {[{k:"lists",l:"📋 Ajouter à une liste"},{k:"log",l:"📖 Mon journal"}].map(tb=>(
              <button key={tb.k} onClick={()=>setTab(tb.k)} style={{flex:1,background:tab===tb.k?"rgba(201,168,76,0.1)":"transparent",border:"none",borderBottom:tab===tb.k?`2px solid ${C.gold}`:"2px solid transparent",padding:"10px 8px",fontSize:12,color:tab===tb.k?C.gold:C.muted,cursor:"pointer",fontFamily:"inherit"}}>{tb.l}</button>
            ))}
          </div>

          {tab==="lists"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <label style={LB}>Choisir une liste</label>
                {lists.length===0
                  ?<p style={{color:C.muted,fontSize:12}}>Aucune liste. Crée-en une d'abord !</p>
                  :<select value={selectedList} onChange={e=>setSelectedList(e.target.value)} style={IS}>
                    <option value="">— Sélectionne une liste —</option>
                    {lists.map(l=><option key={l.id} value={l.id}>{l.name} ({l.members?.length||1} membre{(l.members?.length||1)>1?"s":""})</option>)}
                  </select>
                }
              </div>
              <button onClick={addToList} disabled={adding||!selectedList} style={{...BP,width:"100%",opacity:!selectedList||adding?0.5:1}}>
                {adding?"…":"+ Ajouter à la liste"}
              </button>
            </div>
          )}

          {tab==="log"&&(
            <div>
              <p style={{margin:"0 0 10px",fontSize:12,color:C.muted}}>Ajoute ce titre à ton journal personnel, sans liste.</p>
              <button onClick={addToLog} disabled={addingLog} style={{...BP,width:"100%",opacity:addingLog?0.5:1}}>
                {addingLog?"…":"+ Ajouter à mon journal"}
              </button>
            </div>
          )}

          {msg&&<p style={{margin:0,fontSize:13,color:msg.startsWith("✓")?C.success:C.danger,textAlign:"center",fontWeight:600}}>{msg}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Search Modal (TMDB) ──────────────────────────────────────────────────────
function SearchModal({lang,onSelect,onClose,user}){
  const [q,setQ]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState(null);
  const timer=useRef();

  useEffect(()=>{
    clearTimeout(timer.current);
    if(!q.trim()){setResults([]);return;}
    timer.current=setTimeout(async()=>{
      setLoading(true);
      const r=await searchTMDB(q,"multi");
      setResults(r);setLoading(false);
    },400);
  },[q]);

  // If a film detail is open, show it on top
  if(selected) return(
    <FilmDetailModal item={selected} user={user} lang={lang} onClose={()=>setSelected(null)}/>
  );

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",flexDirection:"column",alignItems:"center",zIndex:600,padding:"40px 16px 0"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:580,background:C.surface,borderRadius:16,overflow:"hidden",maxHeight:"82vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un film, série, animé…" style={{...IS,flex:1,border:"none",background:"transparent",fontSize:15}} autoFocus/>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {loading&&<p style={{textAlign:"center",color:C.text,opacity:0.6,padding:20,fontSize:14}}>…</p>}
          {!loading&&results.length===0&&q.trim()&&(
            <div style={{textAlign:"center",color:C.muted,padding:30}}>
              <div style={{fontSize:32,marginBottom:8}}>🎬</div>
              <p style={{margin:0}}>Aucun résultat pour "{q}"</p>
              <p style={{margin:"6px 0 0",fontSize:11}}>Essaie le titre en anglais ou en français</p>
            </div>
          )}
          {results.map((r,i)=>(
            <div key={i} onClick={()=>setSelected(r)}
              style={{display:"flex",gap:12,padding:"10px 16px",cursor:"pointer",borderBottom:`1px solid ${C.border}`}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:44,height:64,borderRadius:6,overflow:"hidden",background:"rgba(255,255,255,0.06)",flexShrink:0}}>
                {r.poster_url?<img src={r.poster_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<span style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:18,opacity:0.2}}>🎬</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,color:C.text,fontWeight:700}}>{r.title}</div>
                <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:C.gold,fontWeight:600}}>{CAT_SHORT[r.category]||r.category}</span>
                  {r.year&&<span style={{fontSize:11,color:C.muted}}>{r.year}</span>}
                  {r.rating>0&&<span style={{fontSize:11,color:C.warning}}>⭐ {r.rating}</span>}
                </div>
                {r.overview&&<p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:"4px 0 0",lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{r.overview}</p>}
              </div>
              <span style={{fontSize:18,color:C.muted,alignSelf:"center"}}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Poster Picker ────────────────────────────────────────────────────────────
function PosterPicker({title,category,currentUrl,onSelect,lang}){
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [errMsg,setErrMsg]=useState("");
  const [showGrid,setShowGrid]=useState(false);
  const fileRef=useRef();

  const doSearch=async()=>{
    if(!title.trim()) return;
    setLoading(true);setErrMsg("");setShowGrid(false);
    try{
      const res=await api.searchPosters(title,category);
      if(!res.length) setErrMsg(t(lang,"poster_not_found"));
      else{setResults(res);setShowGrid(true);}
    }catch{setErrMsg(t(lang,"poster_not_found"));}
    setLoading(false);
  };

  const handleFile=e=>{
    const file=e.target.files?.[0];if(!file) return;
    if(file.size>1_200_000){setErrMsg(t(lang,"image_too_large"));return;}
    const reader=new FileReader();
    reader.onload=()=>{onSelect(reader.result);setShowGrid(false);};
    reader.readAsDataURL(file);e.target.value="";
  };

  return(
    <div>
      <label style={LB}>{t(lang,"poster")}</label>
      <div style={{display:"flex",gap:12,marginBottom:10}}>
        <div style={{width:72,height:104,borderRadius:8,overflow:"hidden",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {currentUrl?<img src={currentUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={()=>onSelect("")}/>:<span style={{fontSize:26,opacity:0.15}}>{category==="film"?"🎬":"📺"}</span>}
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
          <button onClick={()=>fileRef.current?.click()} style={{...BS,fontSize:12,padding:"7px 10px",textAlign:"left"}}>📁 {t(lang,"poster_upload")}</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
          <button onClick={doSearch} disabled={loading||!title.trim()} style={{...BS,fontSize:12,padding:"7px 10px",textAlign:"left",opacity:(loading||!title.trim())?0.5:1}}>
            {loading?t(lang,"poster_searching"):t(lang,"poster_search")}
          </button>
          <input onChange={e=>onSelect(e.target.value)} defaultValue={currentUrl?.startsWith("http")?currentUrl:""} placeholder="https://…" style={{...IS,fontSize:11}}/>
        </div>
      </div>
      {errMsg&&<p style={{fontSize:11,color:C.danger,margin:"0 0 8px"}}>⚠ {errMsg}</p>}
      {showGrid&&results.length>0&&(
        <div>
          <p style={{margin:"0 0 7px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>{t(lang,"poster_choose")}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(68px,1fr))",gap:7}}>
            {results.map((r,i)=>(
              <div key={i} onClick={()=>{onSelect(r.url);setShowGrid(false);}} title={r.label} style={{cursor:"pointer",borderRadius:6,overflow:"hidden",aspectRatio:"2/3",background:"rgba(255,255,255,0.04)",border:`2px solid ${currentUrl===r.url?C.gold:"transparent"}`}}>
                <img src={r.url} alt={r.label} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>e.currentTarget.parentElement.style.display="none"}/>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({title,onConfirm,onCancel,lang}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
      <div style={{background:C.surface,border:`1px solid rgba(248,113,113,0.3)`,borderRadius:16,padding:28,width:"100%",maxWidth:360,textAlign:"center"}}>
        <div style={{fontSize:36,marginBottom:12}}>🗑️</div>
        <h3 style={{margin:"0 0 8px",fontSize:16,color:C.text}}>Supprimer "{title}" ?</h3>
        <p style={{margin:"0 0 24px",color:C.muted,fontSize:13}}>Cette action est irréversible.</p>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button onClick={onCancel} style={BS}>{t(lang,"cancel")}</button>
          <button onClick={onConfirm} style={BD}>🗑 Supprimer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────
function NotificationsPanel({user,lang,onClose}){
  const [notifs,setNotifs]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    api.getNotifications().then(d=>{setNotifs(d);setLoading(false);});
    api.markNotifsRead().catch(()=>{});
  },[]);

  const icons={friend_request:"👥",friend_accept:"✅",message:"💬",mention:"@",news:"📰"};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"flex-end",zIndex:400}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:340,background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",height:"100vh"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center"}}>
          <h3 style={{margin:0,fontSize:15,color:C.text,flex:1}}>🔔 Notifications</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          {loading&&<p style={{color:C.muted,textAlign:"center"}}>…</p>}
          {!loading&&notifs.length===0&&<p style={{color:C.muted,textAlign:"center",marginTop:40}}>Aucune notification.</p>}
          {notifs.map(n=>(
            <div key={n.id} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`,opacity:n.read?0.5:1}}>
              <span style={{fontSize:20}}>{icons[n.type]||"🔔"}</span>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:14,color:C.text,fontWeight:500}}>{n.content}</p>
                <p style={{margin:"4px 0 0",fontSize:12,color:C.text,opacity:0.65}}>{new Date(n.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
              {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:C.gold,flexShrink:0,marginTop:4}}/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboard Modal ────────────────────────────────────────────────────────
function LeaderboardModal({item,members,profiles,lang,onClose}){
  const STATUS=getStatus(lang);
  const isFilm=item.category==="film";
  const rows=members.map((m,i)=>{
    const prog=item.user_progress[m.id]||{status:"a_voir"};
    const profile=profiles[m.id]||{};
    let score=0;
    if(prog.status==="termine") score=3000+(prog.rating||0)*100;
    else if(prog.status==="en_cours"){score=1000;if(isFilm&&prog.minutes) score+=parseInt(prog.minutes)||0;if(!isFilm) score+=(parseInt(prog.season||0)*1000)+(parseInt(prog.episode||0)||0);}
    return{...m,prog,profile,score,index:i};
  }).sort((a,b)=>b.score-a.score);
  const medals=["🥇","🥈","🥉"];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:26,width:"100%",maxWidth:420}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          {item.poster_url&&<img src={item.poster_url} alt="" style={{width:48,height:70,objectFit:"cover",borderRadius:6}}/>}
          <div>
            <h3 style={{margin:0,fontSize:16,fontFamily:"'Playfair Display',serif",color:C.text}}>{item.title}</h3>
            <p style={{margin:"4px 0 0",fontSize:12,color:C.muted}}>🏆 Classement des membres</p>
          </div>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {rows.map((row,rank)=>{
            const st=getStatus(lang)[row.prog.status]||getStatus(lang).a_voir;
            let detail="";
            if(row.prog.status==="en_cours"){if(isFilm&&row.prog.minutes) detail=` · ${row.prog.minutes}min`;else if(!isFilm&&(row.prog.season||row.prog.episode)) detail=` · S${row.prog.season||"?"}E${row.prog.episode||"?"}`;}
            return(
              <div key={row.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:rank===0?"rgba(201,168,76,0.08)":"rgba(255,255,255,0.03)",borderRadius:10,border:`1px solid ${rank===0?"rgba(201,168,76,0.2)":C.border}`}}>
                <span style={{fontSize:18,width:24,textAlign:"center"}}>{medals[rank]||`${rank+1}`}</span>
                <Avatar username={row.username} avatarUrl={row.profile.avatar_url} index={row.index} size={32} createdAt={row.profile.created_at}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,color:C.text,fontWeight:700}}>{row.username}</div>
                  <div style={{fontSize:14,color:st.color,fontWeight:700}}>{st.label}{detail}</div>
                </div>
                {row.prog.rating>0&&<Stars value={row.prog.rating} size={12}/>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Item Card (list) ─────────────────────────────────────────────────────────
function ItemCard({item,user,members,profiles,onEdit,onDelete,lang,confirmDelete,isOwnerOrMod}){
  const STATUS=getStatus(lang);
  const myProg=item.user_progress[user.id]||{status:"a_voir"};
  const meta=STATUS[myProg.status]||STATUS.a_voir;
  const [imgOk,setImgOk]=useState(true);
  const [showLeaderboard,setShowLeaderboard]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState(false);
  const catLabel=CAT_LABEL[item.category]||item.category;

  const handleDelete=()=>{if(confirmDelete) setDeleteConfirm(true); else onDelete(item.id);};

  return(
    <>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",display:"flex",flexDirection:"column",transition:"border-color 0.15s,transform 0.15s"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,0.28)";e.currentTarget.style.transform="translateY(-2px)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
        {/* Poster */}
        <div style={{position:"relative",height:190,background:"rgba(255,255,255,0.03)",overflow:"hidden",flexShrink:0,cursor:"pointer"}} onClick={()=>setShowLeaderboard(true)}>
          {item.poster_url&&imgOk?<img src={item.poster_url} alt={item.title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={()=>setImgOk(false)}/>
            :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,opacity:0.1}}>🎬</div>}
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(11,11,24,0.65) 0%,transparent 55%)"}}/>
          <div style={{position:"absolute",top:8,left:8}}>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:0.5,color:C.gold,background:"rgba(201,168,76,0.2)",padding:"3px 9px",borderRadius:99,border:"1px solid rgba(201,168,76,0.5)"}}>{(CAT_SHORT[item.category]||item.category).toUpperCase()}</span>
          </div>
          <div style={{position:"absolute",top:8,right:8}}>
            <span style={{fontSize:11,fontWeight:700,background:`${meta.color}25`,color:meta.color,padding:"3px 9px",borderRadius:99,border:`1px solid ${meta.color}60`}}>{meta.label}</span>
          </div>
          <div style={{position:"absolute",bottom:8,right:8,fontSize:12,color:"rgba(255,255,255,0.35)",background:"rgba(0,0,0,0.4)",padding:"2px 7px",borderRadius:99}}>🏆 Classement</div>
        </div>
        {/* Body */}
        <div style={{padding:"11px 13px",flex:1,display:"flex",flexDirection:"column",gap:7}}>
          <h3 style={{margin:0,fontSize:15,fontFamily:"'Playfair Display',serif",color:C.text,lineHeight:1.35,fontWeight:700}}>{item.title}</h3>
          {item.tags?.length>0&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {item.tags.slice(0,3).map(tg=><span key={tg} style={{fontSize:11,fontWeight:600,color:"rgba(201,168,76,0.9)",background:"rgba(201,168,76,0.12)",padding:"2px 8px",borderRadius:99,border:"1px solid rgba(201,168,76,0.25)"}}>#{tg}</span>)}
              {item.tags.length>3&&<span style={{fontSize:11,color:C.muted}}>+{item.tags.length-3}</span>}
            </div>
          )}
          {/* My progress - Spotify style */}
          <div style={{marginTop:"auto",paddingTop:7,borderTop:`1px solid ${C.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:myProg.status==="en_cours"?4:0}}>
              <span style={{fontSize:13,color:meta.color,fontWeight:700}}>{meta.label}</span>
              {myProg.status==="en_cours"&&item.category==="film"&&myProg.minutes&&(
                <span style={{fontSize:12,color:C.muted}}>{myProg.minutes} min</span>
              )}
              {myProg.status==="en_cours"&&item.category!=="film"&&(myProg.season||myProg.episode)&&(
                <span style={{fontSize:12,color:C.muted}}>S{myProg.season||"?"}·E{myProg.episode||"?"}</span>
              )}
            </div>
            {/* Progress bar for films */}
            {myProg.status==="en_cours"&&(item.category==="film"||item.category==="short"||item.category==="documentary")&&myProg.minutes>0&&(
              <div style={{height:3,background:`${C.border}`,borderRadius:99,overflow:"hidden",marginBottom:3}}>
                <div style={{height:"100%",background:C.gold,borderRadius:99,width:`${Math.min(100,Math.round((parseInt(myProg.minutes)||0)/Math.max(1,item.runtime||90)*100))}%`,transition:"width 0.3s"}}/>
              </div>
            )}
            {/* Progress bar for series */}
            {myProg.status==="en_cours"&&item.category!=="film"&&item.category!=="short"&&(myProg.season||myProg.episode)&&(
              <div style={{height:3,background:`${C.border}`,borderRadius:99,overflow:"hidden",marginBottom:3}}>
                <div style={{height:"100%",background:C.gold,borderRadius:99,width:`${Math.min(100,(parseInt(myProg.episode||0)%12)/12*100)}%`,transition:"width 0.3s"}}/>
              </div>
            )}
            {myProg.status==="termine"&&myProg.rating>0&&<Stars value={myProg.rating} size={10}/>}
          </div>
        </div>
        {/* Footer */}
        <div style={{padding:"6px 13px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.12)"}}>{t(lang,"by")} {item.added_by_name}</span>
          <div style={{display:"flex",gap:2}}>
            <button onClick={()=>onEdit(item)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:12,padding:"3px 5px"}}>✏️</button>
            {(item.added_by===user.id||isOwnerOrMod)&&<button onClick={handleDelete} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:12,padding:"3px 5px"}}>🗑️</button>}
          </div>
        </div>
      </div>
      {showLeaderboard&&<LeaderboardModal item={item} members={members} profiles={profiles} lang={lang} onClose={()=>setShowLeaderboard(false)}/>}
      {deleteConfirm&&<DeleteConfirmModal title={item.title} lang={lang} onConfirm={()=>{onDelete(item.id);setDeleteConfirm(false);}} onCancel={()=>setDeleteConfirm(false)}/>}
    </>
  );
}

// ─── Item Modal ───────────────────────────────────────────────────────────────
function ItemModal({item,user,listId,onSaved,onClose,lang,prefill=null,isOwnerOrMod=false}){
  const blank={title:"",category:"film",tags:[],poster_url:"",user_progress:{}};
  const [form,setForm]=useState(item?{...item}:prefill?{...blank,...prefill,user_progress:{}}:blank);
  const [saving,setSaving]=useState(false);

  // Auto-fetch runtime from TMDB (always fetch to get accurate value)
  useEffect(()=>{
    const tmdbId=form.tmdb_id||(item?.tmdb_id)||(prefill?.tmdb_id);
    const cat=form.category||item?.category||prefill?.category||"film";
    const isFilmType=["film","short","documentary"].includes(cat);
    if(tmdbId&&isFilmType){
      import('./lib/tmdb.js').then(m=>m.getTMDBDetails(tmdbId,cat)).then(details=>{
        if(details?.runtime) setForm(f=>({...f,runtime:details.runtime}));
      }).catch(()=>{});
    }
  },[]);
  const myProg=form.user_progress[user.id]||{status:"a_voir",minutes:"",season:"",episode:"",rating:0};
  const setMyProg=(k,v)=>setForm(f=>({...f,user_progress:{...f.user_progress,[user.id]:{...myProg,[k]:v}}}));
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const statusMeta=getStatus(lang)[myProg.status]||getStatus(lang).a_voir;
  // Only owner/mod can edit metadata
  const canEditMeta=!item||item.added_by===user.id||isOwnerOrMod;

  const save=async()=>{
    if(!form.title.trim()) return;
    setSaving(true);
    try{
      let saved;
      const payload={user_progress:{[user.id]:{...myProg}},...(canEditMeta?{title:form.title,category:form.category,tags:form.tags,poster_url:form.poster_url,runtime:form.runtime||null}:{})};
      if(item?.id) saved=await api.updateItem(listId,item.id,payload);
      else saved=await api.createItem(listId,{...form,runtime:form.runtime||null});
      onSaved(saved);
    }catch(e){alert(e.message);}
    setSaving(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16,overflowY:"auto"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:26,width:"100%",maxWidth:520,boxSizing:"border-box",maxHeight:"90vh",overflowY:"auto"}}>
        <h2 style={{margin:"0 0 18px",fontSize:17,fontFamily:"'Playfair Display',serif",color:C.text}}>{item?t(lang,"edit_title"):t(lang,"add_title")}</h2>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {canEditMeta&&<div><label style={LB}>{t(lang,"title_field")}</label><input value={form.title} onChange={e=>set("title",e.target.value)} placeholder={t(lang,"title_placeholder")} style={IS} autoFocus/></div>}
          {!canEditMeta&&<div style={{padding:"10px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8}}><p style={{margin:0,fontSize:14,fontWeight:600,color:C.text}}>{form.title}</p><p style={{margin:"3px 0 0",fontSize:11,color:C.muted}}>Seul le créateur peut modifier les infos du titre.</p></div>}
          {canEditMeta&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={LB}>{t(lang,"category")}</label>
                <select value={form.category} onChange={e=>set("category",e.target.value)} style={IS}>
                  {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div><label style={LB}>{t(lang,"my_status")}</label>
                <select value={myProg.status} onChange={e=>setMyProg("status",e.target.value)} style={{...IS,color:statusMeta.color}}>
                  <option value="a_voir">{t(lang,"to_watch")}</option>
                  <option value="en_cours">{t(lang,"watching")}</option>
                  <option value="termine">{t(lang,"watched")}</option>
                </select>
              </div>
            </div>
          )}
          {!canEditMeta&&(
            <div><label style={LB}>{t(lang,"my_status")}</label>
              <select value={myProg.status} onChange={e=>setMyProg("status",e.target.value)} style={{...IS,color:statusMeta.color}}>
                <option value="a_voir">{t(lang,"to_watch")}</option>
                <option value="en_cours">{t(lang,"watching")}</option>
                <option value="termine">{t(lang,"watched")}</option>
              </select>
            </div>
          )}
          {myProg.status==="en_cours"&&(
            <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:13}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <p style={{margin:0,fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>{t(lang,"my_progress")}</p>
                {form.runtime&&<span style={{fontSize:12,color:C.gold,fontWeight:600}}>⏱ {form.runtime} min au total</span>}
              </div>
              {(form.category==="film"||form.category==="short"||form.category==="documentary")?(()=>{
                const maxMin = parseInt(form.runtime)||0;
                const curMin = parseInt(myProg.minutes)||0;
                const pct = maxMin>0 ? Math.round(curMin/maxMin*100) : null;
                const handleMinutes = val => {
                  const v = Math.max(0, maxMin>0 ? Math.min(parseInt(val)||0, maxMin) : parseInt(val)||0);
                  if(maxMin>0 && v>=maxMin){
                    // Auto-complete when reaching the end
                    setMyProg("status","termine");
                    setMyProg("minutes","");
                  } else {
                    setMyProg("minutes", String(v));
                  }
                };
                return(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {/* Slider */}
                    <div>
                      <input type="range" min="0" max={maxMin>0?maxMin:300} step="1"
                        value={curMin}
                        onChange={e=>handleMinutes(e.target.value)}
                        style={{width:"100%",accentColor:C.gold,height:4}}/>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
                        <span style={{fontSize:12,color:C.muted}}>0</span>
                        {pct!==null&&<span style={{fontSize:13,color:C.gold,fontWeight:700}}>{curMin} min <span style={{color:C.muted,fontWeight:400}}>({pct}%)</span></span>}
                        <span style={{fontSize:12,color:C.muted}}>{maxMin>0?`${maxMin} min`:"?"}</span>
                      </div>
                    </div>
                    {/* Manual input */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <input type="number" min="0" max={maxMin>0?maxMin:undefined}
                        value={myProg.minutes}
                        onChange={e=>handleMinutes(e.target.value)}
                        placeholder="0" style={{...IS,width:90,textAlign:"center"}}/>
                      <span style={{color:C.muted,fontSize:13}}>/ {maxMin>0?`${maxMin} min`:"? min"}</span>
                      {maxMin===0&&<span style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>(durée inconnue)</span>}
                    </div>
                    {maxMin>0&&<p style={{margin:0,fontSize:11,color:C.muted}}>💡 Mettre {maxMin} min passe automatiquement en Terminé</p>}
                  </div>
                );
              })():(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div><label style={LB}>{t(lang,"season")}</label><input type="number" min="1" value={myProg.season} onChange={e=>setMyProg("season",e.target.value)} placeholder="1" style={IS}/></div>
                  <div><label style={LB}>{t(lang,"episode")}</label><input type="number" min="1" value={myProg.episode} onChange={e=>setMyProg("episode",e.target.value)} placeholder="1" style={IS}/></div>
                </div>
              )}
            </div>
          )}
          {myProg.status==="termine"&&<div><label style={LB}>{t(lang,"my_rating")}</label><Stars value={myProg.rating||0} onChange={v=>setMyProg("rating",v)} size={24}/></div>}
          {canEditMeta&&<div><label style={LB}>{t(lang,"tags")}</label><TagInput tags={form.tags||[]} onChange={v=>set("tags",v)} lang={lang}/></div>}
          {canEditMeta&&<PosterPicker title={form.title} category={form.category} currentUrl={form.poster_url} onSelect={url=>set("poster_url",url)} lang={lang}/>}
        </div>
        <div style={{display:"flex",gap:8,marginTop:22,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={BS}>{t(lang,"cancel")}</button>
          <button onClick={save} disabled={saving} style={{...BP,opacity:saving?0.7:1}}>{saving?"…":t(lang,"save")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── ChatBox (reusable) ───────────────────────────────────────────────────────
function ChatBox({messages,loading,user,members,profiles,lang,onSend,placeholder}){
  const [input,setInput]=useState("");
  const bottomRef=useRef();
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const send=async()=>{const c=input.trim();if(!c) return;setInput("");try{await onSend(c);}catch{}};
  const groups=messages.reduce((acc,msg)=>{
    const last=acc[acc.length-1];
    if(last&&last.user_id===msg.user_id&&Date.parse(msg.created_at)-Date.parse(last.items[last.items.length-1].created_at)<120000) last.items.push(msg);
    else acc.push({user_id:msg.user_id,username:msg.username,items:[msg]});
    return acc;
  },[]);
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{flex:1,overflowY:"auto",padding:"14px 14px 8px"}}>
        {loading&&<p style={{textAlign:"center",color:C.muted,fontSize:13}}>…</p>}
        {!loading&&messages.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,marginTop:40}}>{t(lang,"no_messages")}</p>}
        {groups.map((grp,gi)=>{
          const isMe=grp.user_id===user.id;
          const mi=members?.findIndex(m=>m.id===grp.user_id)??-1;
          const prof=profiles?.[grp.user_id]||{};
          const color=AV_COLORS[Math.max(mi,0)%AV_COLORS.length];
          return(
            <div key={gi} style={{marginBottom:14,display:"flex",gap:8,alignItems:"flex-start",flexDirection:isMe?"row-reverse":"row"}}>
              {/* Avatar - style Discord */}
              {!isMe&&<Avatar username={grp.username} avatarUrl={prof.avatar_url} index={Math.max(mi,0)} size={32} createdAt={prof.created_at}/>}
              <div style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",maxWidth:"75%"}}>
                {!isMe&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:700,color}}>{grp.username}</span>
                  {prof.global_role&&prof.global_role!=="user"&&<GlobalRoleBadge role={prof.global_role} size="small"/>}
                </div>}
                {grp.items.map(msg=>(
                  <div key={msg.id} style={{background:isMe?`${C.gold}20`:"rgba(255,255,255,0.06)",border:`1px solid ${isMe?`${C.gold}35`:C.border}`,borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",padding:"8px 13px",fontSize:14,color:C.text,wordBreak:"break-word",lineHeight:1.5,marginBottom:2}}>
                    {msg.content}
                  </div>
                ))}
                <span style={{fontSize:12,color:C.muted,marginTop:2}}>
                  {new Date(grp.items[grp.items.length-1].created_at).toLocaleTimeString(lang==="fr"?"fr-FR":"en-US",{hour:"2-digit",minute:"2-digit"})}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),send())} placeholder={placeholder||t(lang,"message_placeholder")} style={{...IS,flex:1}}/>
        <button onClick={send} style={{...BP,padding:"9px 14px"}}>{t(lang,"send")}</button>
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
function ChatPanel({listId,listName,user,members,profiles,lang,onClose}){
  const [tab,setTab]=useState("list");
  const [listMsgs,setListMsgs]=useState([]);
  const [globalMsgs,setGlobalMsgs]=useState([]);
  const [loadingList,setLoadingList]=useState(true);
  const [loadingGlobal,setLoadingGlobal]=useState(true);
  useEffect(()=>{
    api.getMessages(listId).then(m=>{setListMsgs(m);setLoadingList(false);});
    api.getGlobalChat().then(m=>{setGlobalMsgs(m);setLoadingGlobal(false);});
    const u1=subscribeToMessages(listId,msg=>setListMsgs(p=>[...p,msg]));
    const u2=subscribeToGlobalChat(msg=>setGlobalMsgs(p=>[...p,msg]));
    return()=>{u1();u2();};
  },[listId]);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"flex-end",zIndex:300}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:380,background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",height:"100vh"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <h3 style={{margin:0,fontSize:15,fontFamily:"'Playfair Display',serif",color:C.text,flex:1}}>{tab==="list"?listName:"💬 Chat global"}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          {[{k:"list",l:"📋 Liste"},{k:"global",l:"🌍 Global"}].map(tb=>(
            <button key={tb.k} onClick={()=>setTab(tb.k)} style={{flex:1,background:tab===tb.k?"rgba(201,168,76,0.08)":"transparent",border:"none",borderBottom:tab===tb.k?`2px solid ${C.gold}`:"2px solid transparent",padding:"10px",fontSize:12,color:tab===tb.k?C.gold:C.muted,cursor:"pointer",fontFamily:"inherit"}}>{tb.l}</button>
          ))}
        </div>
        <div style={{flex:1,overflow:"hidden"}}>
          {tab==="list"?<ChatBox messages={listMsgs} loading={loadingList} user={user} members={members} profiles={profiles} lang={lang} onSend={c=>api.sendMessage(listId,c)}/>
            :<ChatBox messages={globalMsgs} loading={loadingGlobal} user={user} members={[]} profiles={profiles} lang={lang} onSend={c=>api.sendGlobalMsg(c)} placeholder="Message au chat global…"/>}
        </div>
      </div>
    </div>
  );
}

// ─── DM Panel ─────────────────────────────────────────────────────────────────
function DMPanel({friend,user,profiles,lang,onClose}){
  const [msgs,setMsgs]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    api.getDMs(friend.id).then(m=>{setMsgs(m);setLoading(false);});
    const unsub=subscribeToDMs(user.id,msg=>{if(msg.sender_id===friend.id||msg.receiver_id===friend.id) setMsgs(p=>[...p,msg]);});
    return unsub;
  },[friend.id,user.id]);
  const fakeMembers=[{id:friend.id,username:friend.username}];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"flex-end",zIndex:350}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:380,background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",height:"100vh"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <Avatar username={friend.username} avatarUrl={profiles[friend.id]?.avatar_url} index={0} size={32} createdAt={profiles[friend.id]?.created_at}/>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:C.text}}>{friend.username}</div>
            {profiles[friend.id]?.bio&&<div style={{fontSize:11,color:C.muted}}>{profiles[friend.id].bio}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflow:"hidden"}}><ChatBox messages={msgs} loading={loading} user={user} members={fakeMembers} profiles={profiles} lang={lang} onSend={c=>api.sendDM(friend.id,c)}/></div>
      </div>
    </div>
  );
}

// ─── Public Profile Modal ─────────────────────────────────────────────────────
function PublicProfileModal({userId,currentUser,lang,onClose}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [modReason,setModReason]=useState("");
  const [modMsg,setModMsg]=useState("");
  const [myRole,setMyRole]=useState("user");

  useEffect(()=>{
    api.getPublicProfile(userId).then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));
    api.getProfile(currentUser.id).then(p=>setMyRole(p.global_role||"user")).catch(()=>{});
  },[userId,currentUser.id]);

  const doModAction=async(action,newRole)=>{
    try{
      await api.modAction({targetId:userId,action,reason:modReason,newRole});
      setModMsg("✓ Fait !");
      setTimeout(()=>setModMsg(""),3000);
      api.getPublicProfile(userId).then(setData);
    }catch(e){setModMsg("❌ "+e.message);}
  };

  if(loading) return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500}}>
      <p style={{color:C.muted}}>…</p>
    </div>
  );
  if(!data) return null;

  const badge=getBadge(data.created_at||Date.now());
  const gr=GLOBAL_ROLES[data.global_role]||GLOBAL_ROLES.user;
  const isMe=userId===currentUser.id;
  const canMod=canModerate(myRole)&&!isMe;
  const canAdm=canAdmin(myRole)&&!isMe;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:500,overflowY:"auto",padding:"32px 16px"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:18,width:"100%",maxWidth:540}}>
        {/* Header banner — pas de overflow:hidden pour que l'avatar déborde */}
        <div style={{background:`linear-gradient(135deg,${C.bg} 0%,${C.surface} 100%)`,paddingBottom:24,position:"relative",flexShrink:0}}>
          <div style={{height:70,position:"relative"}}>
            <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(ellipse at 30% 50%,${gr.bg||"transparent"} 0%,transparent 70%)`}}/>
            <button onClick={onClose} style={{position:"absolute",top:12,right:12,background:"rgba(0,0,0,0.4)",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:16,width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
          {/* Avatar + name — dans le banner pour éviter le chevauchement */}
          <div style={{padding:"0 22px",display:"flex",alignItems:"flex-end",gap:14}}>
            <div style={{width:72,height:72,borderRadius:"50%",border:`3px solid ${C.surface}`,overflow:"hidden",background:`${AV_COLORS[0]}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:700,color:C.gold,flexShrink:0,marginTop:-20}}>
              {data.avatar_url?<img src={data.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:data.username[0]?.toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <h2 style={{margin:0,fontSize:18,fontFamily:"'Playfair Display',serif",color:C.text}}>{data.username}</h2>
                {data.global_role&&data.global_role!=="user"&&<GlobalRoleBadge role={data.global_role}/>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:3,flexWrap:"wrap"}}>
                <span style={{fontSize:12,color:badge.color}}>{badge.icon} {badge.label}</span>
                {data.location&&<span style={{fontSize:11,color:C.muted}}>📍 {data.location}</span>}
                {data.gender&&data.gender!=="ns"&&<span style={{fontSize:12}}>{{m:"♂️",f:"♀️",nb:"⚧️"}[data.gender]||""}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{padding:"0 22px 22px",display:"flex",flexDirection:"column",gap:18}}>
          {/* Bio */}
          {data.bio&&<div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 14px",borderLeft:`3px solid ${C.gold}50`}}>
            <p style={{margin:0,fontSize:14,color:C.text,lineHeight:1.65,fontStyle:"italic"}}>"{data.bio}"</p>
          </div>}

          {/* Stats */}
          <div>
            <p style={{margin:"0 0 8px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1.2}}>📊 Statistiques</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {[
                {label:"🎬 Films",value:data.stats?.filmsWatched||0,color:C.gold},
                {label:"📺 Séries",value:data.stats?.seriesWatched||0,color:C.blue},
                {label:"✅ Total",value:data.stats?.totalWatched||0,color:C.success},
                {label:"⭐ Moy.",value:data.stats?.avgRating?data.stats.avgRating.toFixed(1):"—",color:C.warning},
              ].map(s=>(
                <div key={s.label} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"10px 8px",textAlign:"center",border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:20,fontWeight:800,color:s.color}}>{s.value}</div>
                  <div style={{fontSize:12,color:C.text,opacity:0.7,marginTop:3,letterSpacing:0.3,fontWeight:500}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Fav tags */}
          {data.favTags?.length>0&&<div>
            <p style={{margin:"0 0 8px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1.2}}>🏷 Tags favoris</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {data.favTags.map(tag=><span key={tag} style={{background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:99,padding:"3px 10px",fontSize:11,color:C.gold}}>#{tag}</span>)}
            </div>
          </div>}

          {/* Public lists */}
          <div>
            <p style={{margin:"0 0 8px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1.2}}>📋 Listes publiques ({data.publicLists?.length||0})</p>
            {!data.publicLists?.length
              ?<p style={{fontSize:12,color:"rgba(255,255,255,0.2)"}}>Aucune liste publique.</p>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                {data.publicLists.map(l=>(
                  <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:`1px solid ${C.border}`}}>
                    <span>{l.memberCount>1?"👥":"📋"}</span>
                    <span style={{flex:1,fontSize:13,color:C.text}}>{l.name}</span>
                    <span style={{fontSize:11,color:C.muted}}>{l.memberCount} membre{l.memberCount>1?"s":""}</span>
                  </div>
                ))}
              </div>
            }
          </div>

          {data.website&&<a href={data.website} target="_blank" rel="noreferrer" style={{fontSize:12,color:C.blue,textDecoration:"none"}}>🔗 {data.website}</a>}

          {/* Moderation */}
          {canMod&&<div style={{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:12,padding:"14px 16px"}}>
            <p style={{margin:"0 0 10px",fontSize:12,color:C.danger,textTransform:"uppercase",letterSpacing:1.2}}>🛡 Modération</p>
            <input value={modReason} onChange={e=>setModReason(e.target.value)} placeholder="Raison…" style={{...IS,fontSize:12,marginBottom:8}}/>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={()=>doModAction("warn")} style={{...BS,fontSize:11,padding:"5px 10px",color:C.warning,borderColor:"rgba(245,158,11,0.3)"}}>⚠️ Avertir</button>
              {canAdm&&<>
                <button onClick={()=>doModAction("ban")} style={{...BS,fontSize:11,padding:"5px 10px",color:C.danger,borderColor:"rgba(248,113,113,0.3)"}}>🚫 Bannir</button>
                <button onClick={()=>doModAction("unban")} style={{...BS,fontSize:11,padding:"5px 10px",color:C.success,borderColor:"rgba(16,185,129,0.3)"}}>✅ Débannir</button>
                <select onChange={e=>e.target.value&&doModAction("role_change",e.target.value)} defaultValue="" style={{...IS,width:"auto",fontSize:11,padding:"5px 8px"}}>
                  <option value="" disabled>Changer le rôle…</option>
                  <option value="moderator">🛡 Modérateur</option>
                  <option value="vip">💎 VIP</option>
                  <option value="user">👤 Membre</option>
                  {myRole==="superadmin"&&<option value="admin">⚡ Admin</option>}
                </select>
              </>}
            </div>
            {/* Superadmin: delete account */}
            {myRole==="superadmin"&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(248,113,113,0.2)"}}>
                <p style={{margin:"0 0 8px",fontSize:11,color:C.muted}}>Zone dangereuse — irréversible</p>
                <button onClick={async()=>{
                  if(!window.confirm(`Supprimer définitivement le compte de "${data.username}" ?`)) return;
                  if(!window.confirm(`CONFIRMATION FINALE — Toutes les données de "${data.username}" seront effacées.`)) return;
                  try{
                    await api.modAction({targetId:userId,action:"delete_account",reason:modReason||"Suppression par superadmin"});
                    setModMsg("✓ Compte supprimé.");
                    setTimeout(()=>onClose(),1500);
                  }catch(e){setModMsg("❌ "+e.message);}
                }} style={{background:"rgba(248,113,113,0.15)",border:"1px solid rgba(248,113,113,0.4)",borderRadius:8,padding:"7px 14px",fontSize:12,color:C.danger,cursor:"pointer",fontFamily:"inherit",fontWeight:700,width:"100%"}}>
                  🗑 Supprimer ce compte
                </button>
              </div>
            )}
            {modMsg&&<p style={{fontSize:12,color:modMsg.startsWith("✓")?C.success:C.danger,margin:"8px 0 0",fontWeight:600}}>{modMsg}</p>}
          </div>}

          <p style={{margin:0,fontSize:13,color:C.text,opacity:0.45,textAlign:"center"}}>
            Membre depuis {new Date(data.created_at).toLocaleDateString(lang==="fr"?"fr-FR":"en-US",{year:"numeric",month:"long"})}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Friends Panel ────────────────────────────────────────────────────────────
function FriendsPanel({user,profiles,lang,onClose,onOpenDM,onViewProfile}){
  const [friends,setFriends]=useState([]);
  const [searchQ,setSearchQ]=useState("");
  const [searchRes,setSearchRes]=useState([]);
  const [searching,setSearching]=useState(false);
  const [msg,setMsg]=useState("");

  useEffect(()=>{loadFriends();},[]);
  const loadFriends=()=>api.getFriends().then(setFriends).catch(()=>{});

  const doSearch=async()=>{
    if(searchQ.trim().length<2) return;
    setSearching(true);
    try{setSearchRes(await api.searchUsers(searchQ));}catch{}
    setSearching(false);
  };

  const sendReq=async(id)=>{
    try{await api.sendFriendReq(id);setMsg("Demande envoyée !");setTimeout(()=>setMsg(""),2000);loadFriends();}
    catch(e){setMsg(e.message);setTimeout(()=>setMsg(""),2500);}
  };

  const accept=async(id)=>{await api.acceptFriend(id);loadFriends();};
  const reject=async(id)=>{await api.rejectFriend(id);loadFriends();};
  const remove=async(id)=>{await api.removeFriend(id);loadFriends();};

  const pending=friends.filter(f=>f.status==="pending"&&f.addressee_id===user.id);
  const accepted=friends.filter(f=>f.status==="accepted");

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"flex-end",zIndex:300}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:340,background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",height:"100vh",overflowY:"auto"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <h3 style={{margin:0,fontSize:15,color:C.text,flex:1}}>👥 Amis</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:16}}>
          {/* Search */}
          <div>
            <p style={{margin:"0 0 6px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>Ajouter un ami</p>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Chercher un utilisateur…" style={{...IS,flex:1}}/>
              <button onClick={doSearch} style={{...BS,padding:"8px 12px",fontSize:12}}>🔍</button>
            </div>
            {msg&&<p style={{fontSize:11,color:C.success,margin:"0 0 6px"}}>{msg}</p>}
            {searching&&<p style={{fontSize:12,color:C.muted}}>…</p>}
            {searchRes.map(u2=>{
              const already=friends.some(f=>f.requester_id===u2.id||f.addressee_id===u2.id);
              return(
                <div key={u2.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <Avatar username={u2.username} avatarUrl={u2.avatar_url} index={0} size={28} onClick={()=>onViewProfile&&onViewProfile(u2.id)}/>
                  <span style={{flex:1,fontSize:13,color:C.text,cursor:"pointer"}} onClick={()=>onViewProfile&&onViewProfile(u2.id)}>{u2.username}</span>
                  {!already&&<button onClick={()=>sendReq(u2.id)} style={{...BS,fontSize:11,padding:"4px 10px"}}>+ Ajouter</button>}
                  {already&&<span style={{fontSize:11,color:C.muted}}>{friends.some(f=>f.status==="accepted"&&(f.requester_id===u2.id||f.addressee_id===u2.id))?"Déjà ami":"Demande envoyée"}</span>}
                </div>
              );
            })}
          </div>

          {/* Pending */}
          {pending.length>0&&<div>
            <p style={{margin:"0 0 8px",fontSize:12,color:C.warning,textTransform:"uppercase",letterSpacing:1}}>Demandes reçues ({pending.length})</p>
            {pending.map(f=>(
              <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <Avatar username={f.other.username} avatarUrl={profiles[f.other.id]?.avatar_url} index={0} size={28} onClick={()=>onViewProfile&&onViewProfile(f.other.id)}/>
                <span style={{flex:1,fontSize:14,color:C.text,fontWeight:600}}>{f.other.username}</span>
                <button onClick={()=>accept(f.id)} style={{...BP,fontSize:11,padding:"4px 10px"}}>✓</button>
                <button onClick={()=>reject(f.id)} style={{...BS,fontSize:11,padding:"4px 8px"}}>✗</button>
              </div>
            ))}
          </div>}

          {/* Friends list */}
          <div>
            <p style={{margin:"0 0 8px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>Amis ({accepted.length})</p>
            {accepted.length===0&&<p style={{fontSize:12,color:"rgba(255,255,255,0.15)"}}>Aucun ami pour l'instant.</p>}
            {accepted.map(f=>{
              const prof=profiles[f.other.id]||{};
              const badge=getBadge(f.other.created_at||Date.now());
              return(
                <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <Avatar username={f.other.username} avatarUrl={prof.avatar_url} index={0} size={32} createdAt={f.other.created_at} onClick={()=>onViewProfile&&onViewProfile(f.other.id)}/>
                  <div style={{flex:1,cursor:"pointer"}} onClick={()=>onViewProfile&&onViewProfile(f.other.id)}>
                    <div style={{fontSize:14,color:C.text,fontWeight:600}}>{f.other.username}</div>
                    <div style={{fontSize:12,color:badge.color}}>{badge.icon} {badge.label}</div>
                  </div>
                  <button onClick={()=>onOpenDM(f.other)} style={{...BS,fontSize:11,padding:"4px 10px"}}>💬</button>
                  <button onClick={()=>remove(f.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.2)",fontSize:14,padding:"4px"}}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Image Crop/Zoom Modal ────────────────────────────────────────────────────
function ImageCropModal({src,onConfirm,onClose}){
  const [scale,setScale]=useState(1);
  const [offsetX,setOffsetX]=useState(0);
  const [offsetY,setOffsetY]=useState(0);
  const [dragging,setDragging]=useState(false);
  const [startPos,setStartPos]=useState({x:0,y:0});
  const canvasRef=useRef();

  const SIZE=240;

  const draw=()=>{
    const canvas=canvasRef.current;if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const img=new Image();
    img.onload=()=>{
      ctx.clearRect(0,0,SIZE,SIZE);
      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(SIZE/2,SIZE/2,SIZE/2,0,Math.PI*2);
      ctx.clip();
      const sw=img.width*scale;
      const sh=img.height*scale;
      const x=(SIZE-sw)/2+offsetX;
      const y=(SIZE-sh)/2+offsetY;
      ctx.drawImage(img,x,y,sw,sh);
      ctx.restore();
      // Circle border
      ctx.beginPath();
      ctx.arc(SIZE/2,SIZE/2,SIZE/2-1,0,Math.PI*2);
      ctx.strokeStyle="rgba(201,168,76,0.6)";
      ctx.lineWidth=2;
      ctx.stroke();
    };
    img.src=src;
  };

  useEffect(()=>{draw();},[scale,offsetX,offsetY,src]);

  const onMouseDown=e=>{setDragging(true);setStartPos({x:e.clientX-offsetX,y:e.clientY-offsetY});};
  const onMouseMove=e=>{if(!dragging) return;setOffsetX(e.clientX-startPos.x);setOffsetY(e.clientY-startPos.y);};
  const onMouseUp=()=>setDragging(false);

  const confirm=()=>{
    const canvas=canvasRef.current;if(!canvas) return;
    onConfirm(canvas.toDataURL("image/jpeg",0.85));
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:800,padding:16}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:"100%",maxWidth:340,display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
        <h3 style={{margin:0,fontSize:16,color:C.text}}>✂️ Recadrer la photo</h3>
        <canvas ref={canvasRef} width={SIZE} height={SIZE}
          style={{borderRadius:"50%",cursor:dragging?"grabbing":"grab",touchAction:"none"}}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}/>
        <div style={{width:"100%"}}>
          <label style={{...LB,textAlign:"center",display:"block"}}>Zoom</label>
          <input type="range" min="0.3" max="3" step="0.05" value={scale}
            onChange={e=>setScale(parseFloat(e.target.value))}
            style={{width:"100%",accentColor:C.gold}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted}}>
            <span>−</span><span>{Math.round(scale*100)}%</span><span>+</span>
          </div>
        </div>
        <p style={{margin:0,fontSize:11,color:C.muted,textAlign:"center"}}>Glisse l'image pour recadrer</p>
        <div style={{display:"flex",gap:10,width:"100%"}}>
          <button onClick={onClose} style={{...BS,flex:1}}>Annuler</button>
          <button onClick={confirm} style={{...BP,flex:1}}>✓ Confirmer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({user,lang,setLang,theme,setTheme,onClose,onUpdated}){
  const [profile,setProfile]=useState({avatar_url:"",bio:"",confirm_delete:true,gender:"",location:"",website:""});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const fileRef=useRef();

  useEffect(()=>{api.getProfile(user.id).then(p=>setProfile(p)).catch(()=>{});},[user.id]);

  const [cropSrc,setCropSrc]=useState(null);

  const handleFile=e=>{
    const file=e.target.files?.[0];if(!file) return;
    if(file.size>5_000_000){setMsg("Image trop grande (max 5Mo)");return;}
    const reader=new FileReader();
    reader.onload=()=>setCropSrc(reader.result);
    reader.readAsDataURL(file);e.target.value="";
  };

  const handleGravatar=()=>{
    const email=prompt("Ton adresse email pour Gravatar :");if(!email) return;
    setProfile(p=>({...p,avatar_url:`https://www.gravatar.com/avatar/${encodeURIComponent(email.trim().toLowerCase())}?s=200&d=identicon`}));
  };

  const save=async()=>{
    setSaving(true);
    try{
      await api.updateProfile({avatar_url:profile.avatar_url,bio:profile.bio,confirm_delete:profile.confirm_delete,gender:profile.gender||"",location:profile.location||"",website:profile.website||""});
      setMsg("Profil sauvegardé !");setTimeout(()=>setMsg(""),2000);onUpdated?.();
    }catch(e){setMsg(e.message);}
    setSaving(false);
  };

  const badge=getBadge(profile.created_at||user.createdAt||Date.now());

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:26,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,fontSize:17,fontFamily:"'Playfair Display',serif",color:C.text,flex:1}}>⚙️ Mon profil</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        {/* Avatar */}
        <div style={{display:"flex",gap:16,marginBottom:20,alignItems:"center"}}>
          <div style={{position:"relative"}}>
            <div style={{width:72,height:72,borderRadius:"50%",overflow:"hidden",background:"rgba(255,255,255,0.06)",border:`2px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>
              {profile.avatar_url?<img src={profile.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={()=>setProfile(p=>({...p,avatar_url:""}))}/>
                :<span style={{fontWeight:700,color:C.gold}}>{user.username[0]?.toUpperCase()}</span>}
            </div>
            <span style={{position:"absolute",bottom:0,right:0,fontSize:18}} title={badge.label}>{badge.icon}</span>
          </div>
          <div style={{flex:1}}>
            <p style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:C.text}}>{user.username}</p>
            <p style={{margin:"0 0 8px",fontSize:11,color:badge.color}}>{badge.icon} {badge.label}</p>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>fileRef.current?.click()} style={{...BS,fontSize:11,padding:"4px 10px"}}>📁 Importer</button>
              <button onClick={handleGravatar} style={{...BS,fontSize:11,padding:"4px 10px"}}>🌐 Gravatar</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={LB}>Bio (200 car. max)</label>
            <textarea value={profile.bio||""} onChange={e=>setProfile(p=>({...p,bio:e.target.value.slice(0,200)}))} rows={2} style={{...IS,resize:"vertical",fontFamily:"inherit"}} placeholder="Dis quelque chose sur toi…"/>
            <p style={{margin:"4px 0 0",fontSize:12,color:C.text,opacity:0.65,textAlign:"right"}}>{(profile.bio||"").length}/200</p>
          </div>
          <div>
            <label style={LB}>Genre</label>
            <select value={profile.gender||""} onChange={e=>setProfile(p=>({...p,gender:e.target.value}))} style={IS}>
              <option value="">—</option>
              <option value="m">Homme</option>
              <option value="f">Femme</option>
              <option value="nb">Non-binaire</option>
              <option value="ns">Préfère ne pas dire</option>
            </select>
          </div>
          <div>
            <label style={LB}>Localisation</label>
            <input value={profile.location||""} onChange={e=>setProfile(p=>({...p,location:e.target.value}))} placeholder="Paris, France" style={IS}/>
          </div>
          <div>
            <label style={LB}>Site web</label>
            <input value={profile.website||""} onChange={e=>setProfile(p=>({...p,website:e.target.value}))} placeholder="https://…" style={IS}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"rgba(255,255,255,0.03)",borderRadius:10,border:`1px solid ${C.border}`}}>
            <div style={{flex:1}}>
              <p style={{margin:0,fontSize:13,color:C.text}}>Confirmer avant suppression</p>
              <p style={{margin:"3px 0 0",fontSize:11,color:C.muted}}>Affiche une confirmation avant de supprimer un titre.</p>
            </div>
            <div onClick={()=>setProfile(p=>({...p,confirm_delete:!p.confirm_delete}))} style={{width:40,height:22,borderRadius:99,background:profile.confirm_delete?C.gold:"rgba(255,255,255,0.1)",cursor:"pointer",transition:"background 0.2s",position:"relative",flexShrink:0}}>
              <div style={{position:"absolute",top:2,left:profile.confirm_delete?20:2,width:18,height:18,borderRadius:"50%",background:"white",transition:"left 0.2s"}}/>
            </div>
          </div>
          <div><label style={LB}>{t(lang,"language")}</label><LangToggle lang={lang} setLang={setLang}/></div>
          <div>
            <label style={LB}>Thème</label>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
              {Object.entries(THEMES).map(([key,th])=>(
                <button key={key} onClick={()=>setTheme(key)}
                  style={{background:theme===key?`${C.gold}18`:"rgba(255,255,255,0.04)",border:`1px solid ${theme===key?C.gold:C.border}`,borderRadius:8,padding:"8px 6px",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <span style={{fontSize:18}}>{th.icon}</span>
                  <span style={{fontSize:11,color:theme===key?C.gold:C.muted,fontWeight:theme===key?700:400}}>{th.name}</span>
                  <div style={{display:"flex",gap:2,marginTop:2}}>
                    {[th.bg,th.surface,th.gold].map((col,i)=>(
                      <div key={i} style={{width:10,height:10,borderRadius:"50%",background:col,border:"1px solid rgba(255,255,255,0.1)"}}/>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {msg&&<p style={{fontSize:12,color:msg.includes("!")?C.success:C.danger,margin:0,textAlign:"center"}}>{msg}</p>}
          <button onClick={save} disabled={saving} style={{...BP,width:"100%",opacity:saving?0.7:1}}>{saving?"…":"Sauvegarder"}</button>

          {/* Account deletion */}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14,marginTop:4}}>
            <p style={{margin:"0 0 8px",fontSize:11,color:C.muted}}>Zone dangereuse</p>
            <button onClick={async()=>{
              if(!window.confirm("Supprimer définitivement ton compte ? Cette action est irréversible et effacera toutes tes données.")) return;
              if(!window.confirm("Tu es vraiment sûr·e ? Toutes tes listes dont tu es créateur seront aussi supprimées.")) return;
              try{await api.deleteAccount();api.clearSession();window.location.reload();}
              catch(e){setMsg("❌ "+e.message);}
            }} style={{...BD,width:"100%",fontSize:12}}>🗑 Supprimer mon compte</button>
          </div>
        </div>
      </div>
      {cropSrc&&<ImageCropModal src={cropSrc} onConfirm={url=>{setProfile(p=>({...p,avatar_url:url}));setCropSrc(null);}} onClose={()=>setCropSrc(null)}/>}
    </div>
  );
}

// ─── List Settings Modal ──────────────────────────────────────────────────────
function ListSettingsModal({list,user,lang,profiles,onClose,onUpdated,onDeleted}){
  const [name,setName]=useState(list.name);
  const [saving,setSaving]=useState(false);
  const [copied,setCopied]=useState(false);
  const [confirmDel,setConfirmDel]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const me=list.members?.find(m=>m.id===user.id);
  const canManage=me?.role==="owner"||me?.role==="admin";

  const ROLE_META={
    owner: {label:"👑 Owner",  color:"#C9A84C"},
    admin: {label:"⚡ Admin",  color:"#F87171"},
    moderator:{label:"🛡 Modo",color:"#60A5FA"},
    member:{label:"Membre",    color:C.muted},
  };

  const save=async()=>{
    if(!name.trim()||name===list.name) return;
    setSaving(true);
    try{await api.renameList(list.id,name.trim());onUpdated();}
    catch(e){alert(e.message);}
    setSaving(false);
  };

  const changeRole=async(memberId,role)=>{
    try{await api.updateMemberRole(list.id,memberId,role);onUpdated();}
    catch(e){alert(e.message);}
  };

  const kick=async(memberId)=>{
    if(!window.confirm("Exclure ce membre ?")) return;
    try{await api.removeMember(list.id,memberId);onUpdated();}
    catch(e){alert(e.message);}
  };

  const handleDeleteList=async()=>{
    setDeleting(true);
    try{await api.deleteList(list.id);onDeleted();}
    catch(e){alert(e.message);}
    setDeleting(false);
  };

  const copy=()=>navigator.clipboard.writeText(list.invite_code).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});

  // Sort members: owner first, then by role level
  const roleOrder={owner:0,admin:1,moderator:2,member:3};
  const sortedMembers=[...(list.members||[])].sort((a,b)=>(roleOrder[a.role]||3)-(roleOrder[b.role]||3));

  return(
    <>
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:250,padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:26,width:"100%",maxWidth:460,maxHeight:"88vh",overflowY:"auto",boxSizing:"border-box"}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,fontSize:17,fontFamily:"'Playfair Display',serif",color:C.text,flex:1}}>⚙️ {list.name}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>×</button>
        </div>

        {/* Rename */}
        {canManage&&<div style={{marginBottom:18}}>
          <label style={LB}>Nom de la liste</label>
          <div style={{display:"flex",gap:8}}>
            <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} style={{...IS,flex:1}}/>
            <button onClick={save} disabled={saving||name===list.name} style={{...BP,padding:"8px 14px",opacity:saving||name===list.name?0.5:1}}>OK</button>
          </div>
        </div>}

        {/* Invite code */}
        <div style={{marginBottom:18}}>
          <label style={LB}>Code d'invitation</label>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{flex:1,background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.22)",borderRadius:8,padding:"8px 14px",fontSize:18,fontWeight:700,letterSpacing:8,color:C.gold,fontFamily:"monospace",textAlign:"center"}}>{list.invite_code}</div>
            <button onClick={copy} style={{...BS,padding:"8px 12px"}}>{copied?"✓":"📋"}</button>
          </div>
        </div>

        {/* Members */}
        <div style={{marginBottom:me?.role==="owner"?18:0}}>
          <label style={LB}>Membres ({sortedMembers.length})</label>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {sortedMembers.map((m,i)=>{
              const isMe=m.id===user.id;
              const rm=ROLE_META[m.role]||ROLE_META.member;
              const prof=profiles?.[m.id]||{};
              const memberStatus=getStatus(lang);
              return(
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,0.03)",borderRadius:10,border:`1px solid ${m.role==="owner"?"rgba(201,168,76,0.2)":C.border}`}}>
                  <Avatar username={m.username} avatarUrl={prof.avatar_url} index={i} size={34} createdAt={prof.created_at}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,color:C.text,fontWeight:isMe?600:400}}>{m.username}{isMe&&<span style={{fontSize:12,color:C.muted}}> (toi)</span>}</div>
                    {m.role!=="member"&&<span style={{fontSize:12,color:rm.color,background:`${rm.color}18`,padding:"1px 7px",borderRadius:99,border:`1px solid ${rm.color}30`}}>{rm.label}</span>}
                  </div>
                  {canManage&&!isMe&&m.role!=="owner"&&(
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      <select value={m.role} onChange={e=>changeRole(m.id,e.target.value)} style={{...IS,width:"auto",fontSize:11,padding:"3px 6px",background:C.card}}>
                        <option value="admin">⚡ Admin</option>
                        <option value="moderator">🛡 Modo</option>
                        <option value="member">👤 Membre</option>
                      </select>
                      {me?.role==="owner"&&<button onClick={()=>kick(m.id)} title="Exclure" style={{background:"none",border:"none",cursor:"pointer",color:C.danger,fontSize:15,padding:"2px 4px",lineHeight:1}}>✕</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Delete list (owner only) */}
        {me?.role==="owner"&&(
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,marginTop:4}}>
            <p style={{margin:"0 0 10px",fontSize:11,color:C.muted}}>Zone dangereuse — tous les membres seront notifiés.</p>
            <button onClick={()=>setConfirmDel(true)} style={{...BD,width:"100%",fontSize:13}}>🗑 Supprimer cette liste</button>
          </div>
        )}
      </div>
    </div>

    {/* Confirm delete list */}
    {confirmDel&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16}}>
        <div style={{background:C.surface,border:"1px solid rgba(248,113,113,0.4)",borderRadius:16,padding:28,maxWidth:360,width:"100%",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
          <h3 style={{margin:"0 0 8px",color:C.text}}>Supprimer "{list.name}" ?</h3>
          <p style={{margin:"0 0 6px",fontSize:13,color:C.muted}}>Cette action est <strong>irréversible</strong>.</p>
          <p style={{margin:"0 0 22px",fontSize:13,color:C.muted}}>Tous les membres ({list.members?.length||0}) seront notifiés.</p>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={()=>setConfirmDel(false)} style={BS} disabled={deleting}>Annuler</button>
            <button onClick={handleDeleteList} style={BD} disabled={deleting}>{deleting?"…":"🗑 Supprimer définitivement"}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────
function HomePage({user,profiles,lang,isMob,onOpenList,onViewProfile,onSearch,onOpenSettings,onOpenFriends,onOpenWatchlog,unreadCount}){
  const [feed,setFeed]=useState(null);
  const [loading,setLoading]=useState(true);
  const [trending,setTrending]=useState([]);
  const [addToListModal,setAddToListModal]=useState(null);

  useEffect(()=>{
    api.getHomeFeed().then(d=>{setFeed(d);setLoading(false);}).catch(()=>setLoading(false));
    // Search trending from TMDB/iTunes
    import('./lib/tmdb.js').then(m=>m.getTMDBTrending().then(setTrending)).catch(()=>{});
  },[]);

  const myProfile=profiles[user.id]||{};
  const badge=getBadge(myProfile.created_at||Date.now());

  return(
    <div style={{minHeight:"100%",padding:"0 0 40px"}}>
      {/* Hero header */}
      <div style={{background:`linear-gradient(135deg,${C.bg} 0%,#16103a 100%)`,padding:"28px 28px 24px",borderBottom:`1px solid ${C.border}`,marginBottom:28}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          <Avatar username={user.username} avatarUrl={myProfile.avatar_url} index={0} size={52} createdAt={myProfile.created_at} onClick={onOpenSettings}/>
          <div style={{flex:1}}>
            <h2 style={{margin:0,fontSize:20,fontFamily:"'Playfair Display',serif",color:C.text}}>
              Bonjour, <span style={{color:C.gold}}>{user.username}</span> 👋
            </h2>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:3,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:badge.color}}>{badge.icon} {badge.label}</span>
              {myProfile.global_role&&myProfile.global_role!=="user"&&<GlobalRoleBadge role={myProfile.global_role}/>}
            </div>
          </div>
        </div>
        {/* Quick actions */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onSearch} style={{...BP,fontSize:12,padding:"8px 14px"}}>🔍 Rechercher</button>
          <button onClick={onOpenWatchlog} style={{...BS,fontSize:12,padding:"8px 14px"}}>📖 Mon journal</button>
          <button onClick={onOpenFriends} style={{position:"relative",...BS,fontSize:12,padding:"8px 14px"}}>
            👥 Amis
            {unreadCount>0&&<NotifBadge count={unreadCount}/>}
          </button>
          <button onClick={onOpenSettings} style={{...BS,fontSize:12,padding:"8px 14px"}}>⚙️ Profil</button>
        </div>
      </div>

      <div style={{padding:isMob?"0 12px":"0 28px",paddingBottom:isMob?80:0}}>
        {/* Trending FIRST */}
        {trending.length>0&&(
          <div style={{marginBottom:28}}>
            <h3 style={{margin:"0 0 14px",fontSize:14,color:C.text,fontFamily:"'Playfair Display',serif"}}>🔥 Tendances</h3>
            <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${isMob?"110px":"130px"},1fr))`,gap:isMob?8:12}}>
              {trending.slice(0,12).map((item,i)=>(
                <div key={i} style={{background:C.card,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`,cursor:"pointer",transition:"transform 0.15s,border-color 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.borderColor=`${C.gold}50`;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.borderColor=C.border;}}
                  onClick={()=>setAddToListModal(item)}>
                  <div style={{height:180,position:"relative",background:"rgba(255,255,255,0.03)"}}>
                    {item.poster_url?<img src={item.poster_url} alt={item.title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                      :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,opacity:0.1}}>🎬</div>}
                    <div style={{position:"absolute",inset:0,background:`linear-gradient(to top,${C.bg}cc 0%,transparent 50%)`}}/>
                    {item.rating>0&&<div style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.6)",borderRadius:99,padding:"2px 7px",fontSize:12,color:C.warning}}>⭐ {item.rating}</div>}
                  </div>
                  <div style={{padding:"8px 10px"}}>
                    <p style={{margin:0,fontSize:13,color:C.text,fontWeight:700,lineHeight:1.35,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.title}</p>
                    <p style={{margin:"4px 0 0",fontSize:12,color:C.text,opacity:0.65}}>{CAT_LABEL[item.category]||item.category} {item.year&&`· ${item.year}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friend activity SECOND */}
        {feed?.friendActivity?.length>0&&(
          <div style={{marginBottom:28}}>
            <h3 style={{margin:"0 0 14px",fontSize:14,color:C.text,fontFamily:"'Playfair Display',serif"}}>🟢 Activité de tes amis</h3>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {feed.friendActivity.slice(0,8).map((a,i)=>{
                const st=getStatus(lang)[a.status]||getStatus(lang).a_voir;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:C.card,borderRadius:10,border:`1px solid ${C.border}`,cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=`${C.gold}40`}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                    <Avatar username={a.username} avatarUrl={a.avatar_url} index={i} size={34} onClick={()=>onViewProfile(a.user_id)}/>
                    <div style={{flex:1}}>
                      <span style={{fontSize:14,color:C.text,fontWeight:700,cursor:"pointer"}} onClick={()=>onViewProfile(a.user_id)}>{a.username}</span>
                      <span style={{fontSize:14,color:C.text,opacity:0.7}}> a mis </span>
                      <span style={{fontSize:14,color:C.text,fontWeight:700}}>{a.title}</span>
                      <span style={{fontSize:14,color:C.text,opacity:0.7}}> en </span>
                      <span style={{fontSize:14,color:st.color,fontWeight:700}}>{st.label}</span>
                    </div>
                    {a.poster_url&&(
                      <img src={a.poster_url} alt="" style={{width:36,height:52,objectFit:"cover",borderRadius:5,cursor:"pointer",border:`1px solid ${C.border}`}}
                        onClick={()=>setAddToListModal({title:a.title,poster_url:a.poster_url,category:a.category||"film"})}/>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* News */}
        {feed?.news?.length>0&&(
          <div style={{marginBottom:28}}>
            <h3 style={{margin:"0 0 14px",fontSize:14,color:C.text,fontFamily:"'Playfair Display',serif"}}>📰 Dernières news</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
              {feed.news.slice(0,4).map(n=>(
                <div key={n.id} style={{background:C.card,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
                  {n.cover_url&&<img src={n.cover_url} alt="" style={{width:"100%",height:120,objectFit:"cover",display:"block"}}/>}
                  <div style={{padding:"12px 14px"}}>
                    <h4 style={{margin:"0 0 6px",fontSize:14,color:C.text,fontFamily:"'Playfair Display',serif",lineHeight:1.3}}>{n.title}</h4>
                    <p style={{margin:"0 0 8px",fontSize:11,color:C.muted,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{n.content}</p>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12,color:C.muted}}>par {n.author_name}</span>
                      <span style={{fontSize:12,color:C.muted,marginLeft:"auto"}}>❤️ {n.likes}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading&&!feed?.news?.length&&!trending.length&&(
          <div style={{textAlign:"center",color:C.muted,paddingTop:60}}>
            <div style={{fontSize:52,marginBottom:12}}>🎬</div>
            <p style={{margin:0,fontSize:15}}>Commence par créer une liste ou rechercher un film !</p>
          </div>
        )}
      </div>

      {/* Quick add to list modal */}
      {addToListModal&&<QuickAddModal item={addToListModal} user={user} lang={lang} onClose={()=>setAddToListModal(null)}/>}
    </div>
  );
}

// ─── Quick Add Modal (from home trending) ─────────────────────────────────────
function QuickAddModal({item,user,lang,onClose}){
  const [lists,setLists]=useState([]);
  const [selected,setSelected]=useState("");
  const [status,setStatus]=useState("a_voir");
  const [adding,setAdding]=useState(false);
  const [done,setDone]=useState(false);

  useEffect(()=>{api.getLists().then(setLists);},[]);

  const [dest,setDest]=useState("list"); // "list" | "log"

  const add=async()=>{
    setAdding(true);
    try{
      if(dest==="log"){
        await api.addToWatchlog({title:item.title,category:item.category||"film",poster_url:item.poster_url||"",status,tags:[],rating:0,minutes:0,season:0,episode:0,tmdb_id:item.tmdb_id||null});
      } else {
        if(!selected){setAdding(false);return;}
        await api.createItem(selected,{title:item.title,category:item.category||"film",poster_url:item.poster_url||"",tags:[],user_progress:{[user.id]:{status,minutes:"",season:"",episode:"",rating:0}},tmdb_id:item.tmdb_id||null});
      }
      setDone(true);setTimeout(()=>onClose(),1200);
    }catch(e){alert(e.message);}
    setAdding(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:"100%",maxWidth:380}}>
        <div style={{display:"flex",gap:12,marginBottom:16}}>
          {item.poster_url&&<img src={item.poster_url} alt="" style={{width:52,height:76,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
          <div>
            <h3 style={{margin:0,fontSize:16,color:C.text,fontFamily:"'Playfair Display',serif"}}>{item.title}</h3>
            <p style={{margin:"4px 0 0",fontSize:12,color:C.muted}}>{CAT_LABEL[item.category]||item.category} {item.year&&`· ${item.year}`}</p>
          </div>
        </div>
        {done?<p style={{textAlign:"center",color:C.success,fontSize:15,padding:"10px 0"}}>✓ Ajouté !</p>:(
          <>
            {/* Destination tabs */}
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:14}}>
              {[{k:"list",l:"📋 Une liste"},{k:"log",l:"📖 Mon journal"}].map(d=>(
                <button key={d.k} onClick={()=>setDest(d.k)} style={{flex:1,background:dest===d.k?`${C.gold}18`:"transparent",border:"none",borderBottom:dest===d.k?`2px solid ${C.gold}`:"2px solid transparent",padding:"9px 6px",fontSize:12,color:dest===d.k?C.gold:C.muted,cursor:"pointer",fontFamily:"inherit"}}>{d.l}</button>
              ))}
            </div>
            {dest==="list"&&<div style={{marginBottom:12}}><label style={LB}>Choisir une liste</label>
              <select value={selected} onChange={e=>setSelected(e.target.value)} style={IS}>
                <option value="">— Sélectionne une liste —</option>
                {lists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>}
            <div style={{marginBottom:16}}><label style={LB}>Statut</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={IS}>
                <option value="a_voir">{t(lang,"to_watch")}</option>
                <option value="en_cours">{t(lang,"watching")}</option>
                <option value="termine">{t(lang,"watched")}</option>
              </select>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={onClose} style={BS}>{t(lang,"cancel")}</button>
              <button onClick={add} disabled={adding||(dest==="list"&&!selected)} style={{...BP,flex:1,opacity:(dest==="list"&&!selected)||adding?0.5:1}}>{adding?"…":"+ Ajouter"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Watchlog Page (perso, sans liste) ───────────────────────────────────────
function WatchlogPage({user,lang,onClose}){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null);
  const [filterStatus,setFilterStatus]=useState("all");
  const [filterCat,setFilterCat]=useState("all");
  const [search,setSearch]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);

  useEffect(()=>{api.getWatchlog().then(d=>{setItems(d);setLoading(false);});},[]);

  const deleteItem=async(id)=>{await api.deleteWatchlog(id);setItems(p=>p.filter(i=>i.id!==id));};

  const handleSearchSelect=async(tmdbItem)=>{
    setItems(prev=>[...prev]);
    setModal({title:tmdbItem.title,category:tmdbItem.category||"film",poster_url:tmdbItem.poster_url||"",tags:[],status:"a_voir",rating:0,minutes:0,season:0,episode:0,notes:"",tmdb_id:tmdbItem.tmdb_id||null});
  };

  const save=async(form)=>{
    if(form.id){await api.updateWatchlog(form.id,form);setItems(p=>p.map(i=>i.id===form.id?{...i,...form}:i));}
    else{const saved=await api.addToWatchlog(form);setItems(p=>[saved,...p]);}
    setModal(null);
  };

  const filtered=items.filter(i=>{
    if(filterStatus!=="all"&&i.status!==filterStatus) return false;
    if(filterCat!=="all"&&i.category!==filterCat) return false;
    if(search&&!i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return(
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:250,display:"flex",flexDirection:"column",overflowY:"auto"}}>
      <div style={{padding:"16px 22px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0,background:C.surface}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>←</button>
        <h2 style={{margin:0,fontSize:17,fontFamily:"'Playfair Display',serif",flex:1}}>📖 Mon journal</h2>
        <button onClick={()=>setSearchOpen(true)} style={{...BS,fontSize:12,padding:"7px 12px"}}>🔍 Chercher</button>
        <button onClick={()=>setModal({})} style={{...BP,fontSize:13}}>+ Ajouter</button>
      </div>
      <div style={{padding:"12px 22px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:4,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filtrer…" style={{...IS,maxWidth:200,marginRight:8}}/>
        <FBtn label="Tous" active={filterStatus==="all"} onClick={()=>setFilterStatus("all")}/>
        <FBtn label={t(lang,"to_watch")} active={filterStatus==="a_voir"} color={C.muted} onClick={()=>setFilterStatus("a_voir")}/>
        <FBtn label={t(lang,"watching")} active={filterStatus==="en_cours"} color={C.warning} onClick={()=>setFilterStatus("en_cours")}/>
        <FBtn label={t(lang,"watched")} active={filterStatus==="termine"} color={C.success} onClick={()=>setFilterStatus("termine")}/>
        <span style={{color:C.border,margin:"0 3px"}}>|</span>
        {CATEGORIES.slice(0,4).map(c=><FBtn key={c.id} label={c.label.replace(/[^\w\s]/g,"").trim()} active={filterCat===c.id} onClick={()=>setFilterCat(filterCat===c.id?"all":c.id)}/>)}
      </div>
      <div style={{flex:1,padding:"18px 22px"}}>
        {loading&&<p style={{color:C.muted,textAlign:"center",paddingTop:40}}>…</p>}
        {!loading&&filtered.length===0&&<div style={{textAlign:"center",color:C.muted,paddingTop:60}}><div style={{fontSize:44,marginBottom:12}}>📖</div><p>Ton journal est vide. Ajoute tes premiers titres !</p></div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
          {filtered.map(item=>{
            const st=getStatus(lang)[item.status]||getStatus(lang).a_voir;
            return(
              <div key={item.id} style={{background:C.card,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`,display:"flex",flexDirection:"column"}}>
                <div style={{height:160,position:"relative",background:"rgba(255,255,255,0.03)"}}>
                  {item.poster_url?<img src={item.poster_url} alt={item.title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                    :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,opacity:0.1}}>🎬</div>}
                  <div style={{position:"absolute",top:8,right:8}}>
                    <span style={{fontSize:11,background:`${st.color}20`,color:st.color,padding:"2px 7px",borderRadius:99,border:`1px solid ${st.color}40`}}>{st.label}</span>
                  </div>
                </div>
                <div style={{padding:"9px 11px",flex:1,display:"flex",flexDirection:"column",gap:4}}>
                  <p style={{margin:0,fontSize:13,color:C.text,fontWeight:600,lineHeight:1.3}}>{item.title}</p>
                  <p style={{margin:0,fontSize:12,color:C.muted}}>{CAT_LABEL[item.category]||item.category}</p>
                  {item.rating>0&&<Stars value={item.rating} size={10}/>}
                </div>
                <div style={{padding:"5px 11px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:3}}>
                  <button onClick={()=>setModal(item)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:12,padding:"2px 4px"}}>✏️</button>
                  <button onClick={()=>deleteItem(item.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:12,padding:"2px 4px"}}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {modal!==null&&<WatchlogModal item={Object.keys(modal).length?modal:null} lang={lang} onSave={save} onClose={()=>setModal(null)}/>}
      {searchOpen&&<SearchModal lang={lang} user={user} onSelect={handleSearchSelect} onClose={()=>setSearchOpen(false)}/>}
    </div>
  );
}

// ─── Watchlog Page Inline (inside main layout with sidebar) ─────────────────
function WatchlogPageInline({user,lang,onBack}){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null);
  const [filterStatus,setFilterStatus]=useState("all");
  const [filterCat,setFilterCat]=useState("all");
  const [search,setSearch]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);

  useEffect(()=>{api.getWatchlog().then(d=>{setItems(d);setLoading(false);});},[]);

  const deleteItem=async(id)=>{await api.deleteWatchlog(id);setItems(p=>p.filter(i=>i.id!==id));};
  const handleSearchSelect=async(tmdbItem)=>{
    setModal({title:tmdbItem.title,category:tmdbItem.category||"film",poster_url:tmdbItem.poster_url||"",tags:[],status:"a_voir",rating:0,minutes:0,season:0,episode:0,notes:"",tmdb_id:tmdbItem.tmdb_id||null,runtime:tmdbItem.runtime||null});
  };
  const save=async(form)=>{
    if(form.id){await api.updateWatchlog(form.id,form);setItems(p=>p.map(i=>i.id===form.id?{...i,...form}:i));}
    else{const saved=await api.addToWatchlog(form);setItems(p=>[saved,...p]);}
    setModal(null);
  };

  const filtered=items.filter(i=>{
    if(filterStatus!=="all"&&i.status!==filterStatus) return false;
    if(filterCat!=="all"&&i.category!==filterCat) return false;
    if(search&&!i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts={
    a_voir: items.filter(i=>i.status==="a_voir").length,
    en_cours:items.filter(i=>i.status==="en_cours").length,
    termine: items.filter(i=>i.status==="termine").length,
  };
  const STATUS=getStatus(lang);

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>
      {/* Header */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"14px 22px",display:"flex",alignItems:"center",gap:12,flexShrink:0,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <h2 style={{margin:0,fontSize:19,fontFamily:"'Playfair Display',serif",fontWeight:700}}>📖 Mon journal</h2>
          <p style={{margin:"3px 0 0",fontSize:13,color:C.text,opacity:0.65}}>{items.length} titre{items.length>1?"s":""} · personnel</p>
        </div>
        {/* Stats */}
        <div style={{display:"flex",gap:8}}>
          {[{k:"a_voir",l:t(lang,"to_watch")},{k:"en_cours",l:t(lang,"watching")},{k:"termine",l:t(lang,"watched")}].map(s=>(
            <div key={s.k} style={{textAlign:"center",padding:"4px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
              <div style={{fontSize:20,fontWeight:800,color:STATUS[s.k].color,lineHeight:1.2}}>{counts[s.k]}</div>
              <div style={{fontSize:11,color:C.text,opacity:0.7,textTransform:"uppercase",letterSpacing:0.5,marginTop:3,fontWeight:500}}>{s.l}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>setSearchOpen(true)} style={{...BS,fontSize:12,padding:"7px 12px"}}>🔍 Chercher</button>
        <button onClick={()=>setModal({})} style={{...BP,fontSize:13}}>+ Ajouter</button>
      </div>

      {/* Filters */}
      <div style={{padding:"10px 22px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t(lang,"search")} style={{...IS,background:"rgba(255,255,255,0.03)",fontSize:13,marginBottom:8}}/>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
          <FBtn label={t(lang,"all")} active={filterStatus==="all"} onClick={()=>setFilterStatus("all")}/>
          <FBtn label={t(lang,"to_watch")} active={filterStatus==="a_voir"} color={C.muted} onClick={()=>setFilterStatus("a_voir")}/>
          <FBtn label={t(lang,"watching")} active={filterStatus==="en_cours"} color={C.warning} onClick={()=>setFilterStatus("en_cours")}/>
          <FBtn label={t(lang,"watched")} active={filterStatus==="termine"} color={C.success} onClick={()=>setFilterStatus("termine")}/>
          <span style={{color:C.border,margin:"0 3px"}}>|</span>
          {CATEGORIES.slice(0,5).map(c=><FBtn key={c.id} label={c.short} active={filterCat===c.id} onClick={()=>setFilterCat(filterCat===c.id?"all":c.id)}/>)}
        </div>
      </div>

      {/* Grid */}
      <div style={{flex:1,overflowY:"auto",padding:"18px 22px"}}>
        {loading&&<p style={{color:C.muted,textAlign:"center",paddingTop:40}}>…</p>}
        {!loading&&filtered.length===0&&(
          <div style={{textAlign:"center",color:C.muted,paddingTop:60}}>
            <div style={{fontSize:44,marginBottom:12}}>📖</div>
            <p style={{margin:0,fontSize:15}}>{items.length===0?"Ton journal est vide. Commence par ajouter un titre !":"Aucun résultat pour ces filtres."}</p>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
          {filtered.map(item=>{
            const st=getStatus(lang)[item.status]||getStatus(lang).a_voir;
            const maxMin=parseInt(item.runtime)||0;
            const curMin=parseInt(item.minutes)||0;
            const pct=maxMin>0?Math.round(curMin/maxMin*100):null;
            return(
              <div key={item.id} style={{background:C.card,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",transition:"border-color 0.15s,transform 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${C.gold}50`;e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
                <div style={{height:160,position:"relative",background:"rgba(255,255,255,0.03)",overflow:"hidden"}}>
                  {item.poster_url
                    ?<img src={item.poster_url} alt={item.title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                    :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,opacity:0.1}}>🎬</div>}
                  <div style={{position:"absolute",inset:0,background:`linear-gradient(to top,${C.bg}cc 0%,transparent 55%)`}}/>
                  <div style={{position:"absolute",top:8,right:8}}>
                    <span style={{fontSize:11,fontWeight:700,background:`${st.color}25`,color:st.color,padding:"3px 9px",borderRadius:99,border:`1px solid ${st.color}60`}}>{st.label}</span>
                  </div>
                </div>
                <div style={{padding:"9px 11px",flex:1,display:"flex",flexDirection:"column",gap:5}}>
                  <p style={{margin:0,fontSize:14,color:C.text,fontWeight:700,lineHeight:1.3}}>{item.title}</p>
                  <p style={{margin:0,fontSize:12,color:C.text,opacity:0.65}}>{CAT_SHORT[item.category]||item.category}</p>
                  {/* Progress bar */}
                  {item.status==="en_cours"&&(item.category==="film"||item.category==="short")&&curMin>0&&(
                    <div>
                      <div style={{height:3,background:C.border,borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",background:C.gold,borderRadius:99,width:`${Math.min(100,pct||0)}%`}}/>
                      </div>
                      <span style={{fontSize:11,color:C.gold,fontWeight:600}}>{curMin}min{maxMin>0?` / ${maxMin}min`:""} {pct!==null?`(${pct}%)`:""}</span>
                    </div>
                  )}
                  {item.status==="en_cours"&&item.category!=="film"&&(item.season||item.episode)&&(
                    <span style={{fontSize:12,color:C.warning,fontWeight:600}}>S{item.season||"?"}·E{item.episode||"?"}</span>
                  )}
                  {item.rating>0&&<Stars value={item.rating} size={11}/>}
                  {item.notes&&<p style={{margin:0,fontSize:11,color:C.text,opacity:0.5,fontStyle:"italic",lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>"{item.notes}"</p>}
                </div>
                <div style={{padding:"6px 11px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:4}}>
                  <button onClick={()=>setModal(item)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:14,padding:"2px 5px"}}>✏️</button>
                  <button onClick={()=>deleteItem(item.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:14,padding:"2px 5px"}}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal!==null&&<WatchlogModal item={Object.keys(modal).length?modal:null} lang={lang} onSave={save} onClose={()=>setModal(null)}/>}
      {searchOpen&&<SearchModal lang={lang} user={user} onSelect={r=>{handleSearchSelect(r);setSearchOpen(false);}} onClose={()=>setSearchOpen(false)}/>}
    </div>
  );
}

// ─── Watchlog Item Modal ──────────────────────────────────────────────────────
function WatchlogModal({item,lang,onSave,onClose}){
  const blank={title:"",category:"film",status:"a_voir",poster_url:"",tags:[],rating:0,minutes:0,season:0,episode:0,notes:"",runtime:null};
  const [form,setForm]=useState(item?{...item}:blank);
  const [saving,setSaving]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  // Auto-fetch runtime from TMDB
  useEffect(()=>{
    const tmdbId=form.tmdb_id||item?.tmdb_id;
    const cat=form.category||"film";
    const isFilmType=["film","short","documentary"].includes(cat);
    if(tmdbId&&isFilmType){
      import('./lib/tmdb.js').then(m=>m.getTMDBDetails(tmdbId,cat)).then(details=>{
        if(details?.runtime) setForm(f=>({...f,runtime:details.runtime}));
      }).catch(()=>{});
    }
  },[]);
  const st=getStatus(lang)[form.status]||getStatus(lang).a_voir;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16,overflowY:"auto"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:"100%",maxWidth:460,boxSizing:"border-box",maxHeight:"90vh",overflowY:"auto"}}>
        <h2 style={{margin:"0 0 16px",fontSize:16,fontFamily:"'Playfair Display',serif",color:C.text}}>{item?"Modifier":"Ajouter au journal"}</h2>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div><label style={LB}>{t(lang,"title_field")}</label><input value={form.title} onChange={e=>set("title",e.target.value)} style={IS} autoFocus placeholder={t(lang,"title_placeholder")}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={LB}>{t(lang,"category")}</label>
              <select value={form.category} onChange={e=>set("category",e.target.value)} style={IS}>
                {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div><label style={LB}>{t(lang,"my_status")}</label>
              <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...IS,color:st.color}}>
                <option value="a_voir">{t(lang,"to_watch")}</option>
                <option value="en_cours">{t(lang,"watching")}</option>
                <option value="termine">{t(lang,"watched")}</option>
              </select>
            </div>
          </div>
          {form.status==="en_cours"&&(form.category==="film"||form.category==="short"||form.category==="documentary"?(()=>{
            const maxMin = parseInt(form.runtime)||0;
            const curMin = parseInt(form.minutes)||0;
            const pct = maxMin>0 ? Math.round(curMin/maxMin*100) : null;
            const handleMin = val => {
              const v = Math.max(0, maxMin>0 ? Math.min(parseInt(val)||0, maxMin) : parseInt(val)||0);
              if(maxMin>0 && v>=maxMin){ set("status","termine"); set("minutes",0); }
              else set("minutes",v);
            };
            return(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <input type="range" min="0" max={maxMin>0?maxMin:300} step="1" value={curMin}
                  onChange={e=>handleMin(e.target.value)}
                  style={{width:"100%",accentColor:C.gold}}/>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:C.muted}}>0</span>
                  {pct!==null&&<span style={{fontSize:13,color:C.gold,fontWeight:700}}>{curMin} min ({pct}%)</span>}
                  <span style={{fontSize:12,color:C.muted}}>{maxMin>0?`${maxMin} min`:"?"}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min="0" max={maxMin>0?maxMin:undefined} value={form.minutes}
                    onChange={e=>handleMin(e.target.value)}
                    placeholder="0" style={{...IS,width:90,textAlign:"center"}}/>
                  <span style={{color:C.muted,fontSize:13}}>/ {maxMin>0?`${maxMin} min`:"? min"}</span>
                </div>
              </div>
            );
          })():(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={LB}>Saison</label><input type="number" min="1" value={form.season} onChange={e=>set("season",parseInt(e.target.value)||0)} placeholder="1" style={IS}/></div>
              <div><label style={LB}>Épisode</label><input type="number" min="1" value={form.episode} onChange={e=>set("episode",parseInt(e.target.value)||0)} placeholder="1" style={IS}/></div>
            </div>
          ))}
          {form.status==="termine"&&<div><label style={LB}>Note</label><Stars value={form.rating||0} onChange={v=>set("rating",v)} size={24}/></div>}
          <div><label style={LB}>Notes perso</label><textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS,resize:"vertical",fontFamily:"inherit"}} placeholder="Tes impressions…"/></div>
          <div><label style={LB}>Tags</label><TagInput tags={form.tags||[]} onChange={v=>set("tags",v)} lang={lang}/></div>
          <PosterPicker title={form.title} category={form.category} currentUrl={form.poster_url} onSelect={url=>set("poster_url",url)} lang={lang}/>
        </div>
        <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={BS}>{t(lang,"cancel")}</button>
          <button onClick={async()=>{if(!form.title.trim()) return;setSaving(true);await onSave(form);setSaving(false);}} disabled={saving} style={{...BP,opacity:saving?0.7:1}}>{saving?"…":t(lang,"save")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── User Directory (Steam-style) ─────────────────────────────────────────────
function UserDirectory({user,profiles,lang,onClose,onViewProfile,onOpenDM}){
  const [q,setQ]=useState("");
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [friends,setFriends]=useState([]);
  const [msg,setMsg]=useState("");
  const timer=useRef();

  useEffect(()=>{
    api.searchUsers("").then(setUsers).catch(()=>{}).finally(()=>setLoading(false));
    api.getFriends().then(setFriends).catch(()=>{});
  },[]);

  useEffect(()=>{
    clearTimeout(timer.current);
    timer.current=setTimeout(()=>{
      setLoading(true);
      api.searchUsers(q).then(setUsers).catch(()=>{}).finally(()=>setLoading(false));
    },300);
  },[q]);

  const isFriend=(id)=>friends.some(f=>(f.requester_id===id||f.addressee_id===id)&&f.status==="accepted");
  const isPending=(id)=>friends.some(f=>(f.requester_id===id||f.addressee_id===id)&&f.status==="pending");

  const addFriend=async(id)=>{
    try{await api.sendFriendReq(id);setMsg("Demande envoyée !");setTimeout(()=>setMsg(""),2000);api.getFriends().then(setFriends);}
    catch(e){setMsg("❌ "+e.message);setTimeout(()=>setMsg(""),2500);}
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:450,overflowY:"auto",padding:"24px 16px"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:560,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
          <h2 style={{margin:0,fontSize:17,fontFamily:"'Playfair Display',serif",color:C.text,flex:1}}>👥 Membres ({users.length})</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un membre…" style={{...IS}} autoFocus/>
          {msg&&<p style={{margin:"6px 0 0",fontSize:12,color:msg.startsWith("❌")?C.danger:C.success}}>{msg}</p>}
        </div>
        <div style={{maxHeight:"65vh",overflowY:"auto"}}>
          {loading&&<p style={{textAlign:"center",color:C.muted,padding:30}}>…</p>}
          {!loading&&users.length===0&&<p style={{textAlign:"center",color:C.muted,padding:30}}>Aucun membre trouvé.</p>}
          {users.map((u2,i)=>{
            const prof=profiles[u2.id]||u2;
            const badge=getBadge(prof.created_at||Date.now());
            const gr=GLOBAL_ROLES[u2.global_role];
            const banned=u2.is_banned;
            return(
              <div key={u2.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:`1px solid ${C.border}`,opacity:banned?0.5:1}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.03)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Avatar username={u2.username||"?"} avatarUrl={prof.avatar_url||u2.avatar_url} index={i} size={40} createdAt={prof.created_at} onClick={()=>onViewProfile(u2.id)}/>
                <div style={{flex:1,cursor:"pointer"}} onClick={()=>onViewProfile(u2.id)}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:14,color:C.text,fontWeight:600}}>{u2.username}</span>
                    {gr&&u2.global_role!=="user"&&<GlobalRoleBadge role={u2.global_role} size="small"/>}
                    {banned&&<span style={{fontSize:11,color:C.danger,background:"rgba(248,113,113,0.15)",padding:"1px 6px",borderRadius:99,border:"1px solid rgba(248,113,113,0.3)"}}>🚫 Banni</span>}
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:2,alignItems:"center"}}>
                    <span style={{fontSize:11,color:badge.color}}>{badge.icon} {badge.label}</span>
                    {prof.location&&<span style={{fontSize:12,color:C.muted}}>📍 {prof.location}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {isFriend(u2.id)?<button onClick={()=>onOpenDM&&onOpenDM(u2)} style={{...BS,fontSize:11,padding:"5px 10px"}}>💬</button>
                    :isPending(u2.id)?<span style={{fontSize:11,color:C.muted,padding:"5px 0"}}>En attente</span>
                    :<button onClick={()=>addFriend(u2.id)} style={{...BS,fontSize:11,padding:"5px 10px"}}>+ Ami</button>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({user,lang,onClose,onViewProfile,myRole}){
  const [stats,setStats]=useState(null);
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("stats");

  useEffect(()=>{
    api.getAdminStats().then(setStats).catch(()=>{});
    api.getAdminUsers().then(d=>setUsers(d.users||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:500,overflowY:"auto",padding:"24px 16px"}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:680,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center"}}>
          <h2 style={{margin:0,fontSize:17,color:C.text,flex:1}}>⚡ Panneau d'administration</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
          {[{k:"stats",l:"📊 Stats"},{k:"users",l:"👥 Utilisateurs"}].map(tb=>(
            <button key={tb.k} onClick={()=>setTab(tb.k)} style={{flex:1,background:tab===tb.k?`${C.gold}10`:"transparent",border:"none",borderBottom:tab===tb.k?`2px solid ${C.gold}`:"2px solid transparent",padding:"11px",fontSize:13,color:tab===tb.k?C.gold:C.muted,cursor:"pointer",fontFamily:"inherit"}}>{tb.l}</button>
          ))}
        </div>

        <div style={{padding:"20px",maxHeight:"72vh",overflowY:"auto"}}>
          {tab==="stats"&&(
            <div>
              {!stats&&<p style={{color:C.muted,textAlign:"center"}}>Chargement…</p>}
              {stats&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:12}}>
                  {[
                    {label:"👤 Membres",value:stats.userCount,color:C.gold},
                    {label:"📋 Listes",value:stats.listCount,color:C.blue},
                    {label:"🎬 Titres",value:stats.itemCount,color:C.purple},
                    {label:"💬 Messages",value:stats.msgCount,color:C.success},
                    {label:"📖 Journal",value:stats.watchlogCount,color:C.warning},
                  ].map(s=>(
                    <div key={s.label} style={{background:C.card,borderRadius:12,padding:"16px 14px",textAlign:"center",border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:26,fontWeight:700,color:s.color}}>{s.value??0}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:4}}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab==="users"&&(
            <div>
              {loading&&<p style={{color:C.muted,textAlign:"center"}}>Chargement…</p>}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {users.map((u2,i)=>{
                  const gr=GLOBAL_ROLES[u2.global_role];
                  return(
                    <div key={u2.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:C.card,borderRadius:10,border:`1px solid ${C.border}`,cursor:"pointer"}}
                      onClick={()=>onViewProfile(u2.id)}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=`${C.gold}40`}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                      <Avatar username={u2.username||"?"} avatarUrl={u2.avatar_url} index={i} size={34}/>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{fontSize:13,color:C.text,fontWeight:600}}>{u2.username}</span>
                          {gr&&u2.global_role!=="user"&&<GlobalRoleBadge role={u2.global_role} size="small"/>}
                          {u2.is_banned&&<span style={{fontSize:11,color:C.danger,background:"rgba(248,113,113,0.15)",padding:"1px 5px",borderRadius:99}}>🚫 Banni</span>}
                        </div>
                        <span style={{fontSize:12,color:C.muted}}>{u2.email} · Inscrit le {new Date(u2.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{fontSize:12,color:C.muted}}>›</span>
                        {myRole==="superadmin"&&u2.id!==user.id&&(
                          <button onClick={async e=>{
                            e.stopPropagation();
                            if(!window.confirm(`Supprimer le compte de "${u2.username}" ?`)) return;
                            if(!window.confirm(`CONFIRMATION FINALE — Cette action est irréversible et supprimera toutes les données de "${u2.username}".`)) return;
                            try{
                              await api.modAction({targetId:u2.id,action:"delete_account",reason:"Suppression par superadmin"});
                              setUsers(prev=>prev.filter(x=>x.id!==u2.id));
                              if(stats) setStats(s=>({...s,userCount:(s.userCount||1)-1}));
                            }catch(err2){alert("Erreur: "+err2.message);}
                          }} style={{background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:6,padding:"4px 8px",fontSize:11,color:"#F87171",cursor:"pointer",fontFamily:"inherit",fontWeight:600}} title="Supprimer ce compte">
                            🗑 Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({onLogin,lang,setLang,theme,setTheme}){
  const [mode,setMode]=useState("login");
  const [username,setUsername]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [loading,setLoading]=useState(false);
  const reset=()=>{setError("");setSuccess("");};

  const submit=async()=>{
    if(mode==="forgot"){
      if(!email.trim()){setError(t(lang,"email_required"));return;}
      setError("");setLoading(true);
      try{await api.forgotPassword(email.trim());setSuccess(t(lang,"reset_sent"));}
      catch(e){setError(e.message);}
      setLoading(false);return;
    }
    if(!username.trim()||!password){setError(t(lang,"fill_fields"));return;}
    if(mode==="register"&&!email.trim()){setError(t(lang,"email_required"));return;}
    setError("");setLoading(true);
    try{
      const user=mode==="register"?await api.register(username.trim(),email.trim(),password):await api.login(username.trim(),password);
      onLogin(user);
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16,transition:"background 0.3s"}}>
      <div style={{position:"fixed",top:16,right:16,display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
        <LangToggle lang={lang} setLang={setLang}/>
        <div style={{display:"flex",gap:5}}>{Object.entries(THEMES).map(([k,th])=><button key={k} onClick={()=>{setTheme(k);localStorage.setItem("wl_theme",k);Object.assign(C,getThemeColors(k));}} title={th.name} style={{width:18,height:18,borderRadius:"50%",background:th.gold,border:`2px solid ${theme===k?"white":"transparent"}`,cursor:"pointer",padding:0}}/>)}</div>
      </div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"36px 32px",width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:38,marginBottom:8}}>🎞</div>
          <h1 style={{margin:"0 0 4px",fontFamily:"'Playfair Display',serif",fontSize:24,color:C.gold,fontWeight:700}}>🎞 Watchlist</h1>
          <p style={{margin:0,color:C.muted,fontSize:13}}>{mode==="login"?t(lang,"tagline_login"):mode==="register"?t(lang,"tagline_register"):t(lang,"forgot_desc")}</p>
        </div>
        {mode==="forgot"?(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><label style={LB}>{t(lang,"email")}</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={IS} placeholder={t(lang,"email_placeholder")} autoFocus/></div>
            {error&&<p style={{color:C.danger,fontSize:12,margin:0,background:"rgba(248,113,113,0.08)",padding:"7px 10px",borderRadius:8}}>⚠ {error}</p>}
            {success&&<p style={{color:C.success,fontSize:12,margin:0,background:"rgba(16,185,129,0.08)",padding:"7px 10px",borderRadius:8}}>✓ {success}</p>}
            {!success&&<button onClick={submit} disabled={loading} style={{...BP,width:"100%",opacity:loading?0.7:1}}>{loading?"…":t(lang,"send_reset")}</button>}
            <p style={{textAlign:"center",fontSize:12,marginTop:4,marginBottom:0}}>
              <span onClick={()=>{setMode("login");reset();}} style={{color:C.gold,cursor:"pointer",fontWeight:600}}>← {t(lang,"back_to_login")}</span>
            </p>
          </div>
        ):(
          <>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div><label style={LB}>{t(lang,"username")}</label><input value={username} onChange={e=>setUsername(e.target.value)} style={IS} placeholder="ex: alice" autoFocus/></div>
              {mode==="register"&&<div><label style={LB}>{t(lang,"email")}</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={IS} placeholder={t(lang,"email_placeholder")}/></div>}
              <div><label style={LB}>{t(lang,"password")}</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={IS} placeholder="••••••••"/></div>
              {error&&<p style={{color:C.danger,fontSize:12,margin:0,background:"rgba(248,113,113,0.08)",padding:"7px 10px",borderRadius:8}}>⚠ {error}</p>}
              <button onClick={submit} disabled={loading} style={{...BP,width:"100%",marginTop:4,opacity:loading?0.7:1}}>{loading?"…":mode==="login"?t(lang,"login"):t(lang,"register")}</button>
            </div>
            {mode==="login"&&<p style={{textAlign:"center",fontSize:12,marginTop:10,marginBottom:0}}>
              <span onClick={()=>{setMode("forgot");reset();}} style={{color:C.muted,cursor:"pointer",textDecoration:"underline"}}>{t(lang,"forgot_password")}</span>
            </p>}
            <p style={{textAlign:"center",fontSize:12,color:C.muted,marginTop:14,marginBottom:0}}>
              {mode==="login"?t(lang,"no_account")+" ":t(lang,"has_account")+" "}
              <span onClick={()=>{setMode(mode==="login"?"register":"login");reset();}} style={{color:C.gold,cursor:"pointer",fontWeight:600}}>
                {mode==="login"?t(lang,"register"):t(lang,"login")}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({list,lang,onClose}){
  const [copied,setCopied]=useState(false);
  const copy=()=>navigator.clipboard.writeText(list.invite_code).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:28,width:"100%",maxWidth:340}}>
        <h2 style={{margin:"0 0 6px",fontSize:17,fontFamily:"'Playfair Display',serif",color:C.text}}>« {list.name} »</h2>
        <p style={{margin:"0 0 20px",color:C.muted,fontSize:13}}>{t(lang,"share_desc")}</p>
        <div style={{background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.22)",borderRadius:12,padding:"16px 24px",textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:2,marginBottom:6}}>{t(lang,"invite_code")}</div>
          <div style={{fontSize:32,fontWeight:700,letterSpacing:10,color:C.gold,fontFamily:"monospace"}}>{list.invite_code}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={copy} style={{...BP,flex:1}}>{copied?t(lang,"copied"):t(lang,"copy_code")}</button>
          <button onClick={onClose} style={BS}>{t(lang,"close")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState(()=>api.getUser());
  const [lang,setLang]=useState(()=>localStorage.getItem("wl_lang")||"fr");
  const [theme,setTheme]=useState(()=>localStorage.getItem("wl_theme")||"dark");
  const [page,setPage]=useState("home"); // "home" | "list" | "watchlog"
  const [lists,setLists]=useState([]);
  const [currentId,setCurrentId]=useState(null);
  const [items,setItems]=useState([]);
  const [profiles,setProfiles]=useState({});
  const [unreadCount,setUnreadCount]=useState(0);
  // Modals
  const [itemModal,setItemModal]=useState(null);
  const [shareModal,setShareModal]=useState(false);
  const [chatOpen,setChatOpen]=useState(false);
  const [listSettings,setListSettings]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [friendsOpen,setFriendsOpen]=useState(false);
  const [notifsOpen,setNotifsOpen]=useState(false);
  const [dmFriend,setDmFriend]=useState(null);
  const [viewProfileId,setViewProfileId]=useState(null);
  const [searchOpen,setSearchOpen]=useState(false);
  const [directoryOpen,setDirectoryOpen]=useState(false);
  const [adminOpen,setAdminOpen]=useState(false);
  // Sidebar
  const [newName,setNewName]=useState("");
  const [joinCode,setJoinCode]=useState("");
  const [sideMsg,setSideMsg]=useState("");
  // Filters
  const [filterCat,setFilterCat]=useState("all");
  const [filterStatus,setFilterStatus]=useState("all");
  const [filterTag,setFilterTag]=useState("");
  const [search,setSearch]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(true);
  const [sortBy,setSortBy]=useState("date"); // "date" | "title" | "episodes" | member ID
  const [filterMembers,setFilterMembers]=useState([]); // multi-select member IDs

  const changeLang=l=>{setLang(l);localStorage.setItem("wl_lang",l);};
  const changeTheme=t=>{setTheme(t);localStorage.setItem("wl_theme",t);};
  const [isMobileState,setIsMobileState]=useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const h=()=>setIsMobileState(window.innerWidth<768);
    window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);
  },[]);
  const isMob=isMobileState;
  // Apply theme to C dynamically
  const TC=getThemeColors(theme);
  // Override C values with current theme (mutate for all components in render scope)
  Object.assign(C,TC);

  // Logout listener
  useEffect(()=>{
    const h=()=>{setUser(null);setLists([]);setCurrentId(null);setPage("home");};
    window.addEventListener("wl:logout",h);
    return()=>window.removeEventListener("wl:logout",h);
  },[]);

  // Load user profile (confirm_delete setting)
  useEffect(()=>{
    if(!user) return;
    api.getProfile(user.id).then(p=>{
      setConfirmDelete(p.confirm_delete!==false);
      setProfiles(prev=>({...prev,[user.id]:p}));
    }).catch(()=>{});
  },[user]);

  // Unread notifications
  useEffect(()=>{
    if(!user) return;
    const fetchCount=()=>api.getUnreadCount().then(d=>setUnreadCount(d.count||0)).catch(()=>{});
    fetchCount();
    const unsub=subscribeToNotifications(user.id,()=>setUnreadCount(c=>c+1));
    return unsub;
  },[user]);

  // Load lists
  const loadLists=useCallback(async()=>{
    if(!api.getUser()) return;
    try{const d=await api.getLists();setLists(d);return d;}catch{return[];}
  },[]);

  useEffect(()=>{if(user) loadLists();},[user,loadLists]);

  // Load items + realtime for current list
  useEffect(()=>{
    if(!currentId) return;
    api.getItems(currentId).then(setItems).catch(()=>{});
    const unsub=subscribeToItems(currentId,()=>api.getItems(currentId).then(setItems).catch(()=>{}));
    return unsub;
  },[currentId]);

  // Realtime list membership changes
  useEffect(()=>{
    if(!user) return;
    const unsub=subscribeToLists(()=>loadLists());
    return unsub;
  },[user,loadLists]);

  // Load profiles for current list members
  useEffect(()=>{
    const list=lists.find(l=>l.id===currentId);
    if(!list) return;
    (list.members||[]).forEach(m=>{
      if(!profiles[m.id]) api.getProfile(m.id).then(p=>setProfiles(prev=>({...prev,[m.id]:p}))).catch(()=>{});
    });
  },[currentId,lists]);

  // Actions
  const createListAction=async()=>{
    const name=newName.trim();if(!name) return;
    try{const list=await api.createList(name);setNewName("");await loadLists();setCurrentId(list.id);setPage("list");}
    catch(e){setSideMsg("❌ "+e.message);setTimeout(()=>setSideMsg(""),2500);}
  };

  const joinListAction=async()=>{
    const code=joinCode.trim();if(!code) return;
    try{const list=await api.joinList(code);setJoinCode("");setSideMsg(t(lang,"joined"));setTimeout(()=>setSideMsg(""),2000);await loadLists();setCurrentId(list.id);setPage("list");}
    catch{setSideMsg(t(lang,"invalid_code"));setTimeout(()=>setSideMsg(""),2500);}
  };

  const handleSaved=async()=>{
    const fresh=await api.getItems(currentId);setItems(fresh);setItemModal(null);
  };

  const removeItem=async id=>{
    try{await api.deleteItem(currentId,id);setItems(p=>p.filter(i=>i.id!==id));}
    catch(e){alert(e.message);}
  };

  const logout=()=>{api.logout();setUser(null);setLists([]);setCurrentId(null);};

  const handleSearchSelect=result=>{
    if(currentId){
      setItemModal({title:result.title,category:result.category||"film",poster_url:result.poster_url||"",tags:[],user_progress:{},tmdb_id:result.tmdb_id||null});
    }
  };

  if(!user) return <AuthScreen onLogin={u=>{api.saveUser(u);setUser(u);}} lang={lang} setLang={changeLang} theme={theme} setTheme={changeTheme}/>;

  const currentList=lists.find(l=>l.id===currentId);
  const members=currentList?.members||[];
  const me=members.find(m=>m.id===user.id);
  const isOwnerOrMod=["owner","admin","moderator"].includes(me?.role);
  const allTags=[...new Set(items.flatMap(i=>i.tags||[]))];
  const myProfile=profiles[user.id]||{};

  const filtered=items.filter(i=>{
    const p=i.user_progress[user.id]||{};
    if(filterCat!=="all"&&i.category!==filterCat) return false;
    if(filterStatus!=="all"&&(p.status||"a_voir")!==filterStatus) return false;
    if(filterTag&&!(i.tags||[]).includes(filterTag)) return false;
    if(search&&!i.title.toLowerCase().includes(search.toLowerCase())) return false;
    // Multi-member filter: item must have at least one of selected members with any progress
    if(filterMembers.length>0&&!filterMembers.some(mid=>i.user_progress[mid])) return false;
    return true;
  }).sort((a,b)=>{
    if(sortBy==="title") return a.title.localeCompare(b.title,"fr");
    if(sortBy==="episodes"){
      const pa=a.user_progress[user.id]||{};const pb=b.user_progress[user.id]||{};
      const sa=(parseInt(pa.season||0)*1000)+(parseInt(pa.episode||0)||0)+(parseInt(pa.minutes||0)||0);
      const sb=(parseInt(pb.season||0)*1000)+(parseInt(pb.episode||0)||0)+(parseInt(pb.minutes||0)||0);
      return sb-sa;
    }
    if(sortBy==="rating"){
      const ra=a.user_progress[user.id]?.rating||0;const rb=b.user_progress[user.id]?.rating||0;
      return rb-ra;
    }
    // Sort by member progress if a member id is selected
    const member=members.find(m=>m.id===sortBy);
    if(member){
      const pa=a.user_progress[member.id]||{};const pb=b.user_progress[member.id]||{};
      const order={"termine":3,"en_cours":2,"a_voir":1};
      return (order[pb.status||"a_voir"]||0)-(order[pa.status||"a_voir"]||0);
    }
    // Default: date added
    return new Date(b.created_at)-new Date(a.created_at);
  });

  const counts={
    a_voir: items.filter(i=>(i.user_progress[user.id]?.status||"a_voir")==="a_voir").length,
    en_cours:items.filter(i=>i.user_progress[user.id]?.status==="en_cours").length,
    termine: items.filter(i=>i.user_progress[user.id]?.status==="termine").length,
  };
  const STATUS=getStatus(lang);

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",fontFamily:"'Outfit',sans-serif",color:C.text,transition:"background 0.3s,color 0.3s"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet"/>
      <style>{`body{background:${C.bg};transition:background 0.3s;}::-webkit-scrollbar-thumb{background:${C.gold}33;} ::selection{background:${C.gold}44;}`}</style>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <div style={{width:isMob?0:214,flexShrink:0,background:C.surface,borderRight:`1px solid ${C.border}`,display:isMob?"none":"flex",flexDirection:"column",padding:"16px 12px",gap:14,minHeight:"100vh",boxSizing:"border-box",overflowY:"auto"}}>

        {/* Logo */}
        <div>
          <div style={{marginBottom:10,cursor:"pointer"}} onClick={()=>setPage("home")}>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:C.gold,fontWeight:700}}>🎞 Watchlist</span>
          </div>
          {/* User row */}
          <div style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:6}}>
            <Avatar username={user.username} avatarUrl={myProfile.avatar_url} index={0} size={24} createdAt={myProfile.created_at} onClick={()=>setSettingsOpen(true)}/>
            <span onClick={()=>setSettingsOpen(true)} style={{fontSize:13,fontWeight:500,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",cursor:"pointer"}}>{user.username}</span>
            {/* Notifications bell */}
            <div style={{position:"relative"}}>
              <button onClick={()=>{setNotifsOpen(true);setUnreadCount(0);}} title="Notifications" style={{background:"none",border:"none",cursor:"pointer",fontSize:15,padding:"2px",color:unreadCount>0?C.gold:C.muted}}>🔔</button>
              <NotifBadge count={unreadCount}/>
            </div>
            <button onClick={()=>setFriendsOpen(true)} title="Amis" style={{background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"2px"}}>👥</button>
            <button onClick={logout} title="Déconnexion" style={{background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"2px",color:C.muted}}>⏻</button>
          </div>
          <LangToggle lang={lang} setLang={changeLang}/>
        </div>

        {/* Nav */}
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          <button onClick={()=>setPage("home")} style={{background:page==="home"?`${C.gold}14`:"transparent",border:"none",borderRadius:8,padding:"7px 9px",fontSize:13,color:page==="home"?C.gold:C.text,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>🏠 Accueil</button>
          <button onClick={()=>setPage("watchlog")} style={{background:page==="watchlog"?`${C.gold}14`:"transparent",border:"none",borderRadius:8,padding:"7px 9px",fontSize:13,color:page==="watchlog"?C.gold:C.text,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>📖 Mon journal</button>
          <button onClick={()=>setSearchOpen(true)} style={{background:"transparent",border:"none",borderRadius:8,padding:"7px 9px",fontSize:13,color:C.text,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>🔍 Rechercher</button>
          <button onClick={()=>setDirectoryOpen(true)} style={{background:"transparent",border:"none",borderRadius:8,padding:"7px 9px",fontSize:13,color:C.text,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>🌐 Membres</button>
          {["superadmin","admin"].includes(myProfile.global_role)&&(
            <button onClick={()=>setAdminOpen(true)} style={{background:"transparent",border:"none",borderRadius:8,padding:"7px 9px",fontSize:13,color:C.danger,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>⚡ Admin</button>
          )}
        </div>

        {/* Lists */}
        <div style={{flex:1}}>
          <p style={{margin:"0 0 6px 2px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1.2}}>{t(lang,"my_lists")}</p>
          {lists.length===0&&<p style={{fontSize:13,color:"rgba(255,255,255,0.3)",margin:"4px 0 0 2px"}}>—</p>}
          {lists.map(l=>(
            <div key={l.id} onClick={()=>{setCurrentId(l.id);setPage("list");setChatOpen(false);}} style={{padding:"7px 9px",borderRadius:8,cursor:"pointer",fontSize:14,color:currentId===l.id&&page==="list"?C.gold:C.text,background:currentId===l.id&&page==="list"?"rgba(201,168,76,0.08)":"transparent",marginBottom:2,display:"flex",alignItems:"center",gap:7}}>
              <span>{l.members?.length>1?"👥":"📋"}</span>
              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.name}</span>
              <span style={{fontSize:12,color:C.muted,background:"rgba(255,255,255,0.05)",borderRadius:99,padding:"0 5px"}}>{l.members?.length||1}</span>
            </div>
          ))}
        </div>

        {/* Create */}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
          <p style={{margin:"0 0 6px 2px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1.2}}>{t(lang,"create_list")}</p>
          <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createListAction()} placeholder={t(lang,"list_name")} style={{...IS,fontSize:12,marginBottom:6}}/>
          <button onClick={createListAction} style={{...BP,width:"100%",fontSize:12,padding:"7px"}}>{t(lang,"create")}</button>
        </div>

        {/* Join */}
        <div>
          <p style={{margin:"0 0 6px 2px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:1.2}}>{t(lang,"join")}</p>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&joinListAction()} placeholder={t(lang,"join_code")} style={{...IS,fontSize:14,marginBottom:6,fontFamily:"monospace",letterSpacing:5,textTransform:"uppercase",textAlign:"center"}} maxLength={6}/>
          <button onClick={joinListAction} style={{...BS,width:"100%",fontSize:12,padding:"7px"}}>{t(lang,"join")}</button>
          {sideMsg&&<p style={{fontSize:11,color:sideMsg.startsWith("✓")?C.success:C.danger,textAlign:"center",margin:"5px 0 0"}}>{sideMsg}</p>}
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,maxHeight:"100vh",overflowY:page==="watchlog"?"hidden":"auto"}}>

        {/* ── HOME PAGE ── */}
        {page==="home"&&(
          <HomePage
            user={user} profiles={profiles} lang={lang} isMob={isMob}
            onOpenList={id=>{setCurrentId(id);setPage("list");}}
            onViewProfile={setViewProfileId}
            onSearch={()=>setSearchOpen(true)}
            onOpenSettings={()=>setSettingsOpen(true)}
            onOpenFriends={()=>setFriendsOpen(true)}
            onOpenWatchlog={()=>setPage("watchlog")}
            unreadCount={unreadCount}
          />
        )}

        {/* ── LIST PAGE ── */}
        {page==="watchlog"&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,maxHeight:"100vh",overflowY:"auto"}}>
            <WatchlogPageInline user={user} lang={lang} onBack={()=>setPage("home")}/>
          </div>
        )}

        {page==="list"&&(<>
          {!currentList?(
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.muted,gap:14,padding:40}}>
              <div style={{fontSize:52}}>🎬</div>
              <p style={{margin:0,fontSize:15,textAlign:"center",maxWidth:320}}>{t(lang,"select_list")}</p>
            </div>
          ):(<>
            {/* Header */}
            <div style={{borderBottom:`1px solid ${C.border}`,padding:isMob?"10px 14px":"14px 22px",display:"flex",alignItems:"center",gap:isMob?8:12,flexWrap:"wrap",flexShrink:0}}>
              <div style={{flex:1}}>
                <h2 style={{margin:0,fontSize:19,fontFamily:"'Playfair Display',serif",fontWeight:700}}>{currentList.name}</h2>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                  {members.map((m,i)=>(
                    <Avatar key={m.id} username={m.username} avatarUrl={profiles[m.id]?.avatar_url} index={i} size={18} onClick={()=>setViewProfileId(m.id)}/>
                  ))}
                  <span style={{fontSize:13,color:C.text,opacity:0.75,fontWeight:500}}>{members.length} {members.length>1?t(lang,"members"):t(lang,"member")} · {items.length} {items.length>1?t(lang,"titles"):t(lang,"title")}</span>
                </div>
              </div>
              {/* Stats */}
              <div style={{display:"flex",gap:8}}>
                {[{k:"a_voir",l:t(lang,"to_watch")},{k:"en_cours",l:t(lang,"watching")},{k:"termine",l:t(lang,"watched")}].map(s=>(
                  <div key={s.k} style={{textAlign:"center",padding:"4px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
                    <div style={{fontSize:20,fontWeight:800,color:STATUS[s.k].color,lineHeight:1.2}}>{counts[s.k]}</div>
                    <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:0.5,marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setListSettings(true)} style={{...BS,fontSize:12,padding:"7px 12px"}}>⚙️</button>
              <button onClick={()=>setChatOpen(true)} style={{...BS,fontSize:12,padding:"7px 12px"}}>{t(lang,"chat")}</button>
              <button onClick={()=>setShareModal(true)} style={{...BS,fontSize:12,padding:"7px 12px"}}>{t(lang,"share")}</button>
              <button onClick={()=>setSearchOpen(true)} style={{...BS,fontSize:12,padding:"7px 12px"}}>🔍</button>
              <button onClick={()=>setItemModal({})} style={{...BP,fontSize:13}}>{t(lang,"add")}</button>
            </div>

            {/* Filters */}
            <div style={{padding:"10px 22px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t(lang,"search")} style={{...IS,background:"rgba(255,255,255,0.03)",fontSize:12,marginBottom:8}}/>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                <FBtn label={t(lang,"all")} active={filterCat==="all"} onClick={()=>setFilterCat("all")}/>
                {CATEGORIES.map(c=><FBtn key={c.id} label={c.short} active={filterCat===c.id} onClick={()=>setFilterCat(filterCat===c.id?"all":c.id)}/>)}
                <span style={{color:C.border,margin:"0 3px"}}>|</span>
                <FBtn label={t(lang,"all")} active={filterStatus==="all"} onClick={()=>setFilterStatus("all")}/>
                <FBtn label={t(lang,"to_watch")} active={filterStatus==="a_voir"} color={C.muted} onClick={()=>setFilterStatus("a_voir")}/>
                <FBtn label={t(lang,"watching")} active={filterStatus==="en_cours"} color={C.warning} onClick={()=>setFilterStatus("en_cours")}/>
                <FBtn label={t(lang,"watched")} active={filterStatus==="termine"} color={C.success} onClick={()=>setFilterStatus("termine")}/>
                {allTags.length>0&&<>{<span style={{color:C.border,margin:"0 3px"}}>|</span>}{allTags.slice(0,5).map(tg=><FBtn key={tg} label={`#${tg}`} active={filterTag===tg} color="rgba(201,168,76,0.75)" onClick={()=>setFilterTag(filterTag===tg?"":tg)}/>)}</>}
              </div>
            </div>

            {/* Grid */}
            <div style={{flex:1,padding:"18px 22px"}}>
              {filtered.length===0?(
                <div style={{textAlign:"center",color:C.muted,paddingTop:60}}>
                  <div style={{fontSize:44,marginBottom:12}}>🎬</div>
                  <p style={{margin:0}}>{items.length===0?t(lang,"add_first"):t(lang,"no_results")}</p>
                </div>
              ):(
                <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${isMob?"140px":"175px"},1fr))`,gap:isMob?10:14,paddingBottom:isMob?80:0}}>
                  {filtered.map(item=>(
                    <ItemCard key={item.id} item={item} user={user} members={members} profiles={profiles}
                      onEdit={setItemModal} onDelete={removeItem} lang={lang}
                      confirmDelete={confirmDelete} isOwnerOrMod={isOwnerOrMod}/>
                  ))}
                </div>
              )}
            </div>
          </>)}
        </>)}
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────── */}
      {isMob&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:200,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {[
            {icon:"🏠",label:"Accueil",action:()=>setPage("home"),active:page==="home"},
            {icon:"🔍",label:"Chercher",action:()=>setSearchOpen(true),active:false},
            {icon:"📖",label:"Journal",action:()=>setPage("watchlog"),active:page==="watchlog"},
            {icon:"👥",label:"Amis",action:()=>setFriendsOpen(true),active:false,badge:unreadCount},
            {icon:"⚙️",label:"Profil",action:()=>setSettingsOpen(true),active:false},
          ].map(item=>(
            <button key={item.label} onClick={item.action} style={{flex:1,background:"transparent",border:"none",cursor:"pointer",padding:"10px 4px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative",fontFamily:"inherit"}}>
              <span style={{fontSize:20}}>{item.icon}</span>
              <span style={{fontSize:11,color:item.active?C.gold:C.muted}}>{item.label}</span>
              {item.badge>0&&<NotifBadge count={item.badge}/>}
            </button>
          ))}
        </div>
      )}

      {/* ── Modals & Panels ─────────────────────────────── */}
      {itemModal!==null&&(
        <ItemModal
          item={itemModal&&Object.keys(itemModal).length&&itemModal.id?itemModal:null}
          prefill={itemModal&&Object.keys(itemModal).length&&!itemModal.id?itemModal:null}
          user={user} listId={currentId}
          onSaved={handleSaved} onClose={()=>setItemModal(null)}
          lang={lang} isOwnerOrMod={isOwnerOrMod}
        />
      )}
      {shareModal&&currentList&&<ShareModal list={currentList} lang={lang} onClose={()=>setShareModal(false)}/>}
      {chatOpen&&currentList&&<ChatPanel listId={currentId} listName={currentList.name} user={user} members={members} profiles={profiles} lang={lang} onClose={()=>setChatOpen(false)}/>}
      {listSettings&&currentList&&<ListSettingsModal list={currentList} user={user} lang={lang} profiles={profiles} onClose={()=>setListSettings(false)} onUpdated={()=>{loadLists();setListSettings(false);}} onDeleted={()=>{setCurrentId(null);setPage("home");setListSettings(false);loadLists();}}/>}
      {settingsOpen&&(
        <SettingsPanel user={user} lang={lang} setLang={changeLang} theme={theme} setTheme={changeTheme} onClose={()=>setSettingsOpen(false)}
          onUpdated={()=>api.getProfile(user.id).then(p=>{setProfiles(prev=>({...prev,[user.id]:p}));setConfirmDelete(p.confirm_delete!==false);})}/>
      )}
      {friendsOpen&&(
        <FriendsPanel user={user} profiles={profiles} lang={lang}
          onClose={()=>setFriendsOpen(false)}
          onOpenDM={f=>{setDmFriend(f);setFriendsOpen(false);}}
          onViewProfile={id=>{setViewProfileId(id);setFriendsOpen(false);}}/>
      )}
      {dmFriend&&<DMPanel friend={dmFriend} user={user} profiles={profiles} lang={lang} onClose={()=>setDmFriend(null)}/>}
      {viewProfileId&&<PublicProfileModal userId={viewProfileId} currentUser={user} lang={lang} onClose={()=>setViewProfileId(null)}/>}
      {notifsOpen&&<NotificationsPanel user={user} lang={lang} onClose={()=>setNotifsOpen(false)}/>}
      {searchOpen&&<SearchModal lang={lang} user={user} onSelect={r=>{handleSearchSelect(r);setSearchOpen(false);}} onClose={()=>setSearchOpen(false)}/>}
      {directoryOpen&&<UserDirectory user={user} profiles={profiles} lang={lang} onClose={()=>setDirectoryOpen(false)} onViewProfile={id=>{setViewProfileId(id);setDirectoryOpen(false);}} onOpenDM={f=>{setDmFriend(f);setDirectoryOpen(false);}}/>}
      {adminOpen&&<AdminPanel user={user} lang={lang} myRole={myProfile.global_role} onClose={()=>setAdminOpen(false)} onViewProfile={id=>{setViewProfileId(id);setAdminOpen(false);}}/>}
    </div>
  );
}
