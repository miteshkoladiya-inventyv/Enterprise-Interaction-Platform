import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "@/config";
import { useAuthContext } from "@/context/AuthContextProvider";

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  .dp-root {
    min-height: 100vh;
    background: #0d0e14;
    font-family: 'Inter', sans-serif;
    color: #e2e8f0;
  }

  .dp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: sticky;
    top: 0;
    z-index: 20;
    background: rgba(13,14,20,0.95);
    backdrop-filter: blur(12px);
  }

  .dp-header-left { display: flex; align-items: center; gap: 12px; }

  .dp-icon-wrap {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, #4f8ef7 0%, #7c3aed 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(79,142,247,0.3);
    flex-shrink: 0;
  }

  .dp-icon-wrap svg { width: 18px; height: 18px; color: #fff; }

  .dp-title { font-size: 18px; font-weight: 600; color: #f1f5f9; letter-spacing: -0.3px; }
  .dp-subtitle { font-size: 12px; color: #475569; margin-top: 2px; }

  .dp-new-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: linear-gradient(135deg, #4f8ef7 0%, #7c3aed 100%);
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 10px;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(79,142,247,0.3);
  }

  .dp-new-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(79,142,247,0.45); }
  .dp-new-btn svg { width: 15px; height: 15px; }

  .dp-stats {
    display: flex;
    gap: 14px;
    padding: 20px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    flex-wrap: wrap;
  }

  .dp-stat {
    background: #141622;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 150px;
    flex: 1;
  }

  .dp-stat-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .dp-stat-icon svg { width: 18px; height: 18px; }
  .dp-stat-label { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 500; }
  .dp-stat-value { font-size: 22px; font-weight: 700; color: #f1f5f9; line-height: 1.2; }

  .dp-toolbar { padding: 16px 32px; display: flex; align-items: center; gap: 12px; }

  .dp-search {
    position: relative;
    flex: 1;
    max-width: 360px;
  }

  .dp-search svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 15px;
    height: 15px;
    color: #475569;
    pointer-events: none;
  }

  .dp-search input {
    width: 100%;
    background: #141622;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 9px 14px 9px 36px;
    color: #e2e8f0;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }

  .dp-search input::placeholder { color: #334155; }
  .dp-search input:focus { border-color: rgba(79,142,247,0.4); }

  .dp-section { padding: 4px 32px 60px; }

  .dp-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 20px 0 12px;
  }

  .dp-section-label { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }

  .dp-count {
    font-size: 11px;
    color: #475569;
    background: #141622;
    border: 1px solid rgba(255,255,255,0.06);
    padding: 3px 9px;
    border-radius: 20px;
  }

  .dp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(252px, 1fr)); gap: 14px; }

  .dp-card {
    background: #141622;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .dp-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, #4f8ef7, #7c3aed);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .dp-card:hover { border-color: rgba(79,142,247,0.3); transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.5); }
  .dp-card:hover::before { opacity: 1; }

  .dp-card-thumb {
    height: 120px;
    background: #1a1d2e;
    padding: 14px 16px;
    overflow: hidden;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .dp-card-thumb-line { height: 7px; background: #222640; border-radius: 4px; margin-bottom: 6px; }
  .dp-card-thumb-line:nth-child(1) { width: 80%; }
  .dp-card-thumb-line:nth-child(2) { width: 65%; }
  .dp-card-thumb-line:nth-child(3) { width: 90%; }
  .dp-card-thumb-line:nth-child(4) { width: 55%; }
  .dp-card-thumb-line:nth-child(5) { width: 72%; }
  .dp-card-thumb-line:nth-child(6) { width: 40%; }

  .dp-card-thumb-text { font-size: 10px; line-height: 1.7; color: #334155; display: -webkit-box; -webkit-line-clamp: 8; -webkit-box-orient: vertical; overflow: hidden; }

  .dp-card-body { padding: 13px 15px; flex: 1; }
  .dp-card-title { font-size: 14px; font-weight: 600; color: #e2e8f0; margin-bottom: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .dp-card-meta { display: flex; align-items: center; gap: 7px; font-size: 11px; color: #475569; flex-wrap: wrap; }
  .dp-card-dot { width: 2px; height: 2px; background: #475569; border-radius: 50%; }

  .dp-badge { font-size: 10px; padding: 2px 7px; border-radius: 5px; font-weight: 500; }
  .dp-badge-public { background: rgba(52,211,153,0.1); color: #34d399; border: 1px solid rgba(52,211,153,0.2); }
  .dp-badge-mine { background: rgba(79,142,247,0.1); color: #4f8ef7; border: 1px solid rgba(79,142,247,0.2); }

  .dp-empty { grid-column: 1/-1; text-align: center; padding: 80px 20px; }
  .dp-empty-icon { width: 60px; height: 60px; background: #141622; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
  .dp-empty-icon svg { width: 26px; height: 26px; color: #334155; }
  .dp-empty-title { font-size: 15px; font-weight: 600; color: #475569; margin-bottom: 6px; }
  .dp-empty-sub { font-size: 13px; color: #334155; }

  .dp-loading { display: flex; align-items: center; justify-content: center; height: 200px; gap: 8px; }
  .dp-dot { width: 7px; height: 7px; border-radius: 50%; background: #4f8ef7; animation: dp-p 1.2s ease-in-out infinite; }
  .dp-dot:nth-child(2) { animation-delay: 0.2s; background: #7c3aed; }
  .dp-dot:nth-child(3) { animation-delay: 0.4s; background: #38bdf8; }

  @keyframes dp-p {
    0%, 100% { opacity: 0.2; transform: scale(0.7); }
    50% { opacity: 1; transform: scale(1); }
  }
`;

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DocCard({ doc, navigate, isMine }) {
  const preview = doc.content ? doc.content.replace(/<[^>]+>/g, "").slice(0, 300) : null;
  return (
    <div className="dp-card" onClick={() => navigate(`/documents/${doc._id}`)}>
      <div className="dp-card-thumb">
        {preview ? (
          <div className="dp-card-thumb-text">{preview}</div>
        ) : (
          [1,2,3,4,5,6].map((i) => <div key={i} className="dp-card-thumb-line" />)
        )}
      </div>
      <div className="dp-card-body">
        <div className="dp-card-title">{doc.title || "Untitled"}</div>
        <div className="dp-card-meta">
          <span>{timeAgo(doc.updated_at)}</span>
          {isMine && <><div className="dp-card-dot" /><span className="dp-badge dp-badge-mine">Mine</span></>}
          {doc.is_public && <><div className="dp-card-dot" /><span className="dp-badge dp-badge-public">Public</span></>}
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${BACKEND_URL}/documents`, { headers: { Authorization: `Bearer ${token}` } });
      setDocs(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, []);

  const createNew = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${BACKEND_URL}/documents`, { title: "Untitled document", content: "" }, { headers: { Authorization: `Bearer ${token}` } });
      navigate(`/documents/${res.data._id || res.data.id}`);
    } catch (err) { console.error(err); }
  };

  const userId = user?._id || user?.id;
  const filtered = docs.filter((d) => !search || d.title?.toLowerCase().includes(search.toLowerCase()));
  const myDocs = filtered.filter((d) => String(d.owner) === String(userId));
  const otherDocs = filtered.filter((d) => String(d.owner) !== String(userId));

  return (
    <div className="dp-root">
      <style>{S}</style>

      <div className="dp-header">
        <div className="dp-header-left">
          <div className="dp-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div>
            <div className="dp-title">Documents</div>
            <div className="dp-subtitle">Create, edit & collaborate in real-time</div>
          </div>
        </div>
        <button className="dp-new-btn" onClick={createNew}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Document
        </button>
      </div>

      <div className="dp-stats">
        {[
          { label: "Total", value: docs.length, color: "#4f8ef7", bg: "rgba(79,142,247,0.12)", icon: <svg viewBox="0 0 24 24" fill="none" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
          { label: "Mine", value: myDocs.length, color: "#7c3aed", bg: "rgba(124,58,237,0.12)", icon: <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
          { label: "Shared", value: otherDocs.length, color: "#34d399", bg: "rgba(52,211,153,0.12)", icon: <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> },
          { label: "Public", value: docs.filter((d) => d.is_public).length, color: "#fb923c", bg: "rgba(251,146,60,0.12)", icon: <svg viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
        ].map(({ label, value, bg, icon }) => (
          <div key={label} className="dp-stat">
            <div className="dp-stat-icon" style={{ background: bg }}>{icon}</div>
            <div><div className="dp-stat-label">{label}</div><div className="dp-stat-value">{value}</div></div>
          </div>
        ))}
      </div>

      <div className="dp-toolbar">
        <div className="dp-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="dp-section">
        {loading ? (
          <div className="dp-loading"><div className="dp-dot" /><div className="dp-dot" /><div className="dp-dot" /></div>
        ) : (
          <>
            {myDocs.length > 0 && (
              <>
                <div className="dp-section-header">
                  <div className="dp-section-label">My Documents</div>
                  <div className="dp-count">{myDocs.length}</div>
                </div>
                <div className="dp-grid" style={{ marginBottom: 28 }}>
                  {myDocs.map((d) => <DocCard key={d._id} doc={d} navigate={navigate} isMine />)}
                </div>
              </>
            )}
            {otherDocs.length > 0 && (
              <>
                <div className="dp-section-header">
                  <div className="dp-section-label">Shared with me</div>
                  <div className="dp-count">{otherDocs.length}</div>
                </div>
                <div className="dp-grid">
                  {otherDocs.map((d) => <DocCard key={d._id} doc={d} navigate={navigate} />)}
                </div>
              </>
            )}
            {filtered.length === 0 && (
              <div className="dp-grid">
                <div className="dp-empty">
                  <div className="dp-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div className="dp-empty-title">{search ? "No documents found" : "No documents yet"}</div>
                  <div className="dp-empty-sub">{search ? "Try a different search term" : "Click New Document to get started"}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}