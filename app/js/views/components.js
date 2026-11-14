// Pieces shared by the Firm and Admin dashboards.
import * as S from '../store.js';
import { esc, outcomePill, openPanel, toast } from '../ui.js';

// Lead pipeline stages a firm can set on a new inquiry.
export const STAGES = {
  inquiry: { label: 'New lead', pill: 'info' },
  consult: { label: 'Consultation', pill: 'warning' },
  retained: { label: 'Retained', pill: 'success' },
  not_fit: { label: 'Not a fit', pill: '' },
};
export const stagePill = (st) => st && STAGES[st] ? `<span class="pill ${STAGES[st].pill}">${STAGES[st].label}</span>` : '<span class="muted small">Not a lead</span>';

// Calls table. opts.showFirm adds the firm column (admin); opts.showStage adds the lead column (firm).
export function callsTable(calls, { showFirm = false, showStage = false, limit = 0 } = {}) {
  const rows = limit ? calls.slice(0, limit) : calls;
  if (!rows.length) return '<div class="empty">No calls match.</div>';
  return `<div class="table-wrap"><table>
    <thead><tr><th>When</th>${showFirm ? '<th>Firm</th>' : ''}<th>Caller</th><th>Reason</th><th>Answered by</th><th>Outcome</th>${showStage ? '<th>Lead</th>' : ''}</tr></thead>
    <tbody>${rows.map(c => `
      <tr class="clickable" data-call="${esc(c.id)}">
        <td class="num" style="white-space:nowrap">${esc(S.fmtDay(c.startedAt))}<div class="small muted">${esc(S.fmtTime(c.startedAt))}</div></td>
        ${showFirm ? `<td>${esc(S.getFirm(c.firmId)?.name || '')}</td>` : ''}
        <td><b>${esc(c.callerName || 'Unknown')}</b><div class="small muted">${esc(S.fmtPhone(c.callerPhone))}</div></td>
        <td style="max-width:300px">${esc(c.reason)}<div class="small muted">${esc(c.callerType || '')}</div></td>
        <td>${esc(c.agent || '')}<div class="small muted num">${c.durationSec ? S.fmtDur(c.durationSec) : ''}</div></td>
        <td>${outcomePill(c.outcome)}</td>
        ${showStage ? `<td>${stagePill(c.stage)}${c.stage === 'retained' && c.revenue ? `<div class="small num" style="margin-top:4px">${S.fmtMoney(c.revenue)}</div>` : ''}</td>` : ''}
      </tr>`).join('')}</tbody></table></div>`;
}

export function callFilters(firms, { stages = false } = {}) {
  return `<div class="btn-row" style="margin-bottom:14px">
    <input type="text" id="fSearch" placeholder="Search caller, phone or reason" style="max-width:280px" />
    ${firms ? `<select id="fFirm" style="max-width:220px"><option value="">All firms</option>${firms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select>` : ''}
    <select id="fOutcome" style="max-width:210px"><option value="">All outcomes</option>${['Consultation booked', 'Intake complete', 'Transferred', 'Message taken', 'Wrong number / spam'].map(o => `<option>${o}</option>`).join('')}</select>
    ${stages ? `<select id="fStage" style="max-width:180px"><option value="">All leads</option>${Object.entries(STAGES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>` : ''}
    <select id="fRange" style="max-width:160px"><option value="">All time</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
  </div>`;
}

export function applyFilters(calls, root) {
  const q = (root.querySelector('#fSearch')?.value || '').toLowerCase();
  const firm = root.querySelector('#fFirm')?.value || '';
  const out = root.querySelector('#fOutcome')?.value || '';
  const stage = root.querySelector('#fStage')?.value || '';
  const range = root.querySelector('#fRange')?.value || '';
  return calls.filter(c => {
    if (firm && c.firmId !== firm) return false;
    if (out && c.outcome !== out) return false;
    if (stage && c.stage !== stage) return false;
    if (range === 'today' && !S.isToday(c.startedAt)) return false;
    if (range && range !== 'today' && c.startedAt < Date.now() - Number(range) * 86400000) return false;
    if (q && !((c.callerName || '') + ' ' + c.callerPhone + ' ' + (c.reason || '') + ' ' + (c.notes || '')).toLowerCase().includes(q)) return false;
    return true;
  });
}

// Call details drawer. editable = firm can move the lead through the pipeline.
export function openCall(id, { editable = false } = {}) {
  const c = S.getCalls().find(x => x.id === id); if (!c) return;
  const firm = S.getFirm(c.firmId);
  const attempts = c.transferAttempts && c.transferAttempts.length ? c.transferAttempts : c.transfer ? [c.transfer] : [];
  const isLead = c.callerType === 'New inquiry';
  const { el, close } = openPanel(`
    <div class="card-head"><div><div class="small muted">${esc(firm?.name || '')}</div><h2>${esc(c.callerName || 'Unknown caller')}</h2></div><button class="btn sm" data-close>Close</button></div>
    ${outcomePill(c.outcome)}
    <dl class="kv">
      <dt>Phone</dt><dd>${esc(S.fmtPhone(c.callerPhone))}</dd>
      ${c.callbackNumber && c.callbackNumber !== S.fmtPhone(c.callerPhone) ? `<dt>Best number</dt><dd>${esc(c.callbackNumber)}</dd>` : ''}
      <dt>When</dt><dd>${esc(S.fmtDay(c.startedAt))} at ${esc(S.fmtTime(c.startedAt))}</dd>
      <dt>Caller type</dt><dd>${esc(c.callerType || '')}</dd>
      <dt>Reason</dt><dd>${esc(c.reason || '')}</dd>
      ${c.consultAt ? `<dt>Consultation</dt><dd>${esc(S.fmtDay(c.consultAt))} at ${esc(S.fmtTime(c.consultAt))}</dd>` : ''}
      <dt>Answered by</dt><dd>${esc(c.agent || '')} in <span class="num">${S.fmtDur(c.waitSec)}</span></dd>
      <dt>Call length</dt><dd class="num">${S.fmtDur(c.durationSec)}</dd>
    </dl>
    ${attempts.length ? `<h3>Transfers</h3>${attempts.map(t => `<div class="list-item"><div>${esc(t.type === 'warm' ? 'Warm' : 'Blind')} transfer to <b>${esc(t.to)}</b></div><span class="pill ${t.result === 'accepted' ? 'success' : 'danger'}">${t.result === 'accepted' ? 'Connected' : 'No answer'}</span></div>`).join('')}` : ''}
    <h3 style="margin-top:16px">Notes</h3>
    <p>${esc(c.notes || 'No notes.')}</p>
    ${isLead ? `
      <div class="card" style="margin-top:18px;background:var(--rq-surface-2)">
        <h3>Lead status</h3>
        ${editable ? `
          <div class="btn-row" style="margin:12px 0">${Object.entries(STAGES).map(([k, v]) => `<button class="btn sm ${c.stage === k ? 'primary' : ''}" data-stage="${k}">${v.label}</button>`).join('')}</div>
          <div id="feeRow" class="${c.stage === 'retained' ? '' : 'hidden'}">
            <label class="field"><span>Fee from this client</span><input type="text" id="feeIn" inputmode="numeric" value="${c.revenue ? c.revenue : ''}" placeholder="5000" /></label>
            <button class="btn primary sm" id="feeSave" style="margin-top:8px">Save fee</button>
          </div>
          <p class="small muted">Marking leads here is what fills in your pipeline and revenue on the Overview.</p>`
        : `<p>${stagePill(c.stage)} ${c.stage === 'retained' ? S.fmtMoney(c.revenue) : ''}</p>`}
      </div>` : ''}
  `);
  if (!editable || !isLead) return;
  el.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', () => {
    S.updateCall(c.id, { stage: b.dataset.stage, revenue: b.dataset.stage === 'retained' ? c.revenue : 0 });
    close(); openCall(c.id, { editable });
    if (b.dataset.stage === 'retained') setTimeout(() => document.getElementById('feeIn')?.focus(), 50);
  }));
  const save = el.querySelector('#feeSave');
  if (save) save.addEventListener('click', () => {
    const n = Number(String(el.querySelector('#feeIn').value).replace(/[^\d.]/g, '')) || 0;
    S.updateCall(c.id, { revenue: n }); toast('Fee saved'); close(); openCall(c.id, { editable });
  });
}

// Count summary used on the admin pages.
export function summarize(calls) {
  const answered = calls.filter(c => c.status === 'answered');
  const abandoned = calls.filter(c => c.status === 'abandoned');
  const asa = answered.length ? answered.reduce((s, c) => s + c.waitSec, 0) / answered.length : 0;
  const aht = answered.length ? answered.reduce((s, c) => s + c.durationSec, 0) / answered.length : 0;
  return {
    total: calls.length, answered: answered.length, abandoned: abandoned.length,
    rate: calls.length ? Math.round((answered.length / calls.length) * 100) : 100,
    asa, aht,
    newInquiries: answered.filter(c => c.callerType === 'New inquiry').length,
    consults: answered.filter(c => c.stage === 'consult' || c.stage === 'retained').length,
    retained: answered.filter(c => c.stage === 'retained').length,
    revenue: answered.reduce((s, c) => s + (c.stage === 'retained' ? c.revenue || 0 : 0), 0),
  };
}
