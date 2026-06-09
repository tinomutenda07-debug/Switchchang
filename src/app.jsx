import { useState, useEffect, useRef } from "react";

// ─── In-memory database ────────────────────────────────────────────────────────
const DB = {
  users: [
    {
      id: 1, name: "Admin", email: "admin@swiftchange.co.zw",
      password: "admin123", phone: "+263771000000", role: "admin",
      balance_rtgs: 0, balance_usd: 0, ecocash: "+263771000000", verified: true,
    },
  ],
  transactions: [],
  pendingDeposits: [],   // { id, userId, userName, phone, amount, currency, date, status }
  pendingWithdrawals: [], // { id, userId, userName, phone, amount, currency, ecocash, date, status }
  rate: 3800,            // 1 USD = 3800 ZWL
  spreadPct: 2,          // sell spread %
  nextUserId: 2,
  nextTxId: 1,
  nextDepId: 1,
  nextWdId: 1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtZWL = (n) => `ZWL ${Number(n).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUSD = (n) => `$${Number(n).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const now = () => new Date().toLocaleString("en-GB", { hour12: false });
const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// ─── Design tokens ─────────────────────────────────────────────────────────────
// Palette: Deep forest green as primary (Zimbabwe flag nod), warm amber accent,
// clean white surface — distinct from the default dark-gold fintech template.
const T = {
  bg: "#0D1A12",
  surface: "#122018",
  card: "#192B1F",
  border: "#1E3828",
  green: "#16A34A",
  greenLight: "#22C55E",
  greenPale: "rgba(22,163,74,0.12)",
  amber: "#F59E0B",
  amberLight: "#FCD34D",
  amberPale: "rgba(245,158,11,0.1)",
  red: "#EF4444",
  redPale: "rgba(239,68,68,0.1)",
  blue: "#3B82F6",
  text: "#F0F7F2",
  muted: "#6B8F74",
  faint: "#2A4030",
};

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html{font-size:16px;}
body{background:${T.bg};color:${T.text};font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;}
input,button,select{font-family:'Plus Jakarta Sans',sans-serif;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px;}

/* ── Shell ── */
.shell{min-height:100vh;display:flex;flex-direction:column;max-width:480px;margin:0 auto;position:relative;}
.topbar{background:${T.surface};border-bottom:1px solid ${T.border};padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:200;}
.topbar-brand{font-size:17px;font-weight:800;letter-spacing:-0.4px;color:${T.greenLight};}
.topbar-brand span{color:${T.amber};}
.topbar-right{display:flex;align-items:center;gap:8px;}
.avatar{width:32px;height:32px;border-radius:50%;background:${T.green};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;}
.content{flex:1;padding:16px 16px 100px;}
.bottomnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:${T.surface};border-top:1px solid ${T.border};display:flex;z-index:200;}
.bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px 14px;cursor:pointer;color:${T.muted};font-size:10px;font-weight:600;letter-spacing:0.3px;border:none;background:transparent;transition:color 0.15s;}
.bnav-item.active{color:${T.greenLight};}
.bnav-icon{font-size:20px;line-height:1;}

/* ── Buttons ── */
.btn{border:none;cursor:pointer;border-radius:12px;font-weight:600;transition:all 0.15s;display:inline-flex;align-items:center;justify-content:center;gap:6px;}
.btn:disabled{opacity:0.35;cursor:not-allowed;}
.btn-primary{background:${T.green};color:#fff;padding:14px 20px;font-size:15px;width:100%;}
.btn-primary:not(:disabled):hover{background:${T.greenLight};}
.btn-amber{background:${T.amber};color:#0D1A12;padding:14px 20px;font-size:15px;width:100%;font-weight:700;}
.btn-amber:not(:disabled):hover{background:${T.amberLight};}
.btn-outline{background:transparent;border:1px solid ${T.border};color:${T.text};padding:11px 18px;font-size:14px;}
.btn-outline:hover{border-color:${T.green};color:${T.greenLight};}
.btn-sm{padding:7px 14px;font-size:12px;border-radius:8px;}
.btn-danger{background:${T.red};color:#fff;padding:8px 14px;font-size:13px;border-radius:8px;}
.btn-ghost{background:transparent;border:none;color:${T.muted};font-size:13px;cursor:pointer;padding:4px;}

/* ── Form ── */
.field{margin-bottom:14px;}
.field label{display:block;font-size:11px;font-weight:700;color:${T.muted};margin-bottom:6px;text-transform:uppercase;letter-spacing:0.6px;}
.field input,.field select{width:100%;background:${T.surface};border:1px solid ${T.border};border-radius:10px;padding:13px 14px;color:${T.text};font-size:15px;outline:none;transition:border-color 0.15s;}
.field input:focus,.field select:focus{border-color:${T.green};}
.field select option{background:${T.card};}
.err-msg{color:${T.red};font-size:13px;margin-bottom:12px;padding:10px 14px;background:${T.redPale};border-radius:8px;}
.ok-msg{color:${T.greenLight};font-size:13px;margin-bottom:12px;padding:10px 14px;background:${T.greenPale};border-radius:8px;}

/* ── Cards ── */
.card{background:${T.card};border:1px solid ${T.border};border-radius:16px;padding:20px;margin-bottom:14px;}
.card-sm{background:${T.card};border:1px solid ${T.border};border-radius:12px;padding:14px 16px;}
.section-label{font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;}

/* ── Stat chips ── */
.bal-row{display:flex;gap:10px;margin-bottom:14px;}
.bal-chip{flex:1;background:${T.surface};border:1px solid ${T.border};border-radius:12px;padding:14px;text-align:center;}
.bal-chip .label{font-size:10px;font-weight:700;color:${T.muted};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;}
.bal-chip .value{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:600;color:${T.text};}
.bal-chip .value.usd{color:${T.greenLight};}
.bal-chip .value.zwl{color:${T.amber};}

/* ── Rate ticker ── */
.rate-ticker{background:${T.greenPale};border:1px solid ${T.green};border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
.rate-ticker .rate-num{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:600;color:${T.greenLight};}
.rate-ticker .rate-sub{font-size:11px;color:${T.muted};}

/* ── Action grid ── */
.action-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.action-btn{background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px 14px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all 0.15s;color:${T.text};}
.action-btn:hover{border-color:${T.green};background:${T.greenPale};}
.action-btn .icon{font-size:26px;}
.action-btn .lbl{font-size:13px;font-weight:600;}
.action-btn .sub{font-size:11px;color:${T.muted};}

/* ── Transaction list ── */
.tx-list{display:flex;flex-direction:column;gap:8px;}
.tx-item{background:${T.surface};border:1px solid ${T.border};border-radius:12px;padding:13px 15px;display:flex;align-items:center;gap:12px;}
.tx-icon{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
.tx-icon.buy{background:${T.greenPale};}
.tx-icon.sell{background:${T.amberPale};}
.tx-icon.dep{background:rgba(59,130,246,0.1);}
.tx-icon.wd{background:rgba(239,68,68,0.1);}
.tx-body{flex:1;min-width:0;}
.tx-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tx-date{font-size:11px;color:${T.muted};}
.tx-amt{text-align:right;flex-shrink:0;}
.tx-amt .main{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;}
.tx-amt .sub{font-size:11px;color:${T.muted};}
.tx-amt .main.pos{color:${T.greenLight};}
.tx-amt .main.neg{color:${T.red};}
.tx-amt .main.amb{color:${T.amber};}

/* ── Badge ── */
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.3px;}
.badge-pending{background:${T.amberPale};color:${T.amber};}
.badge-approved{background:${T.greenPale};color:${T.greenLight};}
.badge-rejected{background:${T.redPale};color:${T.red};}

/* ── Step indicator ── */
.steps{display:flex;gap:0;margin-bottom:24px;}
.step{flex:1;height:3px;background:${T.border};border-radius:2px;transition:background 0.3s;}
.step.done{background:${T.green};}
.step+.step{margin-left:4px;}

/* ── Sheet overlay ── */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:300;display:flex;align-items:flex-end;justify-content:center;}
.sheet{background:${T.card};border:1px solid ${T.border};border-radius:20px 20px 0 0;padding:24px 20px 40px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;}
.sheet-handle{width:40px;height:4px;background:${T.border};border-radius:2px;margin:0 auto 20px;}
.sheet-title{font-size:17px;font-weight:700;margin-bottom:20px;}

/* ── Auth ── */
.auth-full{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:${T.bg};}
.auth-logo{margin-bottom:32px;text-align:center;}
.auth-logo h1{font-size:32px;font-weight:800;color:${T.greenLight};letter-spacing:-1px;}
.auth-logo h1 span{color:${T.amber};}
.auth-logo p{color:${T.muted};font-size:14px;margin-top:4px;}
.auth-card{background:${T.card};border:1px solid ${T.border};border-radius:20px;padding:28px;width:100%;max-width:400px;}
.auth-tabs{display:flex;background:${T.surface};border-radius:10px;padding:3px;margin-bottom:20px;}
.auth-tab{flex:1;padding:9px;border:none;background:transparent;color:${T.muted};font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;transition:all 0.15s;}
.auth-tab.active{background:${T.card};color:${T.text};}

/* ── Admin table ── */
.admin-table{width:100%;border-collapse:collapse;font-size:12px;}
.admin-table th{padding:8px 10px;text-align:left;color:${T.muted};font-weight:600;font-size:11px;text-transform:uppercase;border-bottom:1px solid ${T.border};}
.admin-table td{padding:10px 10px;border-bottom:1px solid rgba(30,56,40,0.5);}
.admin-table tr:last-child td{border-bottom:none;}

/* ── Toast ── */
.toast{position:fixed;top:70px;left:50%;transform:translateX(-50%);background:${T.green};color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:500;animation:fadeIn 0.2s ease;white-space:nowrap;}
@keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(-6px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}

/* ── Misc ── */
.divider{height:1px;background:${T.border};margin:16px 0;}
.mono{font-family:'JetBrains Mono',monospace;}
.text-muted{color:${T.muted};}
.text-green{color:${T.greenLight};}
.text-amber{color:${T.amber};}
.text-red{color:${T.red};}
.empty-state{text-align:center;padding:40px 20px;color:${T.muted};font-size:14px;}
.row-between{display:flex;align-items:center;justify-content:space-between;}
.gap-8{gap:8px;}
.mt-8{margin-top:8px;}
.mt-12{margin-top:12px;}
.info-box{background:${T.surface};border:1px solid ${T.border};border-radius:10px;padding:12px 14px;font-size:13px;color:${T.muted};line-height:1.6;}
.info-box strong{color:${T.text};}
`;

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("home");
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState(null); // "deposit" | "withdraw" | "exchange"

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const refresh = () => setSession(s => s ? { ...s, user: { ...DB.users.find(u => u.id === s.user.id) } } : null);

  if (!session) return (
    <>
      <style>{STYLES}</style>
      <AuthScreen onLogin={(u) => { setSession({ user: u }); setPage("home"); }} />
    </>
  );

  const { user } = session;
  const isAdmin = user.role === "admin";

  const navItems = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "exchange", icon: "🔄", label: "Exchange" },
    { id: "history", icon: "📋", label: "History" },
    { id: "account", icon: "👤", label: "Account" },
    ...(isAdmin ? [{ id: "admin", icon: "⚙️", label: "Admin" }] : []),
  ];

  return (
    <>
      <style>{STYLES}</style>
      {toast && <div className="toast">{toast}</div>}

      <div className="shell">
        <div className="topbar">
          <div className="topbar-brand">Swift<span>Change</span></div>
          <div className="topbar-right">
            <div className="avatar">{user.name[0]}</div>
          </div>
        </div>

        <div className="content">
          {page === "home" && <HomePage user={user} setSheet={setSheet} setPage={setPage} />}
          {page === "exchange" && <ExchangePage user={user} showToast={showToast} refresh={refresh} />}
          {page === "history" && <HistoryPage user={user} isAdmin={isAdmin} />}
          {page === "account" && <AccountPage user={user} setSession={setSession} />}
          {page === "admin" && isAdmin && <AdminPage showToast={showToast} refresh={refresh} />}
        </div>

        <nav className="bottomnav">
          {navItems.map(n => (
            <button key={n.id} className={`bnav-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
              <span className="bnav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      {sheet === "deposit" && (
        <DepositSheet user={user} onClose={() => setSheet(null)} showToast={showToast} refresh={refresh} />
      )}
      {sheet === "withdraw" && (
        <WithdrawSheet user={user} onClose={() => setSheet(null)} showToast={showToast} refresh={refresh} />
      )}
    </>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [f, setF] = useState({ name: "", email: "", phone: "", ecocash: "", password: "" });
  const [err, setErr] = useState("");
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const login = () => {
    const u = DB.users.find(u => (u.email === f.email || u.phone === f.email) && u.password === f.password);
    if (!u) return setErr("Wrong email/phone or password.");
    setErr(""); onLogin(u);
  };

  const register = () => {
    if (!f.name || !f.email || !f.phone || !f.password) return setErr("All fields are required.");
    if (DB.users.find(u => u.email === f.email)) return setErr("Email already registered.");
    const u = {
      id: DB.nextUserId++, name: f.name, email: f.email, phone: f.phone,
      ecocash: f.ecocash || f.phone, password: f.password,
      role: "user", balance_rtgs: 0, balance_usd: 0, verified: false,
    };
    DB.users.push(u); setErr(""); onLogin(u);
  };

  return (
    <div className="auth-full">
      <div className="auth-logo">
        <h1>Swift<span>Change</span></h1>
        <p>RTGS ↔ USD · Powered by EcoCash</p>
      </div>
      <div className="auth-card">
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === "login" ? "active" : ""}`} onClick={() => { setTab("login"); setErr(""); }}>Sign In</button>
          <button className={`auth-tab ${tab === "reg" ? "active" : ""}`} onClick={() => { setTab("reg"); setErr(""); }}>Register</button>
        </div>
        {err && <div className="err-msg">{err}</div>}
        {tab === "reg" && <>
          <div className="field"><label>Full Name</label><input placeholder="Tawanda Moyo" value={f.name} onChange={e => set("name", e.target.value)} /></div>
        </>}
        <div className="field"><label>Email</label><input type="email" placeholder="you@email.com" value={f.email} onChange={e => set("email", e.target.value)} /></div>
        {tab === "reg" && <>
          <div className="field"><label>Phone Number</label><input placeholder="+263771234567" value={f.phone} onChange={e => set("phone", e.target.value)} /></div>
          <div className="field"><label>EcoCash Number (optional, defaults to phone)</label><input placeholder="+263771234567" value={f.ecocash} onChange={e => set("ecocash", e.target.value)} /></div>
        </>}
        <div className="field"><label>Password</label><input type="password" placeholder="••••••••" value={f.password} onChange={e => set("password", e.target.value)} onKeyDown={e => e.key === "Enter" && (tab === "login" ? login() : register())} /></div>
        <button className="btn btn-primary" onClick={tab === "login" ? login : register}>
          {tab === "login" ? "Sign In" : "Create Account"}
        </button>
        {tab === "login" && <p style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: T.muted }}>Admin demo: admin@swiftchange.co.zw / admin123</p>}
      </div>
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────
function HomePage({ user, setSheet, setPage }) {
  const myTx = DB.transactions.filter(t => t.userId === user.id);
  const pending = DB.pendingDeposits.filter(d => d.userId === user.id && d.status === "pending").length;
  const sellRate = Math.round(DB.rate * (1 - DB.spreadPct / 100));

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: T.muted }}>Good day,</div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{user.name.split(" ")[0]} 👋</div>
      </div>

      <div className="bal-row">
        <div className="bal-chip">
          <div className="label">ZWL Balance</div>
          <div className="value zwl mono">{fmtZWL(user.balance_rtgs)}</div>
        </div>
        <div className="bal-chip">
          <div className="label">USD Balance</div>
          <div className="value usd mono">{fmtUSD(user.balance_usd)}</div>
        </div>
      </div>

      <div className="rate-ticker">
        <div>
          <div className="rate-sub">Today's Rate</div>
          <div className="rate-num">1 USD = {DB.rate.toLocaleString()} ZWL</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="rate-sub">Sell rate</div>
          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: T.amber }}>1 USD = {sellRate.toLocaleString()} ZWL</div>
        </div>
      </div>

      {pending > 0 && (
        <div style={{ background: T.amberPale, border: `1px solid ${T.amber}`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: T.amber }}>
          ⏳ You have {pending} pending deposit{pending > 1 ? "s" : ""} awaiting admin approval.
        </div>
      )}

      <div className="section-label">Quick Actions</div>
      <div className="action-grid">
        <div className="action-btn" onClick={() => setSheet("deposit")}>
          <span className="icon">📲</span>
          <span className="lbl">Deposit</span>
          <span className="sub">EcoCash → Platform</span>
        </div>
        <div className="action-btn" onClick={() => setSheet("withdraw")}>
          <span className="icon">💸</span>
          <span className="lbl">Withdraw</span>
          <span className="sub">Platform → EcoCash</span>
        </div>
        <div className="action-btn" onClick={() => setPage("exchange")}>
          <span className="icon">🔄</span>
          <span className="lbl">Exchange</span>
          <span className="sub">ZWL ↔ USD</span>
        </div>
        <div className="action-btn" onClick={() => setPage("history")}>
          <span className="icon">📋</span>
          <span className="lbl">History</span>
          <span className="sub">All transactions</span>
        </div>
      </div>

      <div className="section-label" style={{ marginTop: 8 }}>Recent Activity</div>
      <TxList userId={user.id} limit={5} />
    </>
  );
}

// ─── Deposit Sheet ────────────────────────────────────────────────────────────
function DepositSheet({ user, onClose, showToast, refresh }) {
  const [step, setStep] = useState(1); // 1=amount, 2=instructions, 3=confirm
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ZWL");
  const adminPhone = DB.users.find(u => u.role === "admin")?.phone || "+263771000000";

  const parsed = parseFloat(amount) || 0;

  const submit = () => {
    if (parsed <= 0) return;
    DB.pendingDeposits.push({
      id: DB.nextDepId++,
      userId: user.id,
      userName: user.name,
      phone: user.phone,
      ecocash: user.ecocash,
      amount: parsed,
      currency,
      date: now(),
      status: "pending",
      ref: uid(),
    });
    onClose();
    showToast("Deposit request submitted! Awaiting admin approval.");
    refresh();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Deposit via EcoCash</div>
        <div className="steps">
          {[1,2,3].map(s => <div key={s} className={`step ${step >= s ? "done" : ""}`} />)}
        </div>

        {step === 1 && (
          <>
            <div className="field">
              <label>Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="ZWL">ZWL (RTGS)</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="field">
              <label>Amount to Deposit</label>
              <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
            </div>
            <div className="info-box" style={{ marginBottom: 16 }}>
              Minimum deposit: <strong>ZWL 500</strong> or <strong>$1 USD</strong>
            </div>
            <button className="btn btn-primary" disabled={parsed <= 0} onClick={() => setStep(2)}>Continue →</button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="info-box" style={{ marginBottom: 16, lineHeight: 2 }}>
              <strong>Send {currency === "ZWL" ? fmtZWL(parsed) : fmtUSD(parsed)} via EcoCash to:</strong><br />
              📱 <strong style={{ color: T.greenLight, fontSize: 18 }}>{adminPhone}</strong><br />
              <strong>Name:</strong> SwiftChange ZW<br />
              <strong>Reference:</strong> Your phone number<br /><br />
              After sending, tap <strong>"I've Sent It"</strong> below. Admin will confirm and credit your account.
            </div>
            <button className="btn btn-primary" onClick={() => setStep(3)}>I've Sent It ✓</button>
            <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setStep(1)}>← Back</button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="info-box" style={{ marginBottom: 16 }}>
              <strong>Almost done!</strong><br /><br />
              Your deposit request for <strong style={{ color: T.amber }}>{currency === "ZWL" ? fmtZWL(parsed) : fmtUSD(parsed)}</strong> has been logged.<br /><br />
              The admin will verify your EcoCash payment and credit your SwiftChange wallet — usually within minutes.
            </div>
            <div className="field">
              <label>Your EcoCash Number (confirm)</label>
              <input value={user.ecocash} readOnly style={{ color: T.muted }} />
            </div>
            <button className="btn btn-amber" onClick={submit}>Submit Deposit Request</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Withdraw Sheet ───────────────────────────────────────────────────────────
function WithdrawSheet({ user, onClose, showToast, refresh }) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ZWL");
  const [ecocash, setEcocash] = useState(user.ecocash || user.phone);
  const [err, setErr] = useState("");

  const parsed = parseFloat(amount) || 0;
  const available = currency === "ZWL" ? user.balance_rtgs : user.balance_usd;
  const balOk = parsed > 0 && parsed <= available;

  const submit = () => {
    if (!balOk) return setErr("Insufficient balance.");
    if (!ecocash) return setErr("Enter your EcoCash number.");
    // Deduct immediately, pending admin payout
    const u = DB.users.find(u => u.id === user.id);
    if (currency === "ZWL") u.balance_rtgs -= parsed;
    else u.balance_usd -= parsed;

    DB.pendingWithdrawals.push({
      id: DB.nextWdId++,
      userId: user.id, userName: user.name,
      phone: user.phone, ecocash,
      amount: parsed, currency,
      date: now(), status: "pending",
      ref: uid(),
    });
    refresh();
    onClose();
    showToast("Withdrawal submitted! Admin will send to your EcoCash shortly.");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Withdraw to EcoCash</div>
        {err && <div className="err-msg">{err}</div>}
        <div className="field">
          <label>Currency to Withdraw</label>
          <select value={currency} onChange={e => { setCurrency(e.target.value); setErr(""); }}>
            <option value="ZWL">ZWL (RTGS)</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="field">
          <label>Amount</label>
          <input type="number" placeholder="0.00" value={amount} onChange={e => { setAmount(e.target.value); setErr(""); }} />
          <div style={{ fontSize: 12, color: parsed > 0 && !balOk ? T.red : T.muted, marginTop: 5 }}>
            Available: {currency === "ZWL" ? fmtZWL(available) : fmtUSD(available)}
            {parsed > 0 && !balOk && " — Not enough funds"}
          </div>
        </div>
        <div className="field">
          <label>EcoCash Number to Receive Funds</label>
          <input placeholder="+263771234567" value={ecocash} onChange={e => setEcocash(e.target.value)} />
        </div>
        <div className="info-box" style={{ marginBottom: 16 }}>
          Funds will be sent to your EcoCash number after admin approval. Processing time: <strong>within 30 minutes</strong>.
        </div>
        <button className="btn btn-amber" disabled={!balOk || !ecocash} onClick={submit}>Submit Withdrawal</button>
      </div>
    </div>
  );
}

// ─── Exchange Page ────────────────────────────────────────────────────────────
function ExchangePage({ user, showToast, refresh }) {
  const [dir, setDir] = useState("rtgs_to_usd");
  const [amount, setAmount] = useState("");

  const rate = DB.rate;
  const sellRate = Math.round(rate * (1 - DB.spreadPct / 100));
  const parsed = parseFloat(amount) || 0;
  const result = dir === "rtgs_to_usd" ? parsed / rate : parsed * sellRate;
  const balance = dir === "rtgs_to_usd" ? user.balance_rtgs : user.balance_usd;
  const balOk = parsed > 0 && parsed <= balance;

  const execute = () => {
    if (!balOk) return;
    const u = DB.users.find(u => u.id === user.id);
    if (dir === "rtgs_to_usd") { u.balance_rtgs -= parsed; u.balance_usd += result; }
    else { u.balance_usd -= parsed; u.balance_rtgs += result; }

    DB.transactions.push({
      id: DB.nextTxId++, userId: user.id, userName: user.name,
      type: dir === "rtgs_to_usd" ? "buy" : "sell",
      amountIn: parsed, currencyIn: dir === "rtgs_to_usd" ? "ZWL" : "USD",
      amountOut: result, currencyOut: dir === "rtgs_to_usd" ? "USD" : "ZWL",
      rate: dir === "rtgs_to_usd" ? rate : sellRate, date: now(),
    });
    refresh();
    showToast(`Exchanged! You received ${dir === "rtgs_to_usd" ? fmtUSD(result) : fmtZWL(result)}`);
    setAmount("");
  };

  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, letterSpacing: -0.5 }}>Exchange</div>

      <div className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button className={`btn btn-sm ${dir === "rtgs_to_usd" ? "btn-primary" : "btn-outline"}`} style={{ flex: 1 }} onClick={() => { setDir("rtgs_to_usd"); setAmount(""); }}>ZWL → USD</button>
          <button className={`btn btn-sm ${dir === "usd_to_rtgs" ? "btn-primary" : "btn-outline"}`} style={{ flex: 1 }} onClick={() => { setDir("usd_to_rtgs"); setAmount(""); }}>USD → ZWL</button>
        </div>

        <div style={{ background: T.surface, borderRadius: 12, padding: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>You Send</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: T.text, outline: "none" }} />
            <span style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 700 }}>
              {dir === "rtgs_to_usd" ? "ZWL" : "USD"}
            </span>
          </div>
          <div style={{ fontSize: 12, marginTop: 6, color: parsed > 0 && !balOk ? T.red : T.muted }}>
            Balance: {dir === "rtgs_to_usd" ? fmtZWL(balance) : fmtUSD(balance)}
            {parsed > 0 && !balOk && " — Insufficient"}
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 20, color: T.muted, margin: "4px 0" }}>⇣</div>

        <div style={{ background: T.surface, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>You Receive</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input readOnly value={result > 0 ? result.toFixed(2) : ""} placeholder="0.00"
              style={{ flex: 1, background: "transparent", border: "none", fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: T.greenLight, outline: "none" }} />
            <span style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 700 }}>
              {dir === "rtgs_to_usd" ? "USD" : "ZWL"}
            </span>
          </div>
        </div>

        {parsed > 0 && (
          <div style={{ background: T.greenPale, border: `1px solid ${T.green}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: T.muted }}>Rate used</span>
            <span className="mono" style={{ color: T.greenLight }}>1 USD = {(dir === "rtgs_to_usd" ? rate : sellRate).toLocaleString()} ZWL</span>
          </div>
        )}

        <button className="btn btn-primary" disabled={!balOk} onClick={execute}>Confirm Exchange</button>
      </div>

      <div className="info-box">
        <strong>Buy:</strong> 1 USD = {rate.toLocaleString()} ZWL &nbsp;|&nbsp; <strong>Sell:</strong> 1 USD = {Math.round(rate * (1 - DB.spreadPct / 100)).toLocaleString()} ZWL<br />
        Spread: {DB.spreadPct}% · Instant settlement
      </div>
    </>
  );
}

// ─── History Page ─────────────────────────────────────────────────────────────
function HistoryPage({ user, isAdmin }) {
  const [tab, setTab] = useState("all");

  const allTx = isAdmin ? DB.transactions : DB.transactions.filter(t => t.userId === user.id);
  const allDep = isAdmin ? DB.pendingDeposits : DB.pendingDeposits.filter(d => d.userId === user.id);
  const allWd = isAdmin ? DB.pendingWithdrawals : DB.pendingWithdrawals.filter(w => w.userId === user.id);

  const combined = [
    ...allTx.map(t => ({ ...t, _type: "exchange" })),
    ...allDep.map(d => ({ ...d, _type: "deposit" })),
    ...allWd.map(w => ({ ...w, _type: "withdrawal" })),
  ].sort((a, b) => b.id - a.id);

  const shown = tab === "all" ? combined
    : tab === "exchange" ? combined.filter(x => x._type === "exchange")
    : tab === "deposit" ? combined.filter(x => x._type === "deposit")
    : combined.filter(x => x._type === "withdrawal");

  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, letterSpacing: -0.5 }}>History</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {["all", "exchange", "deposit", "withdrawal"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: tab === t ? T.green : T.surface, border: `1px solid ${tab === t ? T.green : T.border}`, color: tab === t ? "#fff" : T.muted, padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {shown.length === 0
        ? <div className="empty-state">No records yet.</div>
        : <TxListFull items={shown} isAdmin={isAdmin} />}
    </>
  );
}

function TxListFull({ items, isAdmin }) {
  return (
    <div className="tx-list">
      {items.map((item, i) => {
        if (item._type === "exchange") return (
          <div className="tx-item" key={`ex-${item.id}`}>
            <div className={`tx-icon ${item.type}`}>{item.type === "buy" ? "💱" : "💵"}</div>
            <div className="tx-body">
              <div className="tx-title">{item.type === "buy" ? "ZWL → USD" : "USD → ZWL"}{isAdmin && ` · ${item.userName}`}</div>
              <div className="tx-date">{item.date}</div>
            </div>
            <div className="tx-amt">
              <div className={`main ${item.type === "buy" ? "pos" : "amb"}`}>{item.type === "buy" ? fmtUSD(item.amountOut) : fmtZWL(item.amountOut)}</div>
              <div className="sub">{item.type === "buy" ? `−${fmtZWL(item.amountIn)}` : `−${fmtUSD(item.amountIn)}`}</div>
            </div>
          </div>
        );
        if (item._type === "deposit") return (
          <div className="tx-item" key={`dep-${item.id}`}>
            <div className="tx-icon dep">📲</div>
            <div className="tx-body">
              <div className="tx-title">Deposit {item.currency}{isAdmin && ` · ${item.userName}`}</div>
              <div className="tx-date">{item.date} · <span className={`badge badge-${item.status}`}>{item.status}</span></div>
            </div>
            <div className="tx-amt">
              <div className="main pos">{item.currency === "ZWL" ? fmtZWL(item.amount) : fmtUSD(item.amount)}</div>
              <div className="sub">EcoCash</div>
            </div>
          </div>
        );
        return (
          <div className="tx-item" key={`wd-${item.id}`}>
            <div className="tx-icon wd">💸</div>
            <div className="tx-body">
              <div className="tx-title">Withdraw {item.currency}{isAdmin && ` · ${item.userName}`}</div>
              <div className="tx-date">{item.date} · <span className={`badge badge-${item.status}`}>{item.status}</span></div>
            </div>
            <div className="tx-amt">
              <div className="main neg">−{item.currency === "ZWL" ? fmtZWL(item.amount) : fmtUSD(item.amount)}</div>
              <div className="sub">{item.ecocash}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TxList({ userId, limit }) {
  const txs = DB.transactions.filter(t => t.userId === userId).slice(-limit).reverse();
  if (txs.length === 0) return <div className="empty-state">No exchanges yet. Make your first!</div>;
  return (
    <div className="tx-list">
      {txs.map(t => (
        <div className="tx-item" key={t.id}>
          <div className={`tx-icon ${t.type}`}>{t.type === "buy" ? "💱" : "💵"}</div>
          <div className="tx-body">
            <div className="tx-title">{t.type === "buy" ? "ZWL → USD" : "USD → ZWL"}</div>
            <div className="tx-date">{t.date}</div>
          </div>
          <div className="tx-amt">
            <div className={`main ${t.type === "buy" ? "pos" : "amb"}`}>{t.type === "buy" ? fmtUSD(t.amountOut) : fmtZWL(t.amountOut)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Account Page ─────────────────────────────────────────────────────────────
function AccountPage({ user, setSession }) {
  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, letterSpacing: -0.5 }}>Account</div>
      <div className="card" style={{ textAlign: "center", paddingTop: 28, paddingBottom: 28 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 auto 12px" }}>{user.name[0]}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{user.name}</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{user.email}</div>
        <div style={{ fontSize: 13, color: T.muted }}>{user.phone}</div>
      </div>
      <div className="card">
        <div className="section-label">EcoCash Details</div>
        <div className="row-between" style={{ fontSize: 14 }}>
          <span style={{ color: T.muted }}>EcoCash Number</span>
          <span className="mono" style={{ fontWeight: 600 }}>{user.ecocash}</span>
        </div>
      </div>
      <div className="card">
        <div className="section-label">Balances</div>
        <div className="row-between" style={{ fontSize: 14, marginBottom: 10 }}>
          <span style={{ color: T.muted }}>ZWL Balance</span>
          <span className="mono text-amber" style={{ fontWeight: 600 }}>{fmtZWL(user.balance_rtgs)}</span>
        </div>
        <div className="row-between" style={{ fontSize: 14 }}>
          <span style={{ color: T.muted }}>USD Balance</span>
          <span className="mono text-green" style={{ fontWeight: 600 }}>{fmtUSD(user.balance_usd)}</span>
        </div>
      </div>
      <button className="btn btn-outline" style={{ width: "100%", marginTop: 8 }} onClick={() => setSession(null)}>Sign Out</button>
    </>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
function AdminPage({ showToast, refresh }) {
  const [tab, setTab] = useState("rate");
  const [newRate, setNewRate] = useState(DB.rate);
  const [newSpread, setNewSpread] = useState(DB.spreadPct);
  const [, forceRender] = useState(0);

  const rerender = () => { forceRender(n => n + 1); refresh(); };

  const updateRate = () => {
    const r = parseInt(newRate);
    if (!r || r < 1) return;
    DB.rate = r; DB.spreadPct = parseFloat(newSpread) || 2;
    rerender(); showToast(`Rate updated: 1 USD = ${r.toLocaleString()} ZWL`);
  };

  const approveDeposit = (dep) => {
    dep.status = "approved";
    const u = DB.users.find(u => u.id === dep.userId);
    if (dep.currency === "ZWL") u.balance_rtgs += dep.amount;
    else u.balance_usd += dep.amount;
    DB.transactions.push({
      id: DB.nextTxId++, userId: dep.userId, userName: dep.userName,
      type: "deposit", amountIn: dep.amount, currencyIn: dep.currency,
      amountOut: dep.amount, currencyOut: dep.currency,
      rate: DB.rate, date: now(),
    });
    rerender(); showToast(`Deposit approved for ${dep.userName}`);
  };

  const rejectDeposit = (dep) => { dep.status = "rejected"; rerender(); showToast("Deposit rejected."); };

  const approveWithdrawal = (wd) => {
    wd.status = "approved";
    DB.transactions.push({
      id: DB.nextTxId++, userId: wd.userId, userName: wd.userName,
      type: "withdrawal", amountIn: wd.amount, currencyIn: wd.currency,
      amountOut: wd.amount, currencyOut: wd.currency,
      rate: DB.rate, date: now(),
    });
    rerender(); showToast(`Withdrawal sent to ${wd.ecocash}`);
  };

  const rejectWithdrawal = (wd) => {
    // Refund
    const u = DB.users.find(u => u.id === wd.userId);
    if (wd.currency === "ZWL") u.balance_rtgs += wd.amount;
    else u.balance_usd += wd.amount;
    wd.status = "rejected"; rerender(); showToast("Withdrawal rejected & refunded.");
  };

  const pendingDeps = DB.pendingDeposits.filter(d => d.status === "pending");
  const pendingWds = DB.pendingWithdrawals.filter(w => w.status === "pending");
  const totalUsers = DB.users.filter(u => u.role !== "admin").length;
  const totalVol = DB.transactions.filter(t => t.type === "buy").reduce((s, t) => s + t.amountOut, 0);

  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14, letterSpacing: -0.5 }}>Admin Panel</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Users", val: totalUsers, color: T.greenLight },
          { label: "Pending Dep.", val: pendingDeps.length, color: T.amber },
          { label: "USD Vol.", val: `$${totalVol.toFixed(0)}`, color: T.blue },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {["rate", "deposits", "withdrawals", "users"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: tab === t ? T.green : T.surface, border: `1px solid ${tab === t ? T.green : T.border}`, color: tab === t ? "#fff" : T.muted, padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}{t === "deposits" && pendingDeps.length > 0 ? ` (${pendingDeps.length})` : ""}{t === "withdrawals" && pendingWds.length > 0 ? ` (${pendingWds.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "rate" && (
        <div className="card">
          <div className="section-label">Exchange Rate Settings</div>
          <div className="info-box" style={{ marginBottom: 14 }}>
            Current: <strong style={{ color: T.greenLight }}>1 USD = {DB.rate.toLocaleString()} ZWL</strong> · Spread: <strong style={{ color: T.amber }}>{DB.spreadPct}%</strong>
          </div>
          <div className="field"><label>Buy Rate (ZWL per 1 USD)</label><input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} /></div>
          <div className="field"><label>Sell Spread (%)</label><input type="number" step="0.1" value={newSpread} onChange={e => setNewSpread(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={updateRate}>Update Rate</button>
        </div>
      )}

      {tab === "deposits" && (
        <>
          {pendingDeps.length === 0 ? <div className="empty-state">No pending deposits.</div> : pendingDeps.map(d => (
            <div key={d.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{d.userName}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{d.ecocash} · {d.date}</div>
                </div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: T.amber }}>{d.currency === "ZWL" ? fmtZWL(d.amount) : fmtUSD(d.amount)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => approveDeposit(d)}>✓ Approve</button>
                <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => rejectDeposit(d)}>✗ Reject</button>
              </div>
            </div>
          ))}
          {DB.pendingDeposits.filter(d => d.status !== "pending").map(d => (
            <div key={d.id} className="card-sm" style={{ marginBottom: 8, opacity: 0.6 }}>
              <div className="row-between">
                <span style={{ fontSize: 13 }}>{d.userName} · {d.currency === "ZWL" ? fmtZWL(d.amount) : fmtUSD(d.amount)}</span>
                <span className={`badge badge-${d.status}`}>{d.status}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "withdrawals" && (
        <>
          {pendingWds.length === 0 ? <div className="empty-state">No pending withdrawals.</div> : pendingWds.map(w => (
            <div key={w.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{w.userName}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>To: {w.ecocash}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{w.date}</div>
                </div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: T.red }}>−{w.currency === "ZWL" ? fmtZWL(w.amount) : fmtUSD(w.amount)}</div>
              </div>
              <div className="info-box" style={{ marginBottom: 10, fontSize: 12 }}>
                Send <strong>{w.currency === "ZWL" ? fmtZWL(w.amount) : fmtUSD(w.amount)}</strong> via EcoCash to <strong style={{ color: T.greenLight }}>{w.ecocash}</strong>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => approveWithdrawal(w)}>✓ Sent</button>
                <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => rejectWithdrawal(w)}>✗ Refund</button>
              </div>
            </div>
          ))}
          {DB.pendingWithdrawals.filter(w => w.status !== "pending").map(w => (
            <div key={w.id} className="card-sm" style={{ marginBottom: 8, opacity: 0.6 }}>
              <div className="row-between">
                <span style={{ fontSize: 13 }}>{w.userName} · {w.ecocash}</span>
                <span className={`badge badge-${w.status}`}>{w.status}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "users" && (
        <>
          {DB.users.filter(u => u.role !== "admin").length === 0
            ? <div className="empty-state">No users registered yet.</div>
            : DB.users.filter(u => u.role !== "admin").map(u => (
              <div key={u.id} className="card-sm" style={{ marginBottom: 8 }}>
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{u.email} · {u.phone}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>EcoCash: {u.ecocash}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                  <span style={{ background: T.amberPale, color: T.amber, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{fmtZWL(u.balance_rtgs)}</span>
                  <span style={{ background: T.greenPale, color: T.greenLight, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{fmtUSD(u.balance_usd)}</span>
                </div>
              </div>
            ))
          }
        </>
      )}
    </>
  );
}
