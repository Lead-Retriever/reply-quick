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
  { href: '#/firm/settings', text: 'Settings' },
];

export function mount(root, args) {
  const user = S.currentUser();
  const page = args[0] || 'overview';
  const firmId = user.firmId;

  function render() {
    const firm = S.getFirm(firmId);
    if (!firm) { root.innerHTML = '<div class="main"><div class="card">This login is not linked to a firm. Contact ReplyQuick support.</div></div>'; return; }
    const pages = { overview, calls, settings };
    const p = (pages[page] || overview)(firm);
    root.innerHTML = shell({ nav: NAV, active: '#/firm/' + page, title: p.title, subtitle: p.subtitle, body: p.body, actions: p.actions || '' });
    if (p.after) p.after();
  }

  // ---------- Overview: the pipeline ----------
  let range = '30';
  function overview(firm) {
    const all = S.getCalls(firmId);
    const days = Number(range);
    const calls = days ? all.filter(c => c.startedAt > Date.now() - days * 86400000) : all;
    const s = summarize(calls);
    const afterHours = calls.filter(c => !S.officeOpenAt(firm, c.startedAt)).length;
    const pct = (a, b) => b ? Math.round((a / b) * 100) + '%' : '0%';
    const stages = [
      { label: 'Calls answered', value: s.answered, sub: '100% picked up by a live receptionist' },
      { label: 'New leads', value: s.newInquiries, conv: pct(s.newInquiries, s.answered) + ' of calls' },
      { label: 'Consultations', value: s.consults, conv: pct(s.consults, s.newInquiries) + ' of leads' },
      { label: 'Retained clients', value: s.retained, conv: pct(s.retained, s.consults) + ' of consultations' },
      { label: 'Revenue', value: S.fmtMoney(s.revenue), conv: s.retained ? S.fmtMoney(s.revenue / s.retained) + ' per client' : '', money: true },
    ];
    return {
      title: firm.name, subtitle: 'Every call to ' + S.fmtPhone(firm.rqNumber) + ' is answered live, 24/7.',
      actions: `<div class="seg">${[['7', '7 days'], ['30', '30 days'], ['0', 'All time']].map(([v, l]) => `<button data-range="${v}" class="${range === v ? 'active' : ''}">${l}</button>`).join('')}</div>`,
      body: `
      <div class="pipeline">
        ${stages.map((st, i) => `
          <div class="pipe-stage ${st.money ? 'money' : ''}">
            <div class="stat-label">${st.label}</div>
            <div class="pipe-value">${st.value}</div>
            <div class="stat-sub">${st.sub || st.conv || ''}</div>
          </div>${i < stages.length - 1 ? '<div class="pipe-arrow" aria-hidden="true">&rsaquo;</div>' : ''}`).join('')}
      </div>
      <div class="grid grid-3" style="margin-top:16px">
        <div class="stat"><div class="stat-label">Answered after office hours</div><div class="stat-value">${afterHours}</div><div class="stat-sub">Calls that would have gone to voicemail</div></div>
        <div class="stat"><div class="stat-label">Average time to answer</div><div class="stat-value">${S.fmtDur(s.asa)}</div><div class="stat-sub">From first ring to a live person</div></div>
        <div class="stat"><div class="stat-label">Consultations booked by us</div><div class="stat-value">${calls.filter(c => c.outcome === 'Consultation booked').length}</div><div class="stat-sub">Booked by your receptionist on the call</div></div>
      </div>
      <p class="small muted" style="margin-top:16px">Mark leads as Consultation, Retained or Not a fit from the <a href="#/firm/calls">Calls</a> tab to keep this pipeline current.</p>`,
    };
  }

  // ---------- Calls ----------
  function calls() {
    return {
      title: 'Calls', subtitle: 'Every call we answered for you. Click a call for details, and to update the lead.',
      body: `<div class="card">${callFilters(null, { stages: true })}<div id="tbl"></div></div>`,
      after: () => {
        const draw = () => { root.querySelector('#tbl').innerHTML = callsTable(applyFilters(S.getCalls(firmId), root), { showStage: true }); };
        root.querySelectorAll('#fSearch,#fOutcome,#fStage,#fRange').forEach(el => el.addEventListener('input', draw));
        draw();
        unsubTable = S.subscribe(draw);
      },
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
    const row = e.target.closest('[data-call]'); if (row) return openCall(row.dataset.call, { editable: true });
    const rg = e.target.closest('[data-range]'); if (rg) { range = rg.dataset.range; render(); return; }
    const rm = e.target.closest('[data-remove-row]'); if (rm) rm.closest('.repeat-row').remove();
  }
  root.addEventListener('click', onClick);
  // Live refresh when new calls come in, except while editing settings.
  let unsubTable = null;
  const unsub = S.subscribe(() => { if (page === 'overview') render(); });
  render();
  return () => { unsub(); if (unsubTable) unsubTable(); root.removeEventListener('click', onClick); };
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
