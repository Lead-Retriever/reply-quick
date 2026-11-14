// Pieces shared by the Firm and Admin dashboards.
import * as S from '../store.js';
import { esc, outcomePill, openPanel } from '../ui.js';

// Calls table with filters. opts.showFirm adds the firm column (admin only).
export function callsTable(calls, { showFirm = false, limit = 0 } = {}) {
  const rows = limit ? calls.slice(0, limit) : calls;
  if (!rows.length) return '<div class="empty">No calls match.</div>';
  return `<div class="table-wrap"><table>
    <thead><tr><th>When</th>${showFirm ? '<th>Firm</th>' : ''}<th>Caller</th><th>Type</th><th>Reason</th><th>Agent</th><th>Duration</th><th>Outcome</th></tr></thead>
    <tbody>${rows.map(c => `
      <tr class="clickable" data-call="${esc(c.id)}">
        <td class="num">${esc(S.fmtDay(c.startedAt))}<div class="small muted">${esc(S.fmtTime(c.startedAt))}</div></td>
        ${showFirm ? `<td>${esc(S.getFirm(c.firmId)?.name || '')}</td>` : ''}
        <td><b>${esc(c.callerName || 'Unknown')}</b><div class="small muted">${esc(S.fmtPhone(c.callerPhone))}</div></td>
        <td>${esc(c.callerType || '')}</td>
        <td style="max-width:260px">${esc(c.reason)}</td>
        <td>${esc(c.agent || '')}</td>
        <td class="num">${c.durationSec ? S.fmtDur(c.durationSec) : ''}</td>
        <td>${outcomePill(c.outcome)}</td>
      </tr>`).join('')}</tbody></table></div>`;
}

export function callFilters(firms) {
  return `<div class="btn-row" style="margin-bottom:14px">
    <input type="text" id="fSearch" placeholder="Search caller, phone or reason" style="max-width:280px" />
    ${firms ? `<select id="fFirm" style="max-width:220px"><option value="">All firms</option>${firms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select>` : ''}
    <select id="fOutcome" style="max-width:200px"><option value="">All outcomes</option>${['Intake complete', 'Transferred', 'Callback requested', 'Message taken', 'Wrong number / spam', 'Abandoned'].map(o => `<option>${o}</option>`).join('')}</select>
    <select id="fRange" style="max-width:160px"><option value="">All time</option><option value="today">Today</option><option value="7">Last 7 days</option></select>
  </div>`;
}

export function applyFilters(calls, root) {
  const q = (root.querySelector('#fSearch')?.value || '').toLowerCase();
  const firm = root.querySelector('#fFirm')?.value || '';
  const out = root.querySelector('#fOutcome')?.value || '';
  const range = root.querySelector('#fRange')?.value || '';
  return calls.filter(c => {
    if (firm && c.firmId !== firm) return false;
    if (out && c.outcome !== out) return false;
    if (range === 'today' && !S.isToday(c.startedAt)) return false;
    if (range === '7' && c.startedAt < Date.now() - 7 * 86400000) return false;
    if (q && !((c.callerName || '') + ' ' + c.callerPhone + ' ' + (c.reason || '') + ' ' + (c.notes || '')).toLowerCase().includes(q)) return false;
    return true;
  });
}

export function openCall(id) {
  const c = S.getCalls().find(x => x.id === id); if (!c) return;
  const firm = S.getFirm(c.firmId);
  const attempts = c.transferAttempts && c.transferAttempts.length ? c.transferAttempts : c.transfer ? [c.transfer] : [];
  openPanel(`
    <div class="card-head"><div><div class="small muted">${esc(firm?.name || '')}</div><h2>${esc(c.callerName || 'Unknown caller')}</h2></div><button class="btn sm" data-close>Close</button></div>
    ${outcomePill(c.outcome)}
    <dl class="kv">
      <dt>Phone</dt><dd>${esc(S.fmtPhone(c.callerPhone))}</dd>
      ${c.callbackNumber && c.callbackNumber !== S.fmtPhone(c.callerPhone) ? `<dt>Callback number</dt><dd>${esc(c.callbackNumber)}</dd>` : ''}
      <dt>When</dt><dd>${esc(S.fmtDay(c.startedAt))} at ${esc(S.fmtTime(c.startedAt))}</dd>
      <dt>Caller type</dt><dd>${esc(c.callerType || '')}</dd>
      <dt>Reason</dt><dd>${esc(c.reason || '')}</dd>
      <dt>Answered by</dt><dd>${esc(c.agent || 'Not answered')}</dd>
      <dt>Wait time</dt><dd class="num">${S.fmtDur(c.waitSec)}</dd>
      <dt>Duration</dt><dd class="num">${S.fmtDur(c.durationSec)}</dd>
    </dl>
    ${attempts.length ? `<h3>Transfers</h3>${attempts.map(t => `<div class="list-item"><div>${esc(t.type === 'warm' ? 'Warm' : 'Blind')} transfer to <b>${esc(t.to)}</b></div><span class="pill ${t.result === 'accepted' ? 'success' : 'danger'}">${t.result === 'accepted' ? 'Connected' : 'No answer'}</span></div>`).join('')}` : ''}
    <h3 style="margin-top:16px">Notes</h3>
    <p>${esc(c.notes || 'No notes.')}</p>
    <div class="small muted">Recording: ${firm && firm.recordingEnabled ? 'available' : 'off for this firm'}</div>
  `);
}

// Count summary used on both overview pages.
export function summarize(calls) {
  const answered = calls.filter(c => c.status === 'answered');
  const abandoned = calls.filter(c => c.status === 'abandoned');
  const missed = calls.filter(c => c.status === 'missed');
  const asa = answered.length ? answered.reduce((s, c) => s + c.waitSec, 0) / answered.length : 0;
  const aht = answered.length ? answered.reduce((s, c) => s + c.durationSec, 0) / answered.length : 0;
  return {
    total: calls.length, answered: answered.length, abandoned: abandoned.length, missed: missed.length,
    rate: calls.length ? Math.round((answered.length / calls.length) * 100) : 100,
    asa, aht,
    newInquiries: answered.filter(c => c.callerType === 'New inquiry').length,
    intakes: answered.filter(c => c.outcome === 'Intake complete').length,
    transfers: answered.filter(c => c.outcome === 'Transferred').length,
  };
}
