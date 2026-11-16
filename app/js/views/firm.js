// ============================================================
// Firm (law firm owner) dashboard. Kept deliberately simple:
// Overview (pipeline + value), Calls, Calendar. No settings:
// ReplyQuick handles all setup ("done for you").
// ============================================================
import * as S from '../store.js';
import { esc, shell, toast } from '../ui.js';
import { callsTable, callFilters, applyFilters, openCall, summarize } from './components.js';

const NAV = [
  { href: '#/firm/overview', text: 'Overview' },
  { href: '#/firm/calls', text: 'Calls' },
  { href: '#/firm/calendar', text: 'Calendar' },
];

export function mount(root, args) {
  const user = S.currentUser();
  const page = args[0] || 'overview';
  const firmId = user.firmId;
  let range = '30';
  let calMonth = new Date(); calMonth.setDate(1); calMonth.setHours(0, 0, 0, 0);
  let unsubTable = null;

  function render() {
    const firm = S.getFirm(firmId);
    if (!firm) { root.innerHTML = '<div class="main"><div class="card">This login is not linked to a firm. Contact ReplyQuick support.</div></div>'; return; }
    const pages = { overview, calls, calendar };
    const p = (pages[page] || overview)(firm);
    root.innerHTML = shell({ nav: NAV, active: '#/firm/' + (pages[page] ? page : 'overview'), title: p.title, subtitle: p.subtitle, body: p.body, actions: p.actions || '' });
    if (p.after) p.after();
  }

  // ---------- Overview: pipeline + what they'd have without us ----------
  function overview(firm) {
    const all = S.getCalls(firmId);
    const days = Number(range);
    const calls = days ? all.filter(c => c.startedAt > Date.now() - days * 86400000) : all;
    const s = summarize(calls);
    const k = S.BASELINE_ANSWER_RATE;
    const w = { answered: Math.round(s.answered * k), leads: Math.round(s.newInquiries * k), consults: Math.round(s.consults * k), retained: Math.round(s.retained * k), revenue: s.revenue * k };
    const missed = { calls: s.answered - w.answered, retained: s.retained - w.retained, revenue: s.revenue - w.revenue };
    const afterHours = calls.filter(c => !S.officeOpenAt(firm, c.startedAt)).length;
    const booked = calls.filter(c => c.outcome === 'Consultation booked').length;
    const pct = (a, b) => b ? Math.round((a / b) * 100) + '%' : '0%';
    const stages = [
      { label: 'Calls answered', value: s.answered, sub: 'Every call picked up live', without: w.answered },
      { label: 'New leads', value: s.newInquiries, sub: pct(s.newInquiries, s.answered) + ' of calls', without: w.leads },
      { label: 'Consultations', value: s.consults, sub: pct(s.consults, s.newInquiries) + ' of leads', without: w.consults },
      { label: 'Retained clients', value: s.retained, sub: pct(s.retained, s.consults) + ' of consultations', without: w.retained },
      { label: 'Revenue', value: S.fmtMoney(s.revenue), sub: s.retained ? S.fmtMoney(s.revenue / s.retained) + ' per client' : '', without: S.fmtMoney(w.revenue), money: true },
    ];
    const rangeLabel = { '7': 'the last 7 days', '30': 'the last 30 days', '0': 'all time' }[range];
    return {
      title: firm.name, subtitle: 'Every call to ' + S.fmtPhone(firm.rqNumber) + ' is answered live, 24/7.',
      actions: `<div class="seg">${[['7', '7 days'], ['30', '30 days'], ['0', 'All time']].map(([v, l]) => `<button data-range="${v}" class="${range === v ? 'active' : ''}">${l}</button>`).join('')}</div>`,
      body: `
      <div class="pipeline">
        ${stages.map((st, i) => `
          <div class="pipe-stage ${st.money ? 'money' : ''}">
            <div class="stat-label">${st.label}</div>
            <div class="pipe-value">${st.value}</div>
            <div class="stat-sub">${st.sub}</div>
            <div class="pipe-without">Without ReplyQuick: ${st.without}</div>
          </div>${i < stages.length - 1 ? '<div class="pipe-arrow" aria-hidden="true">&rsaquo;</div>' : ''}`).join('')}
      </div>
      <div class="loss-banner">
        <div><div class="small" style="font-weight:600">What you would have missed in ${rangeLabel} without ReplyQuick</div>
          <p>About <b>${missed.calls} calls</b>, <b>${missed.retained} retained clients</b> and <b>${S.fmtMoney(missed.revenue)}</b> in fees.</p></div>
        <div class="big">${S.fmtMoney(missed.revenue)}</div>
      </div>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="stat"><div class="stat-label">Answered after office hours</div><div class="stat-value">${afterHours}</div><div class="stat-sub">Calls that would have gone to voicemail</div></div>
        <div class="stat"><div class="stat-label">Consultations booked by us</div><div class="stat-value">${booked}</div><div class="stat-sub">Booked on the call and added to your <a href="#/firm/calendar">calendar</a></div></div>
      </div>
      <p class="small muted" style="margin-top:16px">"Without ReplyQuick" is an estimate that assumes your office would answer about ${Math.round(k * 100)}% of these calls on its own. Mark leads as Consultation, Retained or Not a fit in <a href="#/firm/calls">Calls</a> to keep your pipeline current.</p>`,
    };
  }

  // ---------- Calls ----------
  function calls() {
    return {
      title: 'Calls', subtitle: 'Every call we answered for you. Press play to hear it, or click a call for details and to update the lead.',
      body: `<div class="card">${callFilters(null, { stages: true })}<div id="tbl"></div></div>`,
      after: () => {
        const draw = () => { const t = root.querySelector('#tbl'); if (t) t.innerHTML = callsTable(applyFilters(S.getCalls(firmId), root), { showStage: true }); };
        root.querySelectorAll('#fSearch,#fOutcome,#fStage,#fRange').forEach(el => el.addEventListener('input', draw));
        draw();
        if (unsubTable) unsubTable();
        unsubTable = S.subscribe(draw);
      },
    };
  }

  // ---------- Calendar ----------
  function calendar(firm) {
    const cal = firm.calendars || {};
    const consults = S.getCalls(firmId).filter(c => c.consultAt).sort((a, b) => a.consultAt - b.consultAt);
    const upcoming = consults.filter(c => c.consultAt >= Date.now()).slice(0, 8);
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1); const start = new Date(first); start.setDate(1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d); }
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const today = new Date();
    const connectRow = (key, name, color, letter) => `
      <div class="cal-connect">
        <div style="display:flex;gap:12px;align-items:center"><div class="cal-logo" style="background:${color}">${letter}</div>
          <div><b>${name}</b><div class="small muted">${cal[key] ? 'Connected as ' + esc(cal[key]) : 'Not connected'}</div></div></div>
        ${cal[key] ? `<button class="btn sm" data-cal-off="${key}">Disconnect</button>` : `<button class="btn primary sm" data-cal-on="${key}">Connect</button>`}
      </div>`;
    return {
      title: 'Calendar', subtitle: 'Consultations your receptionist books land here and on your connected calendar.',
      body: `
      <div class="grid grid-21">
        <div class="card">
          <div class="card-head"><h3>${calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
            <div class="btn-row"><button class="btn sm" data-month="-1">Previous</button><button class="btn sm" data-month="0">Today</button><button class="btn sm" data-month="1">Next</button></div></div>
          <div class="cal-grid">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
            ${cells.map(d => {
              const evs = consults.filter(c => sameDay(new Date(c.consultAt), d));
              return `<div class="cal-day ${d.getMonth() !== m ? 'other' : ''} ${sameDay(d, today) ? 'today' : ''}"><div class="cal-num">${d.getDate()}</div>
                ${evs.slice(0, 3).map(c => `<button class="cal-ev" data-call="${esc(c.id)}">${esc(S.fmtTime(c.consultAt))} ${esc(c.callerName)}</button>`).join('')}
                ${evs.length > 3 ? `<div class="small muted">+${evs.length - 3} more</div>` : ''}</div>`;
            }).join('')}
          </div>
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h3>Connected calendars</h3></div>
            ${connectRow('google', 'Google Calendar', '#1a73e8', 'G')}
            ${connectRow('outlook', 'Outlook Calendar', '#0a64ad', 'O')}
            <p class="small muted" style="margin-bottom:0">Once connected, every consultation we book is added to your calendar automatically, with the caller's name, number and notes.</p>
          </div>
          <div class="card"><div class="card-head"><h3>Upcoming consultations</h3></div>
            ${upcoming.length ? upcoming.map(c => `<div class="list-item clickable" data-call="${esc(c.id)}" style="cursor:pointer"><div><b>${esc(c.callerName)}</b><div class="small muted">${esc(c.reason)}</div></div><div class="small num" style="text-align:right;white-space:nowrap">${esc(S.fmtDay(c.consultAt))}<br>${esc(S.fmtTime(c.consultAt))}</div></div>`).join('') : '<div class="empty">No upcoming consultations.</div>'}
          </div>
        </div>
      </div>`,
    };
  }

  // ---------- Events ----------
  function onClick(e) {
    const row = e.target.closest('[data-call]'); if (row) return openCall(row.dataset.call, { editable: true });
    const rg = e.target.closest('[data-range]'); if (rg) { range = rg.dataset.range; render(); return; }
    const mo = e.target.closest('[data-month]');
    if (mo) { const n = Number(mo.dataset.month); if (n === 0) { calMonth = new Date(); calMonth.setDate(1); } else calMonth.setMonth(calMonth.getMonth() + n); calMonth.setHours(0, 0, 0, 0); render(); return; }
    const on = e.target.closest('[data-cal-on]');
    if (on) {
      // Prototype: pretend the sign-in succeeded. Live version opens Google / Microsoft sign-in.
      const firm = S.getFirm(firmId);
      S.setCalendar(firmId, on.dataset.calOn, firm.contactEmail);
      toast((on.dataset.calOn === 'google' ? 'Google' : 'Outlook') + ' Calendar connected');
      return;
    }
    const off = e.target.closest('[data-cal-off]'); if (off) { S.setCalendar(firmId, off.dataset.calOff, null); return; }
  }
  root.addEventListener('click', onClick);
  const unsub = S.subscribe(() => { if (page === 'overview' || page === 'calendar') render(); });
  render();
  return () => { unsub(); if (unsubTable) unsubTable(); root.removeEventListener('click', onClick); };
}
