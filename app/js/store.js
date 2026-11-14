// ============================================================
// ReplyQuick data store (PROTOTYPE)
// Right now this holds demo data in the browser (localStorage) so
// every dashboard is clickable without a server. In Phase 3 the
// functions below get swapped for calls to /server's API; the views
// only call these functions, so they will not need to change.
// ============================================================

const KEY = 'rq_demo_v2';
const listeners = new Set();

// ---------- Seeded random so demo data looks the same each reset ----------
function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
export const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9);

const WEEK_9_5 = {
  mon: { open: '09:00', close: '17:00' }, tue: { open: '09:00', close: '17:00' },
  wed: { open: '09:00', close: '17:00' }, thu: { open: '09:00', close: '17:00' },
  fri: { open: '09:00', close: '17:00' }, sat: null, sun: null,
};

function seed() {
  const firms = [
    {
      id: 'firm_morgan', name: 'Morgan & Associates Law', practice: 'Personal Injury',
      timezone: 'America/New_York', rqNumber: '+13055550142', originalNumbers: ['+13055551200'],
      address: '200 Brickell Ave, Miami, FL', contactName: 'Daniel Morgan', contactEmail: 'owner@morganlaw.demo',
      status: 'live', recordingEnabled: false, createdAt: Date.now() - 40 * DAY,
      greeting: 'Thank you for calling Morgan & Associates. This is {agent}, how can I help you today?',
      instructions: 'New injury callers: get name, phone, date of accident, type of accident (car, slip and fall, work), whether they were treated by a doctor, and whether police were called. Never give legal advice or estimate case value. Existing clients: take a detailed message for their case manager.',
      hours: { ...WEEK_9_5 },
      faqs: [
        { q: 'Do you charge for a consultation?', a: 'No. Consultations are free, and the firm only gets paid if you win your case.' },
        { q: 'Where is the office?', a: '200 Brickell Ave, Miami. Free parking in the garage on SE 2nd St.' },
        { q: 'Do you speak Spanish?', a: 'Yes, two attorneys and the intake team speak Spanish.' },
      ],
      directory: [
        { id: 'c1', name: 'Daniel Morgan', role: 'Managing Partner', phone: '+13055551201', transfer: true, afterHours: true },
        { id: 'c2', name: 'Lisa Park', role: 'Intake Manager', phone: '+13055551202', transfer: true, afterHours: false },
        { id: 'c3', name: 'Tom Reyes', role: 'Case Manager', phone: '+13055551203', transfer: true, afterHours: false },
      ],
    },
    {
      id: 'firm_rivera', name: 'Rivera Family Law', practice: 'Family Law',
      timezone: 'America/Chicago', rqNumber: '+15125550188', originalNumbers: ['+15125557000', '+15125557001'],
      address: '1100 Congress Ave, Austin, TX', contactName: 'Elena Rivera', contactEmail: 'owner@riveralaw.demo',
      status: 'live', recordingEnabled: false, createdAt: Date.now() - 22 * DAY,
      greeting: 'Rivera Family Law, this is {agent}. How may I help you?',
      instructions: 'Divorce, custody and support inquiries: get name, phone, county, whether there are children, and whether anything has been filed yet. If the caller mentions safety concerns or domestic violence, transfer to Elena immediately or give 911 if in danger.',
      hours: { ...WEEK_9_5, fri: { open: '09:00', close: '15:00' } },
      faqs: [
        { q: 'How much is a consultation?', a: 'Initial consultations are $150 for one hour.' },
        { q: 'Do you handle cases outside Travis County?', a: 'Yes: Travis, Williamson and Hays counties.' },
      ],
      directory: [
        { id: 'c1', name: 'Elena Rivera', role: 'Attorney / Owner', phone: '+15125557010', transfer: true, afterHours: true },
        { id: 'c2', name: 'Marcus Hill', role: 'Paralegal', phone: '+15125557011', transfer: true, afterHours: false },
      ],
    },
    {
      id: 'firm_chen', name: 'Chen Criminal Defense', practice: 'Criminal Defense',
      timezone: 'America/Los_Angeles', rqNumber: '+12135550163', originalNumbers: ['+12135553300'],
      address: '355 S Grand Ave, Los Angeles, CA', contactName: 'Victor Chen', contactEmail: 'owner@chendefense.demo',
      status: 'live', recordingEnabled: false, createdAt: Date.now() - 9 * DAY,
      greeting: 'Chen Criminal Defense, this is {agent}. How can I help?',
      instructions: 'Arrests in progress or someone in custody: get the person\'s full name, date of birth, where they are being held, and the charge if known, then warm transfer to Victor 24/7. Everything else: take a message.',
      hours: { mon: { open: '08:00', close: '18:00' }, tue: { open: '08:00', close: '18:00' }, wed: { open: '08:00', close: '18:00' }, thu: { open: '08:00', close: '18:00' }, fri: { open: '08:00', close: '18:00' }, sat: { open: '10:00', close: '14:00' }, sun: null },
      faqs: [
        { q: 'Can you help with bail?', a: 'Yes. Victor handles bail hearings and can be reached 24/7 for anyone currently in custody.' },
      ],
      directory: [
        { id: 'c1', name: 'Victor Chen', role: 'Attorney / Owner', phone: '+12135553301', transfer: true, afterHours: true },
      ],
    },
  ];

  const agents = [
    { id: 'agent_sarah', name: 'Sarah Lopez', email: 'sarah@replyquick.demo', status: 'available', firmIds: firms.map(f => f.id), shiftStart: Date.now() - 4 * 3600000 },
    { id: 'agent_john', name: 'John Bautista', email: 'john@replyquick.demo', status: 'on_call', firmIds: firms.map(f => f.id), shiftStart: Date.now() - 6 * 3600000 },
    { id: 'agent_maria', name: 'Maria Santos', email: 'maria@replyquick.demo', status: 'break', firmIds: firms.map(f => f.id), shiftStart: Date.now() - 5 * 3600000 },
    { id: 'agent_priya', name: 'Priya Nair', email: 'priya@replyquick.demo', status: 'available', firmIds: ['firm_morgan', 'firm_rivera'], shiftStart: Date.now() - 2 * 3600000 },
    { id: 'agent_ken', name: 'Ken Ramos', email: 'ken@replyquick.demo', status: 'offline', firmIds: firms.map(f => f.id), shiftStart: null },
  ];

  const users = [
    { id: 'u_admin', email: 'admin@replyquick.demo', password: 'demo', name: 'ReplyQuick Admin', role: 'admin' },
    { id: 'u_morgan', email: 'owner@morganlaw.demo', password: 'demo', name: 'Daniel Morgan', role: 'firm', firmId: 'firm_morgan' },
    { id: 'u_rivera', email: 'owner@riveralaw.demo', password: 'demo', name: 'Elena Rivera', role: 'firm', firmId: 'firm_rivera' },
    { id: 'u_chen', email: 'owner@chendefense.demo', password: 'demo', name: 'Victor Chen', role: 'firm', firmId: 'firm_chen' },
    ...agents.map(a => ({ id: 'u_' + a.id, email: a.email, password: 'demo', name: a.name, role: 'receptionist', agentId: a.id })),
  ];

  // ---------- Generate 30 days of call history (every call answered) ----------
  const r = rng(42);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const first = ['James', 'Ana', 'Robert', 'Keisha', 'Michael', 'Laura', 'David', 'Carmen', 'Chris', 'Tanya', 'Brian', 'Sofia', 'Kevin', 'Megan', 'Luis', 'Rachel'];
  const last = ['Smith', 'Garcia', 'Johnson', 'Brown', 'Martinez', 'Davis', 'Lopez', 'Wilson', 'Nguyen', 'Taylor', 'Hernandez', 'Clark'];
  const reasons = {
    firm_morgan: ['Car accident last week, wants a consultation', 'Slip and fall at a grocery store', 'Existing client asking for case update', 'Insurance adjuster calling about a claim', 'Work injury, employer denied claim', 'Rear-ended on I-95, neck pain'],
    firm_rivera: ['Wants to file for divorce', 'Custody schedule question, existing client', 'Child support modification', 'Opposing counsel returning call', 'Prenup consultation', 'Spouse served divorce papers'],
    firm_chen: ['Son was arrested last night', 'DUI charge, court date next week', 'Existing client, needs to reschedule', 'Question about expungement', 'Bail hearing question', 'Charged with possession'],
  };
  // Typical fee per retained client, used for demo revenue.
  const FEE = { firm_morgan: [6000, 30000], firm_rivera: [3500, 9000], firm_chen: [2500, 12000] };
  const agentNames = agents.map(a => a.name);
  const calls = [];
  const tasks = [];
  const now = Date.now();
  for (let i = 0; i < 190; i++) {
    const firm = pick(firms);
    const started = now - Math.floor(r() * 30 * DAY);
    const reason = pick(reasons[firm.id]);
    const callerType = /existing/i.test(reason) ? 'Existing client' : /counsel|adjuster/i.test(reason) ? 'Other' : 'New inquiry';
    const o = r();
    let outcome, stage = null, revenue = 0, transfer = null, consultAt = null;
    if (callerType === 'New inquiry') {
      outcome = o < 0.45 ? 'Consultation booked' : o < 0.75 ? 'Transferred' : 'Intake complete';
      if (outcome === 'Consultation booked') consultAt = started + (1 + Math.floor(r() * 4)) * DAY;
      const s = r();
      if (outcome === 'Intake complete') stage = s < 0.3 ? 'not_fit' : 'inquiry';
      else stage = s < 0.45 ? 'retained' : s < 0.85 ? 'consult' : 'not_fit';
      if (stage === 'retained') { const [lo, hi] = FEE[firm.id]; revenue = Math.round((lo + r() * (hi - lo)) / 250) * 250; }
    } else {
      outcome = o < 0.55 ? 'Message taken' : 'Transferred';
    }
    if (outcome === 'Transferred') transfer = { to: pick(firm.directory).name, type: r() < 0.6 ? 'warm' : 'blind', result: 'accepted' };
    calls.push({
      id: 'call_' + (1000 + i), firmId: firm.id,
      callerName: pick(first) + ' ' + pick(last),
      callerPhone: '+1' + Math.floor(2000000000 + r() * 7000000000),
      startedAt: started, waitSec: 2 + Math.floor(r() * 12), durationSec: 60 + Math.floor(r() * 360),
      agent: pick(agentNames), status: 'answered', callerType, reason,
      notes: 'Caller was polite. Best time to reach: afternoons.',
      outcome, transfer, consultAt, stage, revenue,
    });
  }
  calls.sort((a, b) => b.startedAt - a.startedAt);
  return { version: 2, firms, agents, users, calls, tasks, audit: [], onboardingDrafts: [] };
}

// ---------- Persistence ----------
let state;
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage blocked or corrupt: fall through to fresh seed */ }
  return seed();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore in prototype */ }
  listeners.forEach(fn => fn());
}
state = load();

// Keep tabs in sync: a call logged in the receptionist tab shows up in an open firm tab.
window.addEventListener('storage', (e) => {
  if (e.key === KEY && e.newValue) { try { state = JSON.parse(e.newValue); listeners.forEach(fn => fn()); } catch (err) { /* ignore */ } }
});

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function resetDemo() { state = seed(); save(); }

// ---------- Auth ----------
const SESSION = 'rq_session';
export function login(email, password) {
  const u = state.users.find(x => x.email.toLowerCase() === String(email).trim().toLowerCase() && x.password === password);
  if (!u) return null;
  try { localStorage.setItem(SESSION, u.id); } catch (e) { /* ignore */ }
  return u;
}
export function logout() { try { localStorage.removeItem(SESSION); } catch (e) { /* ignore */ } }
export function currentUser() {
  let id = null;
  try { id = localStorage.getItem(SESSION); } catch (e) { /* ignore */ }
  return state.users.find(u => u.id === id) || null;
}

// ---------- Reads ----------
export const getFirms = () => state.firms;
export const getFirm = (id) => state.firms.find(f => f.id === id);
export const getAgents = () => state.agents;
export const getAgent = (id) => state.agents.find(a => a.id === id);
export const getUsers = () => state.users;
export const getCalls = (firmId) => firmId ? state.calls.filter(c => c.firmId === firmId) : state.calls;
export const getTasks = (firmId) => firmId ? state.tasks.filter(t => t.firmId === firmId) : state.tasks;
export const getAudit = () => state.audit;
export const getDrafts = () => state.onboardingDrafts;

// ---------- Writes ----------
export function audit(action, detail) {
  const u = currentUser();
  state.audit.unshift({ id: uid('aud'), at: Date.now(), by: u ? u.name : 'system', action, detail });
  state.audit = state.audit.slice(0, 300);
}
export function updateFirm(id, patch) {
  const f = getFirm(id); if (!f) return;
  Object.assign(f, patch); audit('Firm settings updated', f.name); save();
}
export function setAgentStatus(agentId, status) {
  const a = getAgent(agentId); if (!a) return;
  a.status = status;
  if (status === 'offline') a.shiftStart = null;
  else if (!a.shiftStart) a.shiftStart = Date.now();
  save();
}
export function updateCall(id, patch) {
  const c = state.calls.find(x => x.id === id); if (!c) return;
  Object.assign(c, patch); save();
}
export function logCall(call) { state.calls.unshift(call); save(); }
export function addTask(task) { state.tasks.unshift(task); save(); }
export function toggleTask(id) { const t = state.tasks.find(x => x.id === id); if (t) { t.done = !t.done; save(); } }
export function addUser(user) {
  if (state.users.some(u => u.email.toLowerCase() === user.email.toLowerCase())) return 'An account with that email already exists.';
  if (user.role === 'receptionist') {
    const agent = { id: uid('agent'), name: user.name, email: user.email, status: 'offline', firmIds: state.firms.map(f => f.id), shiftStart: null };
    state.agents.push(agent); user.agentId = agent.id;
  }
  state.users.push({ id: uid('u'), ...user }); audit('Account created', user.email + ' (' + user.role + ')'); save();
  return null;
}
export function removeUser(id) {
  const u = state.users.find(x => x.id === id); if (!u) return;
  state.users = state.users.filter(x => x.id !== id);
  if (u.agentId) state.agents = state.agents.filter(a => a.id !== u.agentId);
  audit('Account removed', u.email); save();
}
export function setAgentFirms(agentId, firmIds) { const a = getAgent(agentId); if (a) { a.firmIds = firmIds; audit('Agent assignments changed', a.name); save(); } }
export function addFirm(firm) {
  state.firms.push(firm);
  state.agents.forEach(a => { if (!a.firmIds.includes(firm.id)) a.firmIds.push(firm.id); });
  audit('Firm activated', firm.name); save();
}
export function saveDraft(draft) {
  const i = state.onboardingDrafts.findIndex(d => d.id === draft.id);
  if (i >= 0) state.onboardingDrafts[i] = draft; else state.onboardingDrafts.unshift(draft);
  save();
}
export function deleteDraft(id) { state.onboardingDrafts = state.onboardingDrafts.filter(d => d.id !== id); save(); }

// ---------- Helpers ----------
export function fmtPhone(e164) {
  const d = String(e164 || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (d.length !== 10) return e164 || '';
  return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
}
export function toE164(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return d.length === 10 ? '+1' + d : null;
}
export function fmtTime(ts) { const d = new Date(ts); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + pad(d.getMinutes()) + ' ' + ap; }
export function fmtDay(ts) {
  const d = new Date(ts); const today = new Date(); const y = new Date(Date.now() - DAY);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function fmtShift(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 3600) + 'h ' + pad(Math.floor(sec % 3600 / 60)) + 'm'; }
export function fmtDur(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
export function isToday(ts) { return new Date(ts).toDateString() === new Date().toDateString(); }

// Is the firm's office open at a given moment (in the firm's own time zone)?
export function officeOpenAt(firm, when) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: firm.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(when));
  const get = (t) => (parts.find(p => p.type === t) || {}).value;
  const day = get('weekday').toLowerCase().slice(0, 3);
  const hm = get('hour').replace('24', '00') + ':' + get('minute');
  const h = firm.hours[day];
  return !!(h && hm >= h.open && hm < h.close);
}
export function officeOpenNow(firm) { return officeOpenAt(firm, Date.now()); }
export function fmtMoney(n) { return '$' + Math.round(n || 0).toLocaleString('en-US'); }
export function firmLocalTime(firm) {
  return new Intl.DateTimeFormat('en-US', { timeZone: firm.timezone, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date());
}
