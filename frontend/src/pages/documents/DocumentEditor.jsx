/**
 * DocumentEditor — self-contained, creates its own socket.
 * Includes a full Share panel: search users, invite with read/write access,
 * manage collaborators, remove them. Read-only users see the doc but cannot type.
 *
 * Route: <Route path="/documents/:id" element={<DocumentEditor />} />
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL } from "@/config";
import { useAuthContext } from "@/context/AuthContextProvider";
import { createSocketConnection } from "../../hooks/useSocket";
import { useDocumentCollaboration } from "../../hooks/useDocumentCollboration";

// ---------------------------------------------------------------------------
// Helpers & tiny utils
// ---------------------------------------------------------------------------
function countWords(html) {
  const t = html.replace(/<[^>]+>/g, " ").trim();
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}
function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}
const PALETTE = ["#4f8ef7","#7c3aed","#34d399","#fb923c","#f472b6","#38bdf8"];
function seedColor(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name = "") {
  return name.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function fullName(u) {
  if (!u) return "Unknown";
  return `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || "Unknown";
}

// ---------------------------------------------------------------------------
// UserAvatar
// ---------------------------------------------------------------------------
function UserAvatar({ user, size = 32 }) {
  const name = fullName(user);
  if (user?.profile_picture) {
    return <img src={user.profile_picture} alt={name}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: seedColor(name),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: "#fff", flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SharePanel
// ---------------------------------------------------------------------------
function SharePanel({ docId, isOwner, isPublic, onPublicToggle, onClose, currentUserId }) {
  const [collaborators, setCollaborators] = useState([]);
  const [loadingList, setLoadingList]     = useState(true);
  const [query, setQuery]                 = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const [selectedUser, setSelectedUser]   = useState(null);
  const [pendingAccess, setPendingAccess] = useState("read");
  const [adding, setAdding]               = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/documents/${docId}/collaborators`, { headers: authHeader() })
      .then(r => setCollaborators(r.data))
      .catch(console.error)
      .finally(() => setLoadingList(false));
  }, [docId]);

  useEffect(() => {
    if (query.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
    clearTimeout(searchTimer.current);
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await axios.get(`${BACKEND_URL}/documents/search-users`, {
          headers: authHeader(), params: { q: query, docId },
        });
        setSearchResults(r.data);
      } catch (_) {}
      finally { setSearching(false); }
    }, 300);
  }, [query, docId]);

  const handleAdd = async () => {
    if (!selectedUser) return;
    setAdding(true);
    try {
      const r = await axios.post(
        `${BACKEND_URL}/documents/${docId}/collaborators`,
        { userId: selectedUser._id, access: pendingAccess },
        { headers: authHeader() }
      );
      setCollaborators(r.data);
      setSelectedUser(null); setQuery(""); setSearchResults([]);
    } catch (err) { console.error(err); }
    finally { setAdding(false); }
  };

  const handleAccessChange = async (uid, access) => {
    try {
      const r = await axios.patch(
        `${BACKEND_URL}/documents/${docId}/collaborators/${uid}`,
        { access }, { headers: authHeader() }
      );
      setCollaborators(r.data);
    } catch (err) { console.error(err); }
  };

  const handleRemove = async (uid) => {
    try {
      const r = await axios.delete(
        `${BACKEND_URL}/documents/${docId}/collaborators/${uid}`,
        { headers: authHeader() }
      );
      setCollaborators(r.data);
    } catch (err) { console.error(err); }
  };

  const ICONS = {
    globe: <svg style={{width:16,height:16,flexShrink:0}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    lock:  <svg style={{width:16,height:16,flexShrink:0}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    close: <svg style={{width:16,height:16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    plus:  <svg style={{width:13,height:13}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash: <svg style={{width:13,height:13}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
    eye:   <svg style={{width:12,height:12}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    pencil:<svg style={{width:12,height:12}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    search:<svg style={{width:14,height:14}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  };

  const sp = { // short style objects
    overlay:    { position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",padding:"60px 20px 20px",backdropFilter:"blur(3px)" },
    panel:      { width:"100%",maxWidth:430,background:"#141622",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,display:"flex",flexDirection:"column",maxHeight:"calc(100vh - 80px)",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.7)" },
    panelHead:  { display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px 14px",borderBottom:"1px solid rgba(255,255,255,.06)" },
    panelTitle: { fontSize:15,fontWeight:600,color:"#f1f5f9" },
    closeBtn:   { background:"none",border:"none",color:"#475569",cursor:"pointer",padding:4,borderRadius:6,display:"flex" },
    body:       { padding:"16px 20px",overflowY:"auto",display:"flex",flexDirection:"column",gap:20 },
    sectionLbl: { fontSize:12,fontWeight:600,color:"#64748b",textTransform:"uppercase",letterSpacing:".7px",marginBottom:8 },
    visRow:     { display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"#0d0e14",border:"1px solid rgba(255,255,255,.06)",borderRadius:10 },
    visLeft:    { display:"flex",alignItems:"center",gap:10,color:"#94a3b8" },
    visLabel:   { fontSize:13,fontWeight:500,color:"#e2e8f0" },
    visSub:     { fontSize:11,color:"#475569",marginTop:1 },
    searchWrap: { position:"relative" },
    searchIcon: { position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#475569",pointerEvents:"none" },
    searchInput:{ width:"100%",background:"#0d0e14",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"9px 12px 9px 34px",color:"#e2e8f0",fontFamily:"Inter,sans-serif",fontSize:13,outline:"none" },
    results:    { background:"#0d0e14",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,marginTop:6,overflow:"hidden" },
    resultItem: { display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.04)" },
    siInfo:     { flex:1,minWidth:0 },
    siName:     { fontSize:13,fontWeight:500,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" },
    siEmail:    { fontSize:11,color:"#475569",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" },
    siAdd:      { display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#4f8ef7",fontWeight:500,whiteSpace:"nowrap" },
    accRow:     { display:"flex",alignItems:"center",gap:8,padding:"4px 12px 10px",flexWrap:"wrap" },
    accLabel:   { fontSize:11,color:"#475569" },
    accRadio:   { display:"flex",gap:6 },
    ar:         (sel) => ({ display:"flex",alignItems:"center",gap:4,padding:"4px 10px",border:`1px solid ${sel?"#4f8ef7":"rgba(255,255,255,.08)"}`,borderRadius:6,cursor:"pointer",fontSize:12,color:sel?"#4f8ef7":"#94a3b8",background:sel?"rgba(79,142,247,.1)":"transparent" }),
    confirmBtn: { display:"flex",alignItems:"center",gap:5,background:"linear-gradient(135deg,#4f8ef7,#7c3aed)",color:"#fff",border:"none",padding:"6px 14px",borderRadius:7,fontFamily:"Inter,sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",marginLeft:"auto" },
    collabEntry:{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#0d0e14",border:"1px solid rgba(255,255,255,.06)",borderRadius:10,marginBottom:6 },
    ceInfo:     { flex:1,minWidth:0 },
    ceName:     { fontSize:13,fontWeight:500,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" },
    ceEmail:    { fontSize:11,color:"#475569",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" },
    ceControls: { display:"flex",alignItems:"center",gap:6,flexShrink:0 },
    accSelect:  { background:"#1a1d2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:6,color:"#94a3b8",fontFamily:"Inter,sans-serif",fontSize:11,padding:"4px 7px",cursor:"pointer",outline:"none" },
    removeBtn:  { display:"flex",alignItems:"center",justifyContent:"center",width:26,height:26,background:"none",border:"1px solid rgba(255,255,255,.06)",borderRadius:6,color:"#475569",cursor:"pointer" },
    empty:      { textAlign:"center",padding:20,color:"#334155",fontSize:13 },
    spinner:    { display:"flex",justifyContent:"center",padding:14,gap:6 },
  };

  const Toggle = ({ checked, onChange }) => (
    <label style={{ position:"relative",width:38,height:21,cursor:"pointer",flexShrink:0 }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity:0,width:0,height:0,position:"absolute" }} />
      <div style={{ position:"absolute",inset:0,background:checked?"#4f8ef7":"#1e2235",borderRadius:21,border:`1px solid ${checked?"#4f8ef7":"rgba(255,255,255,.08)"}`,transition:"background .2s" }} />
      <div style={{ position:"absolute",top:3,left:checked?20:3,width:15,height:15,background:"#fff",borderRadius:"50%",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.4)" }} />
    </label>
  );

  const Spinner = () => (
    <div style={sp.spinner}>
      {[0,1,2].map(i => <div key={i} style={{ width:6,height:6,borderRadius:"50%",background:"#4f8ef7",animation:"de-p 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s` }}/>)}
    </div>
  );

  return (
    <div style={sp.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sp.panel}>
        <div style={sp.panelHead}>
          <span style={sp.panelTitle}>Share document</span>
          <button style={sp.closeBtn} onClick={onClose}>{ICONS.close}</button>
        </div>

        <div style={sp.body}>

          {/* Public toggle */}
          {isOwner && (
            <div style={sp.visRow}>
              <div style={sp.visLeft}>
                {isPublic ? ICONS.globe : ICONS.lock}
                <div>
                  <div style={sp.visLabel}>{isPublic ? "Public" : "Private"}</div>
                  <div style={sp.visSub}>{isPublic ? "Anyone with the link can view" : "Only invited people"}</div>
                </div>
              </div>
              <Toggle checked={isPublic} onChange={e => onPublicToggle(e.target.checked)} />
            </div>
          )}

          {/* Invite */}
          {isOwner && (
            <div>
              <div style={sp.sectionLbl}>Invite people</div>
              <div style={sp.searchWrap}>
                <span style={sp.searchIcon}>{ICONS.search}</span>
                <input
                  style={sp.searchInput}
                  placeholder="Search by name or email…"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelectedUser(null); }}
                />
              </div>

              {/* Dropdown results */}
              {!selectedUser && (searching || searchResults.length > 0 || (query.length >= 2 && !searching)) && (
                <div style={sp.results}>
                  {searching && <Spinner />}
                  {!searching && searchResults.length === 0 && query.length >= 2 && (
                    <div style={sp.empty}>No users found</div>
                  )}
                  {searchResults.map(u => (
                    <div key={u._id} style={sp.resultItem}
                      onMouseEnter={e => e.currentTarget.style.background="#141e2e"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}
                      onClick={() => { setSelectedUser(u); setSearchResults([]); }}>
                      <UserAvatar user={u} size={32} />
                      <div style={sp.siInfo}>
                        <div style={sp.siName}>{fullName(u)}</div>
                        <div style={sp.siEmail}>{u.email}</div>
                      </div>
                      <span style={sp.siAdd}>{ICONS.plus} Add</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected user + access picker */}
              {selectedUser && (
                <div style={sp.results}>
                  <div style={{ ...sp.resultItem, cursor:"default" }}>
                    <UserAvatar user={selectedUser} size={32} />
                    <div style={sp.siInfo}>
                      <div style={sp.siName}>{fullName(selectedUser)}</div>
                      <div style={sp.siEmail}>{selectedUser.email}</div>
                    </div>
                    <button style={sp.closeBtn} onClick={() => { setSelectedUser(null); setQuery(""); }}>
                      {ICONS.close}
                    </button>
                  </div>
                  <div style={sp.accRow}>
                    <span style={sp.accLabel}>Access:</span>
                    <div style={sp.accRadio}>
                      {[{ val:"read",label:"View",icon:ICONS.eye },{ val:"write",label:"Edit",icon:ICONS.pencil }].map(({ val, label, icon }) => (
                        <div key={val} style={sp.ar(pendingAccess === val)} onClick={() => setPendingAccess(val)}>
                          {icon} {label}
                        </div>
                      ))}
                    </div>
                    <button style={{ ...sp.confirmBtn, opacity: adding ? .5 : 1 }} onClick={handleAdd} disabled={adding}>
                      {adding ? "Adding…" : "Invite"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Collaborator list */}
          <div>
            <div style={sp.sectionLbl}>
              People with access{collaborators.length > 0 ? ` (${collaborators.length})` : ""}
            </div>
            {loadingList && <Spinner />}
            {!loadingList && collaborators.length === 0 && (
              <div style={sp.empty}>No collaborators yet{isOwner ? " — invite someone above." : "."}</div>
            )}
            {collaborators.map(c => {
              const u    = c.user;
              const uid  = String(u?._id ?? u);
              const isSelf = uid === String(currentUserId);
              return (
                <div key={uid} style={sp.collabEntry}>
                  <UserAvatar user={u} size={32} />
                  <div style={sp.ceInfo}>
                    <div style={sp.ceName}>{fullName(u)}{isSelf ? " (you)" : ""}</div>
                    <div style={sp.ceEmail}>{u?.email}</div>
                  </div>
                  <div style={sp.ceControls}>
                    <select
                      style={{ ...sp.accSelect, opacity: isOwner ? 1 : .5 }}
                      value={c.access}
                      disabled={!isOwner}
                      onChange={e => handleAccessChange(uid, e.target.value)}
                    >
                      <option value="read">View</option>
                      <option value="write">Edit</option>
                    </select>
                    {(isOwner || isSelf) && (
                      <button
                        style={sp.removeBtn}
                        title={isSelf && !isOwner ? "Leave" : "Remove"}
                        onClick={() => handleRemove(uid)}
                        onMouseEnter={e => { e.currentTarget.style.background="rgba(239,68,68,.1)"; e.currentTarget.style.borderColor="rgba(239,68,68,.3)"; e.currentTarget.style.color="#ef4444"; }}
                        onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.borderColor="rgba(255,255,255,.06)"; e.currentTarget.style.color="#475569"; }}
                      >
                        {ICONS.trash}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentEditor (main)
// ---------------------------------------------------------------------------
const S = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400&display=swap');
  * { box-sizing: border-box; }
  .de-root { min-height:100vh; background:#0d0e14; font-family:'Inter',sans-serif; display:flex; flex-direction:column; color:#e2e8f0; }
  .de-menubar { display:flex; align-items:center; padding:0 20px; height:52px; background:rgba(13,14,20,.98); border-bottom:1px solid rgba(255,255,255,.06); position:sticky; top:0; z-index:40; backdrop-filter:blur(12px); gap:10px; }
  .de-back-btn { display:flex; align-items:center; gap:6px; background:none; border:none; color:#475569; font-size:13px; font-family:'Inter',sans-serif; cursor:pointer; padding:6px 10px; border-radius:8px; transition:all .15s; white-space:nowrap; flex-shrink:0; }
  .de-back-btn:hover { background:#141622; color:#94a3b8; }
  .de-back-btn svg { width:14px; height:14px; }
  .de-logo { width:28px; height:28px; background:linear-gradient(135deg,#4f8ef7,#7c3aed); border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 0 12px rgba(79,142,247,.3); }
  .de-logo svg { width:14px; height:14px; color:#fff; }
  .de-menu-sep { width:1px; height:20px; background:rgba(255,255,255,.07); flex-shrink:0; }
  .de-title-input { background:none; border:none; outline:none; font-family:'Inter',sans-serif; font-size:14px; font-weight:600; color:#f1f5f9; min-width:80px; max-width:280px; flex:1; padding:5px 8px; border-radius:7px; transition:background .15s; letter-spacing:-.2px; }
  .de-title-input:hover:not(:disabled) { background:rgba(255,255,255,.05); }
  .de-title-input:focus { background:rgba(255,255,255,.07); }
  .de-title-input:disabled { color:#475569; cursor:default; }
  .de-menubar-right { display:flex; align-items:center; gap:10px; margin-left:auto; }
  .de-share-btn { display:flex; align-items:center; gap:6px; background:#141622; border:1px solid rgba(255,255,255,.08); color:#94a3b8; padding:6px 14px; border-radius:8px; font-family:'Inter',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:all .2s; white-space:nowrap; }
  .de-share-btn:hover { border-color:rgba(79,142,247,.4); color:#4f8ef7; }
  .de-share-btn svg { width:14px; height:14px; }
  .de-avatars { display:flex; align-items:center; }
  .de-avatar { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#fff; border:2px solid #0d0e14; margin-left:-6px; flex-shrink:0; position:relative; cursor:default; transition:transform .15s; }
  .de-avatar:first-child { margin-left:0; }
  .de-avatar:hover { transform:translateY(-2px); z-index:5; }
  .de-avatar-tip { position:absolute; top:34px; left:50%; transform:translateX(-50%); background:#1a1d2e; border:1px solid rgba(255,255,255,.1); border-radius:6px; padding:4px 8px; font-size:11px; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity .15s; z-index:100; color:#94a3b8; }
  .de-avatar:hover .de-avatar-tip { opacity:1; }
  .de-save-status { display:flex; align-items:center; gap:6px; font-size:12px; color:#475569; white-space:nowrap; }
  .de-status-dot { width:6px; height:6px; border-radius:50%; background:#334155; transition:background .3s; }
  .de-status-dot.saving { background:#4f8ef7; animation:de-blink .8s ease-in-out infinite; }
  .de-status-dot.saved  { background:#34d399; }
  @keyframes de-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
  .de-save-btn { display:flex; align-items:center; gap:6px; background:linear-gradient(135deg,#4f8ef7,#7c3aed); color:#fff; border:none; padding:7px 16px; border-radius:8px; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; white-space:nowrap; box-shadow:0 2px 10px rgba(79,142,247,.25); }
  .de-save-btn:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(79,142,247,.4); }
  .de-save-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
  .de-readonly-banner { padding:7px 20px; background:rgba(251,146,60,.08); border-bottom:1px solid rgba(251,146,60,.18); display:flex; align-items:center; gap:8px; font-size:12px; color:#fb923c; }
  .de-readonly-banner svg { width:13px; height:13px; flex-shrink:0; }
  .de-collab-banner { padding:6px 20px; background:rgba(79,142,247,.08); border-bottom:1px solid rgba(79,142,247,.15); display:flex; align-items:center; gap:8px; font-size:12px; color:#4f8ef7; }
  .de-collab-banner svg { width:13px; height:13px; flex-shrink:0; }
  .de-typing-bar { min-height:24px; display:flex; align-items:center; gap:6px; padding:0 20px; font-size:11px; color:#475569; background:rgba(13,14,20,.9); border-bottom:1px solid rgba(255,255,255,.04); }
  .de-typing-dots { display:flex; gap:3px; align-items:center; }
  .de-typing-dot { width:4px; height:4px; border-radius:50%; animation:de-td 1.2s ease-in-out infinite; }
  .de-typing-dot:nth-child(2){animation-delay:.15s} .de-typing-dot:nth-child(3){animation-delay:.3s}
  @keyframes de-td { 0%,100%{opacity:.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(-2px)} }
  .de-toolbar { display:flex; align-items:center; gap:1px; padding:5px 16px; background:#0d0e14; border-bottom:1px solid rgba(255,255,255,.06); flex-wrap:wrap; position:sticky; top:52px; z-index:38; }
  .de-tb-group { display:flex; align-items:center; gap:1px; padding:0 6px; border-right:1px solid rgba(255,255,255,.06); }
  .de-tb-group:last-child { border-right:none; }
  .de-tb-btn { display:flex; align-items:center; justify-content:center; width:30px; height:28px; background:none; border:none; border-radius:6px; color:#475569; cursor:pointer; transition:all .15s; font-size:12px; font-family:'Inter',sans-serif; font-weight:600; }
  .de-tb-btn svg { width:14px; height:14px; }
  .de-tb-btn:hover:not(:disabled) { background:#141622; color:#94a3b8; }
  .de-tb-btn:disabled { opacity:.3; cursor:not-allowed; }
  .de-tb-select { background:transparent; border:1px solid rgba(255,255,255,.08); border-radius:6px; color:#475569; font-family:'Inter',sans-serif; font-size:12px; padding:4px 7px; cursor:pointer; outline:none; transition:all .15s; }
  .de-tb-select:hover:not(:disabled) { border-color:rgba(79,142,247,.4); color:#94a3b8; }
  .de-tb-select:disabled { opacity:.3; cursor:not-allowed; }
  .de-tb-select option { background:#1a1d2e; color:#e2e8f0; }
  .de-color-wrap { width:30px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:6px; transition:background .15s; }
  .de-color-wrap:hover { background:#141622; }
  .de-color-swatch { width:16px; height:16px; border-radius:4px; border:1.5px solid rgba(255,255,255,.15); pointer-events:none; }
  .de-page-area { flex:1; background:#111318; padding:40px 16px; overflow-y:auto; display:flex; justify-content:center; align-items:flex-start; }
  .de-page { width:100%; max-width:760px; min-height:1056px; background:#fff; border-radius:6px; box-shadow:0 4px 40px rgba(0,0,0,.6); padding:72px 88px; }
  @media(max-width:820px){ .de-page{padding:40px 32px} }
  .de-editor { min-height:900px; outline:none; font-family:'Inter',sans-serif; font-size:15px; line-height:1.85; color:#1e293b; caret-color:#4f8ef7; }
  .de-editor:empty::before { content:'Start typing your document...'; color:#94a3b8; pointer-events:none; }
  .de-editor h1{font-size:30px;font-weight:700;color:#0f172a;line-height:1.2;margin:0 0 18px;letter-spacing:-.5px}
  .de-editor h2{font-size:22px;font-weight:700;color:#1e293b;line-height:1.3;margin:24px 0 12px}
  .de-editor h3{font-size:17px;font-weight:600;color:#334155;margin:20px 0 8px}
  .de-editor p{margin:0 0 12px}
  .de-editor ul,.de-editor ol{padding-left:24px;margin:8px 0 12px}
  .de-editor li{margin-bottom:5px}
  .de-editor blockquote{margin:18px 0;padding:14px 20px;border-left:3px solid #4f8ef7;background:rgba(79,142,247,.06);color:#334155;font-style:italic;border-radius:0 8px 8px 0}
  .de-editor code{font-family:'JetBrains Mono',monospace;font-size:13px;background:#f1f5f9;padding:1px 5px;border-radius:4px;color:#7c3aed}
  .de-editor a{color:#4f8ef7;text-decoration:underline}
  .de-editor hr{border:none;border-top:1px solid #e2e8f0;margin:24px 0}
  .de-footer{position:fixed;bottom:14px;right:20px;background:#141622;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:5px 12px;font-size:11px;color:#475569;backdrop-filter:blur(8px);z-index:10;display:flex;align-items:center;gap:10px}
  .de-footer-sep{width:1px;height:12px;background:rgba(255,255,255,.08)}
  .de-loading{display:flex;align-items:center;justify-content:center;height:100vh;background:#0d0e14;gap:8px}
  .de-ld{width:8px;height:8px;border-radius:50%;animation:de-p 1.2s ease-in-out infinite}
  .de-ld:nth-child(1){background:#4f8ef7} .de-ld:nth-child(2){background:#7c3aed;animation-delay:.2s} .de-ld:nth-child(3){background:#38bdf8;animation-delay:.4s}
  @keyframes de-p{0%,100%{opacity:.2;transform:scale(.7)} 50%{opacity:1;transform:scale(1)}}
`;

const Ic = {
  back:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  bold:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>,
  italic:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>,
  under: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>,
  strike:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.8 3.3 3.6 3.6h1"/><path d="M7.7 19.1c2.3.6 4.4 1 6.2.9 2.7 0 5.3-.7 5.3-3.6 0-1.5-1.7-3.1-3.6-3.6H10"/><path d="M5 12h14"/></svg>,
  link:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  ul:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  ol:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>,
  aL:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>,
  aC:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="18" y1="12" x2="6" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/></svg>,
  aR:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="7" y2="18"/></svg>,
  quote: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>,
  undo:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>,
  redo:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>,
  doc:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  share: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  warn:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

export default function DocumentEditor() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const userName      = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email : "Anonymous";
  const currentUserId = user?._id || user?.id;

  // Socket — created here, lives for the lifetime of this page
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!currentUserId) return;
    const s = createSocketConnection(currentUserId);
    socketRef.current = s;
    setSocket(s);
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, [currentUserId]);

  const { collaborators, typingUsers, registerRemoteUpdateHandler, broadcastUpdate, broadcastTyping } =
    useDocumentCollaboration(socket, id, currentUserId, userName);

  const editorRef   = useRef(null);
  const colorRef    = useRef(null);
  const isRemoteRef = useRef(false);

  const [doc,        setDoc]        = useState(null);
  const [myAccess,   setMyAccess]   = useState("read");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [wordCount,  setWordCount]  = useState(0);
  const [textColor,  setTextColor]  = useState("#000000");
  const [showShare,  setShowShare]  = useState(false);

  const isReadOnly = myAccess === "read";
  const isOwner    = myAccess === "owner";
  const tb         = isReadOnly;

  useEffect(() => {
    if (!id) return;
    axios.get(`${BACKEND_URL}/documents/${id}`, { headers: authHeader() })
      .then(res => { setDoc(res.data); setMyAccess(res.data.my_access ?? "read"); })
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    if (doc && editorRef.current && !editorRef.current._initialized) {
      editorRef.current.innerHTML = doc.content || "";
      editorRef.current._initialized = true;
      setWordCount(countWords(doc.content || ""));
    }
  }, [doc]);

  useEffect(() => {
    registerRemoteUpdateHandler(({ content }) => {
      if (!editorRef.current) return;
      isRemoteRef.current = true;
      const sel = window.getSelection();
      let saved = null;
      try { if (sel?.rangeCount > 0) saved = sel.getRangeAt(0).cloneRange(); } catch (_) {}
      editorRef.current.innerHTML = content;
      setWordCount(countWords(content));
      try { if (saved) { sel.removeAllRanges(); sel.addRange(saved); } } catch (_) {}
      isRemoteRef.current = false;
    });
  }, [registerRemoteUpdateHandler]);

  const handleInput = useCallback(() => {
    if (isRemoteRef.current || isReadOnly) return;
    const html = editorRef.current?.innerHTML || "";
    setWordCount(countWords(html));
    setSaveStatus("idle");
    broadcastUpdate(html);
    broadcastTyping();
  }, [broadcastUpdate, broadcastTyping, isReadOnly]);

  const save = useCallback(async () => {
    if (isReadOnly) return;
    setSaveStatus("saving");
    try {
      const content = editorRef.current?.innerHTML || "";
      await axios.put(`${BACKEND_URL}/documents/${id}`, { content, title: doc?.title }, { headers: authHeader() });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) { console.error(err); setSaveStatus("idle"); }
  }, [id, doc?.title, isReadOnly]);

  useEffect(() => {
    const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const handlePublicToggle = async val => {
    try {
      await axios.put(`${BACKEND_URL}/documents/${id}`, { is_public: val }, { headers: authHeader() });
      setDoc(d => ({ ...d, is_public: val }));
    } catch (err) { console.error(err); }
  };

  const exec = (cmd, val = null) => {
    if (isReadOnly) return;
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };
  const insertLink = () => { const url = prompt("Enter URL:"); if (url) exec("createLink", url); };

  if (!doc) return (
    <div className="de-loading">
      <style>{S}</style>
      <div className="de-ld"/><div className="de-ld"/><div className="de-ld"/>
    </div>
  );

  const statusText = saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Unsaved changes";

  return (
    <div className="de-root">
      <style>{S}</style>

      {/* Menubar */}
      <div className="de-menubar">
        <button className="de-back-btn" onClick={() => navigate("/documents")}>{Ic.back} Docs</button>
        <div className="de-logo">{Ic.doc}</div>
        <div className="de-menu-sep"/>
        <input className="de-title-input" value={doc.title || ""} disabled={isReadOnly}
          onChange={e => setDoc({ ...doc, title: e.target.value })} placeholder="Untitled document"/>
        <div className="de-menubar-right">
          {collaborators.length > 0 && (
            <div className="de-avatars">
              {collaborators.slice(0, 5).map(c => (
                <div key={c.userId} className="de-avatar" style={{ background: c.color || seedColor(c.name) }}>
                  {initials(c.name)}
                  <div className="de-avatar-tip">{c.name}</div>
                </div>
              ))}
              {collaborators.length > 5 && (
                <div className="de-avatar" style={{ background: "#334155" }}>
                  +{collaborators.length - 5}
                  <div className="de-avatar-tip">{collaborators.length - 5} more</div>
                </div>
              )}
            </div>
          )}
          {!isReadOnly && (
            <>
              <div className="de-save-status">
                <div className={`de-status-dot ${saveStatus}`}/>
                <span>{statusText}</span>
              </div>
              <button className="de-save-btn" onClick={save} disabled={saveStatus === "saving"}>
                {saveStatus === "saving" ? "Saving…" : "Save"}
              </button>
            </>
          )}
          <button className="de-share-btn" onClick={() => setShowShare(true)}>
            {Ic.share} Share
          </button>
        </div>
      </div>

      {/* Read-only warning */}
      {isReadOnly && (
        <div className="de-readonly-banner">
          {Ic.warn}
          <span>You have <strong>view-only</strong> access. Contact the owner to request edit permissions.</span>
        </div>
      )}

      {/* Live editing banner */}
      {collaborators.length > 0 && (
        <div className="de-collab-banner">
          {Ic.users}
          <span>{collaborators.map(c => c.name).join(", ")} {collaborators.length === 1 ? "is" : "are"} also here</span>
        </div>
      )}

      {/* Typing bar */}
      <div className="de-typing-bar">
        {typingUsers.length > 0 && (
          <>
            <div className="de-typing-dots">
              {[0,1,2].map(i => (
                <div key={i} className="de-typing-dot"
                  style={{ background: typingUsers[0]?.color || "#4f8ef7", animationDelay: `${i * 0.15}s` }}/>
              ))}
            </div>
            <span>{typingUsers.map(u => u.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…</span>
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="de-toolbar">
        <div className="de-tb-group">
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("undo")}>{Ic.undo}</button>
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("redo")}>{Ic.redo}</button>
        </div>
        <div className="de-tb-group">
          <select className="de-tb-select" disabled={tb} onChange={e => exec("formatBlock", e.target.value)} defaultValue="">
            <option value="" disabled>Format</option>
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="blockquote">Quote</option>
            <option value="pre">Code</option>
          </select>
        </div>
        <div className="de-tb-group">
          <select className="de-tb-select" disabled={tb} onChange={e => exec("fontSize", e.target.value)} defaultValue="3">
            {[["1","8"],["2","10"],["3","12"],["4","14"],["5","18"],["6","24"],["7","36"]].map(([v,l]) =>
              <option key={v} value={v}>{l}</option>
            )}
          </select>
        </div>
        <div className="de-tb-group">
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("bold")}>{Ic.bold}</button>
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("italic")}>{Ic.italic}</button>
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("underline")}>{Ic.under}</button>
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("strikeThrough")}>{Ic.strike}</button>
        </div>
        <div className="de-tb-group">
          <div className="de-color-wrap" style={{ opacity: tb ? .3 : 1, cursor: tb ? "not-allowed" : "pointer" }}
            onClick={() => !tb && colorRef.current?.click()}>
            <div className="de-color-swatch" style={{ background: textColor }}/>
            <input ref={colorRef} type="color" style={{ display:"none" }} value={textColor}
              onChange={e => { setTextColor(e.target.value); exec("foreColor", e.target.value); }}/>
          </div>
        </div>
        <div className="de-tb-group">
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("justifyLeft")}>{Ic.aL}</button>
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("justifyCenter")}>{Ic.aC}</button>
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("justifyRight")}>{Ic.aR}</button>
        </div>
        <div className="de-tb-group">
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("insertUnorderedList")}>{Ic.ul}</button>
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("insertOrderedList")}>{Ic.ol}</button>
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("formatBlock","blockquote")}>{Ic.quote}</button>
        </div>
        <div className="de-tb-group">
          <button className="de-tb-btn" disabled={tb} onClick={insertLink}>{Ic.link}</button>
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("insertHorizontalRule")}>
            <span style={{ fontSize:14,lineHeight:1,fontWeight:400 }}>—</span>
          </button>
        </div>
        <div className="de-tb-group">
          <button className="de-tb-btn" disabled={tb} onClick={() => exec("removeFormat")}>
            <span style={{ fontFamily:"monospace",fontSize:11 }}>Tx</span>
          </button>
        </div>
      </div>

      {/* Page */}
      <div className="de-page-area">
        <div className="de-page">
          <div ref={editorRef} className="de-editor"
            contentEditable={!isReadOnly}
            suppressContentEditableWarning
            onInput={handleInput}
            spellCheck
          />
        </div>
      </div>

      {/* Footer */}
      <div className="de-footer">
        <span>{wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}</span>
        {collaborators.length > 0 && (
          <><div className="de-footer-sep"/><span style={{ color:"#4f8ef7" }}>{collaborators.length + 1} online</span></>
        )}
        <div className="de-footer-sep"/>
        {isReadOnly
          ? <span style={{ color:"#fb923c" }}>View only</span>
          : <span>Ctrl+S to save</span>
        }
      </div>

      {/* Share panel */}
      {showShare && (
        <SharePanel
          docId={id}
          isOwner={isOwner}
          isPublic={!!doc.is_public}
          onPublicToggle={handlePublicToggle}
          onClose={() => setShowShare(false)}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}