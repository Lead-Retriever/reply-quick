// ============================================================
// ReplyQuick data store (PROTOTYPE)
// Right now this holds demo data in the browser (localStorage) so
// every dashboard is clickable without a server. In Phase 3 the
// functions below get swapped for calls to /server's API; the views
// only call these functions, so they will not need to change.
// ============================================================

const KEY = 'rq_demo_v3';
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

  // ---------- Receptionist cheat sheets (per firm) ----------
  const CHEAT = {
    firm_morgan: {
      handles: ['Car, truck and motorcycle accidents', 'Slip and fall', 'Work injuries / workers comp', 'Wrongful death', 'Dog bites'],
      notHandled: ['Divorce or family law', 'Criminal charges', 'Medical malpractice (refer: say the firm will call back with a referral)'],
      ask: ['Full name and best phone number', 'Date of the accident', 'What happened, in their words', 'Were they hurt? Did they see a doctor or go to the ER?', 'Was a police report made?', 'Has an insurance company contacted them?'],
      urgent: [
        { when: 'Accident happened in the last 48 hours', action: 'Warm transfer to Lisa Park (intake). After hours: Daniel Morgan.' },
        { when: 'Insurance adjuster is pressuring them to sign something', action: 'Tell them not to sign anything yet, then warm transfer to Lisa Park.' },
        { when: 'Wrongful death', action: 'Warm transfer to Daniel Morgan, any time of day.' },
      ],
      say: ['"There is no cost to talk with an attorney. The firm only gets paid if you win."', '"Let me get a few details so the attorney is ready when they speak with you."'],
      never: ['Give legal advice or guess what a case is worth', 'Promise the firm will take the case', 'Say "you have a great case"'],
      facts: [{ label: 'Consultation', value: 'Free' }, { label: 'Fee', value: 'Contingency, no win no fee' }, { label: 'Languages', value: 'English, Spanish' }, { label: 'Parking', value: 'Garage on SE 2nd St' }],
    },
    firm_rivera: {
      handles: ['Divorce (contested and uncontested)', 'Child custody and visitation', 'Child support and alimony', 'Prenups and postnups', 'Protective orders'],
      notHandled: ['Criminal cases', 'Personal injury', 'Cases outside Travis, Williamson and Hays counties'],
      ask: ['Full name and best phone number', 'County they live in', 'Are there children? Ages?', 'Has anything been filed yet? Were they served papers?', 'Any court date coming up?'],
      urgent: [
        { when: 'Caller mentions abuse, threats or feeling unsafe', action: 'If in danger now, tell them to call 911. Then warm transfer to Elena Rivera, any time.' },
        { when: 'Court date within 7 days', action: 'Warm transfer to Marcus Hill. After hours: Elena Rivera.' },
      ],
      say: ['"Initial consultations are $150 for one hour."', '"Everything you share stays confidential with the firm."'],
      never: ['Give legal advice', 'Comment on the other spouse or take sides', 'Discuss another client\'s case'],
      facts: [{ label: 'Consultation', value: '$150, one hour' }, { label: 'Counties', value: 'Travis, Williamson, Hays' }, { label: 'Friday hours', value: 'Closes at 3:00 PM' }],
    },
    firm_chen: {
      handles: ['DUI / DWI', 'Drug charges', 'Assault and domestic violence charges', 'Theft and fraud', 'Expungements', 'Bail hearings'],
      notHandled: ['Civil lawsuits', 'Family law', 'Immigration (say the firm will call back with a referral)'],
      ask: ['Caller\'s name and best phone number', 'Who was arrested (full name and date of birth)', 'Where they are being held', 'The charge, if known', 'Any court date?'],
      urgent: [
        { when: 'Someone is in custody right now', action: 'Get name, DOB, location, charge. Warm transfer to Victor Chen, 24/7.' },
        { when: 'Police want to question the caller', action: 'Tell them Victor advises not to answer questions without an attorney, then warm transfer to Victor.' },
      ],
      say: ['"Victor handles bail hearings and is reachable around the clock for anyone in custody."'],
      never: ['Ask whether the person is guilty', 'Give legal advice', 'Discuss details of the case beyond what is needed for intake'],
      facts: [{ label: 'Consultation', value: 'Free for arrests in progress' }, { label: 'Availability', value: 'Victor answers transfers 24/7' }],
    },
  };
  firms.forEach(f => { f.cheatSheet = CHEAT[f.id]; f.recordingEnabled = true; f.calendars = { google: null, outlook: null }; });

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
    // Weighted toward business hours and weekdays so the Insights charts look realistic.
    const HOUR_W = [1, 1, 0.5, 0.5, 0.5, 1, 2, 4, 7, 9, 10, 9, 8, 9, 9, 8, 7, 6, 5, 4, 3, 3, 2, 1.5];
    let started;
    do {
      const day = new Date(now - Math.floor(r() * 30) * DAY); day.setHours(0, 0, 0, 0);
      let x = r() * HOUR_W.reduce((a, b) => a + b, 0), hour = 0;
      while (x > HOUR_W[hour]) { x -= HOUR_W[hour]; hour++; }
      started = day.getTime() + hour * 3600000 + Math.floor(r() * 3600000);
      const dow = new Date(started).getDay();
      if ((dow === 0 || dow === 6) && r() < 0.55) started = null;
    } while (!started || started > now);
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
  // ---------- Sample activity log ----------
  const H = 3600000;
  const audit = [
    { id: 'aud1', at: now - 2 * H, by: 'ReplyQuick Admin', action: 'Firm settings updated', detail: 'Chen Criminal Defense: transfer directory' },
    { id: 'aud2', at: now - 5 * H, by: 'ReplyQuick Admin', action: 'Agent assignments changed', detail: 'Priya Nair: Morgan & Associates Law, Rivera Family Law' },
    { id: 'aud3', at: now - 26 * H, by: 'ReplyQuick Admin', action: 'Recording turned on', detail: 'Rivera Family Law' },
    { id: 'aud4', at: now - 2 * DAY, by: 'Daniel Morgan', action: 'Lead marked retained', detail: 'Morgan & Associates Law: $18,500' },
    { id: 'aud5', at: now - 3 * DAY, by: 'ReplyQuick Admin', action: 'Account created', detail: 'ken@replyquick.demo (receptionist)' },
    { id: 'aud6', at: now - 9 * DAY, by: 'ReplyQuick Admin', action: 'Firm activated', detail: 'Chen Criminal Defense' },
  ];
  // Every demo call has a recording (recording is on for all demo firms).
  calls.forEach(c => { c.recording = true; });

  return { version: 3, firms, agents, users, calls, tasks, audit, onboardingDrafts: [] };
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

// Estimated share of calls a firm answers on its own without ReplyQuick.
// Used for the "without ReplyQuick" comparison on the firm overview. Change it here.
export const BASELINE_ANSWER_RATE = 0.7;
export const getDrafts = () => state.onboardingDrafts;

// ---------- Writes ----------
export function audit(action, detail) {
  const u = currentUser();
  state.audit.unshift({ id: uid('aud'), at: Date.now(), by: u ? u.name : 'system', action, detail });
  state.audit = state.audit.slice(0, 300);
}
export function updateFirm(id, patch) {
  const f = getFirm(id); if (!f) return;
  Object.assign(f, patch); audit('Firm settings updated', f.name + (patch._what ? ': ' + patch._what : '')); delete f._what; save();
}
export function setAgentStatus(agentId, status) {
  const a = getAgent(agentId); if (!a) return;
  a.status = status;
  if (status === 'offline') a.shiftStart = null;
  else if (!a.shiftStart) a.shiftStart = Date.now();
  save();
}
export function updateCall(id, patch, logText) {
  const c = state.calls.find(x => x.id === id); if (!c) return;
  Object.assign(c, patch); if (logText) audit(logText[0], logText[1]); save();
}
export function setCalendar(firmId, provider, account) {
  const f = getFirm(firmId); if (!f) return;
  f.calendars = f.calendars || {}; f.calendars[provider] = account;
  audit(account ? 'Calendar connected' : 'Calendar disconnected', f.name + ': ' + (provider === 'google' ? 'Google' : 'Outlook') + (account ? ' (' + account + ')' : '')); save();
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
