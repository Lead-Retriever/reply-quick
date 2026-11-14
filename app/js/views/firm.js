// ============================================================
// Firm dashboard: what the law firm sees. Intentionally simple.
// A firm account only ever sees its own firm's data.
// ============================================================
import * as S from '../store.js';
import { esc, shell, toast } from '../ui.js';
import { callsTable, callFilters, applyFilters, openCall, summarize } from './components.js';

const NAV = [
  { href: '#/firm/overview', text: 'Overview' },
  { href: '#/firm/calls', text: 'Calls' },
  { href: '#/firm/callbacks', text: 'Callbacks' },
  { href: '#/firm/settings', text: 'Settings' },
];

export function mount(root, args) {
  const user = S.currentUser();
  const page = args[0] || 'overview';
  const firmId = user.firmId;

  function render() {
    const firm = S.getFirm(firmId);
    if (!firm) { root.innerHTML = '<div class="main"><div class="card">This login is not linked to a firm. Contact ReplyQuick support.</div></div>'; return; }
    const pages = { overview, calls, callbacks, settings };
    const p = (pages[page] || overview)(firm);
    root.innerHTML = shell({ nav: NAV, active: '#/firm/' + page, title: p.title, subtitle: p.subtitle, body: p.body, actions: p.actions || '' });
    if (p.after) p.after();
  }

  // ---------- Overview ----------
  function overview(firm) {
    const calls = S.getCalls(firmId);
    const today = calls.filter(c => S.isToday(c.startedAt));
    const week = calls.filter(c => c.startedAt > Date.now() - 7 * 86400000);
    const s = summarize(week);
    const tasks = S.getTasks(firmId).filter(t => !t.done);
    return {
      title: firm.name, subtitle: 'Every call to ' + S.fmtPhone(firm.rqNumber) + ' is answered by a live ReplyQuick receptionist, 24/7.',
      body: `
      <div class="grid grid-4">
        <div class="stat"><div class="stat-label">Calls today</div><div class="stat-value">${today.length}</div><div class="stat-sub">${s.total} in the last 7 days</div></div>
        <div class="stat"><div class="stat-label">Answered (7 days)</div><div class="stat-value">${s.rate}%</div><div class="stat-sub">${s.answered} answered · ${s.abandoned} hung up before answer</div></div>
        <div class="stat"><div class="stat-label">New inquiries (7 days)</div><div class="stat-value">${s.newInquiries}</div><div class="stat-sub">${s.intakes} with intake complete</div></div>
        <div class="stat"><div class="stat-label">Callbacks open</div><div class="stat-value">${tasks.length}</div><div class="stat-sub"><a href="#/firm/callbacks">View callbacks</a></div></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Callbacks due</h3><a href="#/firm/callbacks">All callbacks</a></div>
          ${tasks.length ? tasks.slice(0, 6).map(t => `<div class="list-item"><div><b>${esc(t.title)}</b><div class="small muted">${esc(t.detail || '')}</div><div class="small muted">Due ${esc(S.fmtDay(t.due))}</div></div><button class="btn sm" data-task="${t.id}">Done</button></div>`).join('') : '<div class="empty">You\'re all caught up.</div>'}
      </div>
      <div class="card"><div class="card-head"><h3>Latest calls</h3><a href="#/firm/calls">See all</a></div>${callsTable(calls, { limit: 8 })}</div>
      <p class="small muted" style="margin-top:16px">"Hung up before answer" means the caller ended the call while it was ringing, before a receptionist could pick up.</p>`,
    };
  }

  // ---------- Calls ----------
  function calls() {
    return {
      title: 'Calls', subtitle: 'Click any call for full details and notes.',
      body: `<div class="card">${callFilters(null)}<div id="tbl"></div></div>`,
      after: () => {
        const draw = () => { root.querySelector('#tbl').innerHTML = callsTable(applyFilters(S.getCalls(firmId), root)); };
        root.querySelectorAll('#fSearch,#fOutcome,#fRange').forEach(el => el.addEventListener('input', draw));
        draw();
      },
    };
  }

  // ---------- Callbacks ----------
  function callbacks() {
    const all = S.getTasks(firmId).slice().sort((a, b) => a.done - b.done || a.due - b.due);
    return {
      title: 'Callbacks', subtitle: 'Callers who asked to hear back from your office.',
      body: `<div class="card">${all.length ? all.map(t => `
        <div class="list-item"><div><b style="${t.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(t.title)}</b><div class="small muted">${esc(t.detail || '')}</div><div class="small muted">Due ${esc(S.fmtDay(t.due))} ${esc(S.fmtTime(t.due))} · <a href="#" data-open="${esc(t.callId)}">View call</a></div></div>
        <button class="btn sm ${t.done ? '' : 'primary'}" data-task="${t.id}">${t.done ? 'Reopen' : 'Mark done'}</button></div>`).join('') : '<div class="empty">No callbacks yet.</div>'}</div>`,
    };
  }

  // ---------- Settings ----------
  function settings(firm) {
    const days = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
    return {
      title: 'Settings', subtitle: 'Changes go live for the receptionists immediately.',
      actions: '<button class="btn primary" id="saveSettings">Save changes</button>',
      body: `
      <div class="card"><div class="card-head"><h3>Greeting</h3></div>
        <label class="field"><span>What the receptionist says when answering. {agent} becomes their first name.</span><input type="text" id="sGreeting" value="${esc(firm.greeting)}" /></label>
      </div>
      <div class="card"><div class="card-head"><h3>Instructions for receptionists</h3></div>
        <label class="field"><span>What to ask new callers, how to handle existing clients, anything urgent.</span><textarea id="sInstr" style="min-height:120px">${esc(firm.instructions)}</textarea></label>
      </div>
      <div class="card"><div class="card-head"><h3>Office hours</h3><span class="small muted">Time zone: ${esc(firm.timezone)}</span></div>
        <p class="small muted" style="margin-top:0">We answer 24/7 no matter what. Office hours decide who can receive transferred calls.</p>
        <table>${days.map(([k, n]) => `<tr><td style="width:130px">${n}</td>
          <td style="width:110px"><label class="check"><input type="checkbox" data-open-day="${k}" ${firm.hours[k] ? 'checked' : ''}/> Open</label></td>
          <td><input type="time" data-h-open="${k}" value="${firm.hours[k] ? firm.hours[k].open : '09:00'}" style="max-width:140px" /> to <input type="time" data-h-close="${k}" value="${firm.hours[k] ? firm.hours[k].close : '17:00'}" style="max-width:140px" /></td></tr>`).join('')}</table>
      </div>
      <div class="card"><div class="card-head"><h3>Transfer directory</h3><button class="btn sm" id="addContact">Add person</button></div>
        <div id="dirRows">${firm.directory.map(dirRow).join('')}</div>
      </div>
      <div class="card"><div class="card-head"><h3>FAQs</h3><button class="btn sm" id="addFaq">Add FAQ</button></div>
        <div id="faqRows">${firm.faqs.map(faqRow).join('')}</div>
      </div>
      <div class="card"><div class="card-head"><h3>Your ReplyQuick number</h3></div>
        <p style="margin:0"><b class="num">${esc(S.fmtPhone(firm.rqNumber))}</b></p>
        <p class="small muted">Call recording: ${firm.recordingEnabled ? 'on' : 'off'}. Contact ReplyQuick to change this.</p>
      </div>`,
      after: () => {
        root.querySelector('#addContact').addEventListener('click', () => root.querySelector('#dirRows').insertAdjacentHTML('beforeend', dirRow({ id: S.uid('c'), name: '', role: '', phone: '', transfer: true, afterHours: false })));
        root.querySelector('#addFaq').addEventListener('click', () => root.querySelector('#faqRows').insertAdjacentHTML('beforeend', faqRow({ q: '', a: '' })));
        root.querySelector('#saveSettings').addEventListener('click', () => {
          const hours = {};
          days.forEach(([k]) => {
            hours[k] = root.querySelector(`[data-open-day="${k}"]`).checked ? { open: root.querySelector(`[data-h-open="${k}"]`).value, close: root.querySelector(`[data-h-close="${k}"]`).value } : null;
          });
          const directory = [...root.querySelectorAll('#dirRows .repeat-row')].map(r => ({
            id: r.dataset.id, name: r.querySelector('[data-k=name]').value.trim(), role: r.querySelector('[data-k=role]').value.trim(),
            phone: S.toE164(r.querySelector('[data-k=phone]').value) || r.querySelector('[data-k=phone]').value.trim(),
            transfer: true, afterHours: r.querySelector('[data-k=after]').checked,
          })).filter(c => c.name);
          const faqs = [...root.querySelectorAll('#faqRows .repeat-row')].map(r => ({ q: r.querySelector('[data-k=q]').value.trim(), a: r.querySelector('[data-k=a]').value.trim() })).filter(f => f.q);
          S.updateFirm(firmId, { greeting: root.querySelector('#sGreeting').value, instructions: root.querySelector('#sInstr').value, hours, directory, faqs });
          toast('Settings saved');
        });
      },
    };
  }

  // ---------- Events ----------
  function onClick(e) {
    const row = e.target.closest('[data-call]'); if (row) return openCall(row.dataset.call);
    const op = e.target.closest('[data-open]'); if (op) { e.preventDefault(); return openCall(op.dataset.open); }
    const t = e.target.closest('[data-task]'); if (t) { S.toggleTask(t.dataset.task); return; }
    const rm = e.target.closest('[data-remove-row]'); if (rm) rm.closest('.repeat-row').remove();
  }
  root.addEventListener('click', onClick);
  // Live refresh when new calls come in, except while editing settings.
  const unsub = S.subscribe(() => { if (page !== 'settings' && page !== 'calls') render(); });
  render();
  return () => { unsub(); root.removeEventListener('click', onClick); };
}

export function dirRow(c) {
  return `<div class="repeat-row" data-id="${esc(c.id)}">
    <input type="text" data-k="name" placeholder="Name" value="${esc(c.name)}" />
    <input type="text" data-k="role" placeholder="Role" value="${esc(c.role)}" />
    <input type="tel" data-k="phone" placeholder="Phone" value="${esc(S.fmtPhone(c.phone))}" />
    <label class="check small"><input type="checkbox" data-k="after" ${c.afterHours ? 'checked' : ''}/> After hours</label>
    <button class="btn sm" data-remove-row type="button">Remove</button>
  </div>`;
}
export function faqRow(f) {
  return `<div class="repeat-row two">
    <input type="text" data-k="q" placeholder="Question" value="${esc(f.q)}" />
    <input type="text" data-k="a" placeholder="Answer" value="${esc(f.a)}" />
    <button class="btn sm" data-remove-row type="button">Remove</button>
  </div>`;
}
