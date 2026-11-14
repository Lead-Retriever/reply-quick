// ============================================================
// Admin dashboard: ReplyQuick owner. Full oversight of firms,
// receptionists, calls and accounts, plus the Onboarding tab.
// ============================================================
import * as S from '../store.js';
import { esc, shell, toast, openPanel, statusPill } from '../ui.js';
import { callsTable, callFilters, applyFilters, openCall, summarize } from './components.js';
import { dirRow, faqRow } from './firm.js';
import { buildScript, PLATFORMS, checklist } from '../swapscript.js';

const NAV = [
  { label: 'Operations' },
  { href: '#/admin/overview', text: 'Overview' },
  { href: '#/admin/calls', text: 'All calls' },
  { href: '#/admin/agents', text: 'Receptionists' },
  { href: '#/admin/firms', text: 'Law firms' },
  { label: 'Setup' },
  { href: '#/admin/onboarding', text: 'Onboarding' },
  { href: '#/admin/accounts', text: 'Accounts' },
  { href: '#/admin/activity', text: 'Activity log' },
];

const TIMEZONES = [['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii']];
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];

export function mount(root, args) {
  const page = args[0] || 'overview';
  const sub = args[1] || '';
  let draftId = sub; // becomes the real draft id once "new" is created

  function render() {
    const pages = { overview, calls, agents, firms, onboarding, accounts, activity };
    const p = (pages[page] || overview)();
    root.innerHTML = shell({ nav: NAV, active: '#/admin/' + page, title: p.title, subtitle: p.subtitle, body: p.body, actions: p.actions || '' });
    if (p.after) p.after();
  }

  // ---------- Overview ----------
  function overview() {
    const agents = S.getAgents();
    const online = agents.filter(a => a.status !== 'offline');
    const today = S.getCalls().filter(c => S.isToday(c.startedAt));
    const s = summarize(today);
    const week = summarize(S.getCalls().filter(c => c.startedAt > Date.now() - 7 * 86400000));
    const firms = S.getFirms();
    return {
      title: 'Overview', subtitle: 'Live view across every firm and receptionist.',
      actions: '<button class="btn sm" data-action="reset-demo">Reset demo data</button>',
      body: `
      <div class="grid grid-4">
        <div class="stat"><div class="stat-label">Receptionists online</div><div class="stat-value">${online.length} / ${agents.length}</div><div class="stat-sub">${agents.filter(a => a.status === 'available').length} available right now</div></div>
        <div class="stat"><div class="stat-label">Calls today</div><div class="stat-value">${s.total}</div><div class="stat-sub">${week.total} in the last 7 days</div></div>
        <div class="stat"><div class="stat-label">Answer rate today</div><div class="stat-value">${s.rate}%</div><div class="stat-sub">${s.abandoned} hung up before answer</div></div>
        <div class="stat"><div class="stat-label">Avg speed to answer</div><div class="stat-value">${S.fmtDur(s.asa)}</div><div class="stat-sub">Avg handle ${S.fmtDur(s.aht)}</div></div>
      </div>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>Receptionists</h3><a href="#/admin/agents">Manage</a></div>
          ${agents.map(a => { const n = today.filter(c => c.agent === a.name).length; return `<div class="list-item"><div><b>${esc(a.name)}</b><div class="small muted">${n} answered today</div></div>${statusPill(a.status)}</div>`; }).join('')}
        </div>
        <div class="card"><div class="card-head"><h3>Firms today</h3><a href="#/admin/firms">All firms</a></div>
          <table><thead><tr><th>Firm</th><th>Calls</th><th>Answered</th><th>New inquiries</th></tr></thead><tbody>
          ${firms.map(f => { const fs = summarize(today.filter(c => c.firmId === f.id)); return `<tr><td>${esc(f.name)}</td><td class="num">${fs.total}</td><td class="num">${fs.rate}%</td><td class="num">${fs.newInquiries}</td></tr>`; }).join('')}
          </tbody></table>
        </div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Latest calls</h3><a href="#/admin/calls">See all</a></div>${callsTable(S.getCalls(), { showFirm: true, limit: 8 })}</div>`,
    };
  }

  // ---------- Calls ----------
  function calls() {
    return {
      title: 'All calls', subtitle: 'Every call across every firm.',
      body: `<div class="card">${callFilters(S.getFirms())}<div id="tbl"></div></div>`,
      after: () => {
        const draw = () => { root.querySelector('#tbl').innerHTML = callsTable(applyFilters(S.getCalls(), root), { showFirm: true }); };
        root.querySelectorAll('#fSearch,#fFirm,#fOutcome,#fRange').forEach(el => el.addEventListener('input', draw));
        draw();
      },
    };
  }

  // ---------- Receptionists ----------
  function agents() {
    const today = S.getCalls().filter(c => S.isToday(c.startedAt));
    return {
      title: 'Receptionists', subtitle: 'Status, shift time and today\'s numbers. Add receptionists under Accounts.',
      body: `<div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Receptionist</th><th>Status</th><th>On shift</th><th>Answered today</th><th>Avg speed to answer</th><th>Avg handle</th><th>Firms</th><th></th></tr></thead>
        <tbody>${S.getAgents().map(a => {
          const mine = summarize(today.filter(c => c.agent === a.name));
          return `<tr><td><b>${esc(a.name)}</b><div class="small muted">${esc(a.email)}</div></td><td>${statusPill(a.status)}</td>
          <td class="num">${a.shiftStart ? S.fmtShift((Date.now() - a.shiftStart) / 1000) : '<span class="muted">Off</span>'}</td>
          <td class="num">${mine.answered}</td><td class="num">${S.fmtDur(mine.asa)}</td><td class="num">${S.fmtDur(mine.aht)}</td>
          <td>${a.firmIds.length} of ${S.getFirms().length}</td>
          <td><button class="btn sm" data-assign="${a.id}">Assign firms</button></td></tr>`;
        }).join('')}</tbody></table></div></div>`,
    };
  }

  function assignFirms(agentId) {
    const a = S.getAgent(agentId);
    const { el, close } = openPanel(`
      <div class="card-head"><h2>Firms for ${esc(a.name)}</h2><button class="btn sm" data-close>Close</button></div>
      <p class="muted">${esc(a.name.split(' ')[0])} only sees calls, scripts and records for the firms checked here.</p>
      ${S.getFirms().map(f => `<label class="check" style="margin:10px 0"><input type="checkbox" value="${f.id}" ${a.firmIds.includes(f.id) ? 'checked' : ''}/> ${esc(f.name)}</label>`).join('')}
      <button class="btn primary" id="saveAssign" style="margin-top:12px">Save</button>`, { center: true });
    el.querySelector('#saveAssign').addEventListener('click', () => {
      S.setAgentFirms(agentId, [...el.querySelectorAll('input:checked')].map(i => i.value)); close(); toast('Assignments saved');
    });
  }

  // ---------- Firms ----------
  function firms() {
    return {
      title: 'Law firms', subtitle: 'Click a firm for its numbers, settings and website script.',
      actions: '<a class="btn primary" href="#/admin/onboarding/new">Onboard a firm</a>',
      body: `<div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Firm</th><th>Practice</th><th>ReplyQuick number</th><th>Owner</th><th>Calls (7 days)</th><th>Answered</th><th>Status</th></tr></thead>
        <tbody>${S.getFirms().map(f => {
          const s = summarize(S.getCalls(f.id).filter(c => c.startedAt > Date.now() - 7 * 86400000));
          return `<tr class="clickable" data-firm="${f.id}"><td><b>${esc(f.name)}</b><div class="small muted">${esc(f.address)}</div></td><td>${esc(f.practice)}</td>
          <td class="num">${esc(S.fmtPhone(f.rqNumber))}</td><td>${esc(f.contactName || f.contactEmail)}</td><td class="num">${s.total}</td><td class="num">${s.rate}%</td>
          <td><span class="pill success">Live</span></td></tr>`;
        }).join('')}</tbody></table></div></div>`,
    };
  }

  function openFirm(id) {
    const f = S.getFirm(id);
    const script = buildScript({ firmName: f.name, originalNumbers: f.originalNumbers, rqNumber: f.rqNumber, catchAll: false });
    const { el } = openPanel(`
      <div class="card-head"><div><div class="small muted">${esc(f.practice)}</div><h2>${esc(f.name)}</h2></div><button class="btn sm" data-close>Close</button></div>
      <dl class="kv">
        <dt>ReplyQuick number</dt><dd class="num">${esc(S.fmtPhone(f.rqNumber))}</dd>
        <dt>Firm's own numbers</dt><dd>${f.originalNumbers.map(S.fmtPhone).map(esc).join('<br>')}</dd>
        <dt>Owner</dt><dd>${esc(f.contactName)}<br><span class="small muted">${esc(f.contactEmail)}</span></dd>
        <dt>Time zone</dt><dd>${esc(f.timezone)}</dd>
        <dt>Receptionists</dt><dd>${S.getAgents().filter(a => a.firmIds.includes(f.id)).map(a => esc(a.name)).join(', ') || 'None assigned'}</dd>
      </dl>
      <label class="check"><input type="checkbox" id="recToggle" ${f.recordingEnabled ? 'checked' : ''}/> Call recording (adds a disclosure line to the greeting)</label>
      <h3 style="margin-top:18px">Greeting</h3><p>"${esc(f.greeting)}"</p>
      <h3>Instructions</h3><p>${esc(f.instructions)}</p>
      <h3>Transfer directory</h3>${f.directory.map(c => `<div class="list-item"><div><b>${esc(c.name)}</b> · ${esc(c.role)}</div><span class="small">${esc(S.fmtPhone(c.phone))}${c.afterHours ? ' · after hours' : ''}</span></div>`).join('')}
      <h3 style="margin-top:18px">Website script</h3>
      <div class="btn-row" style="margin-bottom:8px"><button class="btn sm" id="copyScript">Copy script</button></div>
      <pre class="code">${esc(script)}</pre>`);
    el.querySelector('#copyScript').addEventListener('click', () => copy(script));
    el.querySelector('#recToggle').addEventListener('change', (e) => {
      S.updateFirm(f.id, { recordingEnabled: e.target.checked });
      toast('Recording ' + (e.target.checked ? 'on' : 'off') + ' for ' + f.name);
    });
  }

  // ---------- Accounts ----------
  function accounts() {
    const users = S.getUsers();
    const roleLabel = { admin: 'Admin', firm: 'Law firm', receptionist: 'Receptionist' };
    return {
      title: 'Accounts', subtitle: 'There is no public signup. Every login is created here.',
      actions: '<button class="btn primary" id="newUser">Create account</button>',
      body: `<div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Firm</th><th></th></tr></thead>
        <tbody>${users.map(u => `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td><span class="tag">${roleLabel[u.role]}</span></td>
          <td>${u.firmId ? esc(S.getFirm(u.firmId)?.name || '') : ''}</td>
          <td>${u.id === S.currentUser().id ? '<span class="small muted">You</span>' : `<button class="btn sm" data-del-user="${u.id}">Remove</button>`}</td></tr>`).join('')}</tbody></table></div></div>`,
      after: () => root.querySelector('#newUser').addEventListener('click', newUser),
    };
  }

  function newUser() {
    const { el, close } = openPanel(`
      <div class="card-head"><h2>Create account</h2><button class="btn sm" data-close>Close</button></div>
      <form id="uForm" class="stack">
        <label class="field"><span>Role</span><select name="role"><option value="receptionist">Receptionist</option><option value="firm">Law firm</option><option value="admin">Admin</option></select></label>
        <label class="field" id="firmPick" style="display:none"><span>Firm</span><select name="firmId">${S.getFirms().map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Full name</span><input type="text" name="name" required /></label>
        <label class="field"><span>Email</span><input type="email" name="email" required /></label>
        <label class="field"><span>Temporary password</span><input type="text" name="password" required value="${tempPassword()}" /></label>
        <div class="error hidden" id="uErr"></div>
        <button class="btn primary" type="submit">Create account</button>
      </form>`, { center: true });
    const form = el.querySelector('#uForm');
    form.role.addEventListener('change', () => { el.querySelector('#firmPick').style.display = form.role.value === 'firm' ? '' : 'none'; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = { role: form.role.value, name: form.name.value.trim(), email: form.email.value.trim(), password: form.password.value };
      if (u.role === 'firm') u.firmId = form.firmId.value;
      const err = S.addUser(u);
      if (err) { const x = el.querySelector('#uErr'); x.textContent = err; x.classList.remove('hidden'); return; }
      close(); toast('Account created for ' + u.email);
    });
  }

  // ---------- Activity ----------
  function activity() {
    const log = S.getAudit();
    return {
      title: 'Activity log', subtitle: 'Account changes, firm setting edits and activations.',
      body: `<div class="card">${log.length ? `<table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Detail</th></tr></thead><tbody>${log.map(a => `<tr><td class="num">${esc(S.fmtDay(a.at))} ${esc(S.fmtTime(a.at))}</td><td>${esc(a.by)}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nothing logged yet. Changes made in the dashboards show up here.</div>'}</div>`,
    };
  }

  // ---------- Onboarding ----------
  function onboarding() {
    if (draftId) return wizard(draftId);
    const drafts = S.getDrafts();
    return {
      title: 'Onboarding', subtitle: 'Walk a new firm through setup, generate their website script, and go live.',
      actions: '<a class="btn primary" href="#/admin/onboarding/new">Start onboarding</a>',
      body: `<div class="card"><div class="card-head"><h3>In progress</h3></div>
        ${drafts.length ? drafts.map(d => `<div class="list-item"><div><b>${esc(d.firm.name || 'Untitled firm')}</b><div class="small muted">Step ${d.step + 1} of ${STEPS.length} · started ${esc(S.fmtDay(d.createdAt))}</div></div>
          <div class="btn-row"><a class="btn sm primary" href="#/admin/onboarding/${d.id}">Continue</a><button class="btn sm" data-del-draft="${d.id}">Delete</button></div></div>`).join('') : '<div class="empty">No onboardings in progress.</div>'}
      </div>`,
    };
  }

  function newDraft() {
    return {
      id: S.uid('draft'), createdAt: Date.now(), step: 0,
      firm: { name: '', practice: '', address: '', timezone: 'America/New_York', contactName: '', contactEmail: '' },
      rqNumber: '', areaCode: '',
      greeting: 'Thank you for calling {firm}, this is {agent}. How can I help you today?',
      instructions: '', faqs: [{ q: 'Do you offer free consultations?', a: '' }], directory: [{ id: S.uid('c'), name: '', role: 'Attorney / Owner', phone: '', transfer: true, afterHours: true }],
      hours: { mon: { open: '09:00', close: '17:00' }, tue: { open: '09:00', close: '17:00' }, wed: { open: '09:00', close: '17:00' }, thu: { open: '09:00', close: '17:00' }, fri: { open: '09:00', close: '17:00' }, sat: null, sun: null },
      website: { platform: 'wordpress', numbers: '', catchAll: false },
      login: { email: '', password: tempPassword() },
    };
  }

  function wizard(id) {
    let d = id === 'new' ? null : S.getDrafts().find(x => x.id === id);
    if (!d) { d = newDraft(); S.saveDraft(d); draftId = d.id; history.replaceState(null, '', '#/admin/onboarding/' + d.id); }
    const step = d.step;
    const body = `
      <div class="steps">${STEPS.map((s, i) => `<button data-step="${i}" class="${i === step ? 'active' : i < step ? 'done' : ''}">${i + 1}. ${s}</button>`).join('')}</div>
      <div class="card" id="stepBody">${STEP_RENDER[step](d)}</div>
      <div class="btn-row" style="margin-top:16px;justify-content:space-between">
        <button class="btn" data-nav="-1" ${step === 0 ? 'disabled' : ''}>Back</button>
        ${step < STEPS.length - 1 ? '<button class="btn primary" data-nav="1">Save and continue</button>' : '<button class="btn primary lg" id="activate">Activate firm</button>'}
      </div>`;
    return {
      title: d.firm.name ? 'Onboarding: ' + d.firm.name : 'Onboard a new firm',
      subtitle: 'Progress saves automatically every time you change steps.',
      actions: '<a class="btn" href="#/admin/onboarding">All onboardings</a>',
      body,
      after: () => {
        const sb = root.querySelector('#stepBody');
        const go = (to) => { collect(d, sb); d.step = Math.max(0, Math.min(STEPS.length - 1, to)); S.saveDraft(d); render(); };
        root.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => go(step + Number(b.dataset.nav))));
        root.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => go(Number(b.dataset.step))));
        const add = (sel, html) => { const b = sb.querySelector(sel.btn); if (b) b.addEventListener('click', () => sb.querySelector(sel.list).insertAdjacentHTML('beforeend', html())); };
        add({ btn: '#addContact', list: '#dirRows' }, () => dirRow({ id: S.uid('c'), name: '', role: '', phone: '', transfer: true, afterHours: false }));
        add({ btn: '#addFaq', list: '#faqRows' }, () => faqRow({ q: '', a: '' }));
        // Website step: regenerate script live as answers change.
        if (sb.querySelector('#wPlatform')) {
          const refresh = () => { collect(d, sb); S.saveDraft(d); sb.querySelector('#scriptOut').innerHTML = scriptOutput(d); };
          sb.querySelectorAll('#wPlatform,#wNumbers,#wCatch').forEach(el => el.addEventListener('input', refresh));
          sb.addEventListener('click', (e) => { if (e.target.id === 'copyScript') copy(scriptFor(d)); });
        }
        const act = root.querySelector('#activate');
        if (act) act.addEventListener('click', () => activate(d, sb));
      },
    };
  }

  function activate(d, sb) {
    collect(d, sb);
    const problems = [];
    if (!d.firm.name) problems.push('Firm name (step 1)');
    if (!S.toE164(d.rqNumber)) problems.push('ReplyQuick number (step 2)');
    if (!d.greeting) problems.push('Greeting (step 3)');
    if (!d.login.email) problems.push('Owner login email (step 6)');
    if (problems.length) { alertBox('Missing before activation: ' + problems.join(', ') + '.'); return; }
    if (S.getUsers().some(u => u.email.toLowerCase() === d.login.email.toLowerCase())) { alertBox('An account with ' + d.login.email + ' already exists.'); return; }
    const firmId = S.uid('firm');
    S.addFirm({
      id: firmId, name: d.firm.name, practice: d.firm.practice || 'Law firm', timezone: d.firm.timezone,
      rqNumber: S.toE164(d.rqNumber), originalNumbers: parseNumbers(d.website.numbers),
      address: d.firm.address, contactName: d.firm.contactName, contactEmail: d.login.email,
      status: 'live', recordingEnabled: false, createdAt: Date.now(),
      greeting: d.greeting.replace(/\{firm\}/g, d.firm.name), instructions: d.instructions,
      hours: d.hours, faqs: d.faqs.filter(f => f.q), directory: d.directory.filter(c => c.name),
    });
    S.addUser({ role: 'firm', firmId, name: d.firm.contactName || d.firm.name, email: d.login.email, password: d.login.password });
    S.deleteDraft(d.id);
    toast(d.firm.name + ' is live');
    location.hash = '#/admin/firms';
  }

  function alertBox(msg) {
    const sb = root.querySelector('#stepBody');
    let e = sb.querySelector('.error'); if (!e) { e = document.createElement('div'); e.className = 'error'; sb.appendChild(e); }
    e.textContent = msg;
  }

  // ---------- Events ----------
  function onClick(e) {
    const row = e.target.closest('[data-call]'); if (row) return openCall(row.dataset.call);
    const fr = e.target.closest('[data-firm]'); if (fr) return openFirm(fr.dataset.firm);
    const as = e.target.closest('[data-assign]'); if (as) return assignFirms(as.dataset.assign);
    const du = e.target.closest('[data-del-user]'); if (du) { if (confirm('Remove this account?')) S.removeUser(du.dataset.delUser); return; }
    const dd = e.target.closest('[data-del-draft]'); if (dd) { if (confirm('Delete this onboarding?')) S.deleteDraft(dd.dataset.delDraft); return; }
    const rm = e.target.closest('[data-remove-row]'); if (rm) rm.closest('.repeat-row').remove();
  }
  root.addEventListener('click', onClick);
  const live = ['overview', 'agents', 'firms', 'accounts', 'activity'].includes(page) || (page === 'onboarding' && !sub);
  const unsub = S.subscribe(() => { if (live) render(); });
  const clock = setInterval(() => { if (page === 'overview' || page === 'agents') render(); }, 15000);
  render();
  return () => { unsub(); clearInterval(clock); root.removeEventListener('click', onClick); };
}

// ============================================================
// Onboarding steps
// ============================================================
const STEPS = ['Firm details', 'Phone number', 'Call handling', 'Office hours', 'Website script', 'Login and go live'];

const STEP_RENDER = [
  // 1. Firm details
  (d) => `<h2>Firm details</h2><p class="muted">Basic information about the law firm.</p>
    <div class="form-grid">
      <label class="field"><span>Firm name</span><input type="text" data-d="firm.name" value="${esc(d.firm.name)}" placeholder="Smith & Jones Law" /></label>
      <label class="field"><span>Practice area(s)</span><input type="text" data-d="firm.practice" value="${esc(d.firm.practice)}" placeholder="Personal injury, workers comp" /></label>
      <label class="field full"><span>Office address</span><input type="text" data-d="firm.address" value="${esc(d.firm.address)}" /></label>
      <label class="field"><span>Time zone</span><select data-d="firm.timezone">${TIMEZONES.map(([v, l]) => `<option value="${v}" ${d.firm.timezone === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Owner / main contact</span><input type="text" data-d="firm.contactName" value="${esc(d.firm.contactName)}" /></label>
    </div>`,

  // 2. Phone number
  (d) => `<h2>ReplyQuick phone number</h2>
    <p class="muted">This is the number callers dial. Every call to it rings the receptionist desk with this firm's greeting and info.</p>
    <div class="form-grid">
      <label class="field"><span>Preferred area code</span><input type="text" data-d="areaCode" value="${esc(d.areaCode)}" placeholder="305" maxlength="3" /></label>
      <label class="field"><span>ReplyQuick number for this firm</span><input type="tel" data-d="rqNumber" value="${esc(d.rqNumber)}" placeholder="(305) 555-0142" /></label>
    </div>
    <p class="small muted">Prototype: type the number in. In the live version this step searches Twilio for available numbers in the area code and buys the one you pick.</p>`,

  // 3. Call handling
  (d) => `<h2>Call handling</h2><p class="muted">What the receptionist sees on every call for this firm.</p>
    <label class="field"><span>Greeting ({firm} = firm name, {agent} = receptionist's first name)</span><input type="text" data-d="greeting" value="${esc(d.greeting)}" /></label>
    <label class="field" style="margin-top:14px"><span>Instructions: what to ask new callers, how to handle existing clients, what is urgent</span><textarea data-d="instructions" style="min-height:120px">${esc(d.instructions)}</textarea></label>
    <div class="card-head" style="margin-top:20px"><h3>Transfer directory</h3><button class="btn sm" id="addContact" type="button">Add person</button></div>
    <div id="dirRows">${d.directory.map(dirRow).join('')}</div>
    <div class="card-head" style="margin-top:20px"><h3>FAQs</h3><button class="btn sm" id="addFaq" type="button">Add FAQ</button></div>
    <div id="faqRows">${d.faqs.map(faqRow).join('')}</div>`,

  // 4. Office hours
  (d) => `<h2>Office hours</h2><p class="muted">ReplyQuick answers 24/7 regardless. Office hours only decide who can receive transfers (outside hours, only contacts marked "After hours").</p>
    <table>${DAYS.map(([k, n]) => `<tr><td style="width:130px">${n}</td>
      <td style="width:110px"><label class="check"><input type="checkbox" data-open-day="${k}" ${d.hours[k] ? 'checked' : ''}/> Open</label></td>
      <td><input type="time" data-h-open="${k}" value="${d.hours[k] ? d.hours[k].open : '09:00'}" style="max-width:140px" /> to <input type="time" data-h-close="${k}" value="${d.hours[k] ? d.hours[k].close : '17:00'}" style="max-width:140px" /></td></tr>`).join('')}</table>`,

  // 5. Website script
  (d) => `<h2>Website script</h2><p class="muted">Answer these and the script below updates. Send it to whoever runs the firm's website.</p>
    <div class="form-grid">
      <label class="field"><span>What is their website built on?</span><select id="wPlatform" data-d="website.platform">${Object.entries(PLATFORMS).map(([k, p]) => `<option value="${k}" ${d.website.platform === k ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></label>
      <label class="field"><span>Which phone numbers are on their website now? (one per line)</span><textarea id="wNumbers" data-d="website.numbers" style="min-height:70px" placeholder="(305) 555-1200">${esc(d.website.numbers)}</textarea></label>
      <label class="check full"><input type="checkbox" id="wCatch" data-d="website.catchAll" ${d.website.catchAll ? 'checked' : ''}/> Replace every phone number on the site, not just the ones listed (only if the site shows no other numbers that should stay, like a fax line)</label>
    </div>
    <div id="scriptOut" style="margin-top:18px">${scriptOutput(d)}</div>`,

  // 6. Login and go live
  (d) => `<h2>Login and go live</h2><p class="muted">Creates the firm owner's dashboard login. Send them these credentials after activation.</p>
    <div class="form-grid">
      <label class="field"><span>Owner login email</span><input type="email" data-d="login.email" value="${esc(d.login.email)}" /></label>
      <label class="field"><span>Temporary password</span><input type="text" data-d="login.password" value="${esc(d.login.password)}" /></label>
    </div>
    <h3 style="margin-top:20px">Review</h3>
    <dl class="kv">
      <dt>Firm</dt><dd>${esc(d.firm.name || 'Missing')}</dd>
      <dt>Practice</dt><dd>${esc(d.firm.practice)}</dd>
      <dt>ReplyQuick number</dt><dd>${esc(S.fmtPhone(S.toE164(d.rqNumber) || '') || 'Missing')}</dd>
      <dt>Greeting</dt><dd>"${esc(d.greeting.replace(/\{firm\}/g, d.firm.name || '[firm]'))}"</dd>
      <dt>Transfer contacts</dt><dd>${d.directory.filter(c => c.name).length}</dd>
      <dt>Website platform</dt><dd>${esc(PLATFORMS[d.website.platform].label)}</dd>
    </dl>
    <h3>Before you activate</h3>
    <ul class="checklist">
      <li>Call the ReplyQuick number yourself and confirm it rings the receptionist desk as this firm.</li>
      <li>Have a receptionist do a test transfer to one contact in the directory.</li>
      <li>Confirm the test call shows up on the firm's dashboard.</li>
    </ul>`,
];

// Pull form values out of the current step into the draft object.
function collect(d, sb) {
  sb.querySelectorAll('[data-d]').forEach(el => {
    const path = el.dataset.d.split('.');
    let o = d; for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = el.type === 'checkbox' ? el.checked : el.value;
  });
  if (sb.querySelector('#dirRows')) {
    d.directory = [...sb.querySelectorAll('#dirRows .repeat-row')].map(r => ({
      id: r.dataset.id, name: r.querySelector('[data-k=name]').value.trim(), role: r.querySelector('[data-k=role]').value.trim(),
      phone: S.toE164(r.querySelector('[data-k=phone]').value) || r.querySelector('[data-k=phone]').value.trim(),
      transfer: true, afterHours: r.querySelector('[data-k=after]').checked,
    }));
    d.faqs = [...sb.querySelectorAll('#faqRows .repeat-row')].map(r => ({ q: r.querySelector('[data-k=q]').value, a: r.querySelector('[data-k=a]').value }));
  }
  if (sb.querySelector('[data-open-day]')) {
    DAYS.forEach(([k]) => {
      d.hours[k] = sb.querySelector(`[data-open-day="${k}"]`).checked ? { open: sb.querySelector(`[data-h-open="${k}"]`).value, close: sb.querySelector(`[data-h-close="${k}"]`).value } : null;
    });
  }
}

function parseNumbers(text) { return String(text || '').split(/[\n,]+/).map(S.toE164).filter(Boolean); }

function scriptFor(d) {
  return buildScript({ firmName: d.firm.name || 'Firm', originalNumbers: parseNumbers(d.website.numbers), rqNumber: S.toE164(d.rqNumber) || '+10000000000', catchAll: d.website.catchAll });
}

function scriptOutput(d) {
  const rq = S.toE164(d.rqNumber);
  const nums = parseNumbers(d.website.numbers);
  if (!rq) return '<div class="transfer-state failed">Add the ReplyQuick number in step 2 first.</div>';
  if (!nums.length && !d.website.catchAll) return '<div class="transfer-state ringing">List at least one number from their website, or check "Replace every phone number".</div>';
  const p = PLATFORMS[d.website.platform];
  const showScript = d.website.platform !== 'godaddy';
  return `
    ${showScript ? `<div class="card-head"><h3>Script</h3><button class="btn sm" id="copyScript" type="button">Copy script</button></div><pre class="code">${esc(scriptFor(d))}</pre>` : ''}
    <h3 style="margin-top:16px">Install on ${esc(p.label)}</h3>
    <ol class="checklist">${p.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <h3>Cover calls that don't come from the website</h3>
    <ol class="checklist">${checklist(d.firm.name || 'the firm', rq, nums).map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
}

function tempPassword() { return 'rq-' + Math.random().toString(36).slice(2, 8); }

function copy(text) {
  const done = () => toast('Script copied');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
  else fallback();
  function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ } t.remove(); }
}
