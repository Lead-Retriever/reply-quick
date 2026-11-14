// Small UI helpers shared by every dashboard.
import { logout, currentUser, resetDemo } from './store.js';

export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function toast(msg) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// Opens a right-side drawer (or centered modal) and returns { el, close }.
export function openPanel(innerHtml, { center = false } = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay' + (center ? ' center' : '');
  ov.innerHTML = '<div class="' + (center ? 'modal' : 'drawer') + '">' + innerHtml + '</div>';
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(ov);
  return { el: ov.firstElementChild, close };
}

export const STATUS_LABEL = {
  available: 'Available', ringing: 'Ringing', on_call: 'On call',
  after_call: 'After-call work', break: 'Break', offline: 'Offline',
};
const STATUS_PILL = { available: 'success', ringing: 'info', on_call: 'danger', after_call: 'warning', break: '', offline: '' };
export const statusPill = (s) => '<span class="pill ' + (STATUS_PILL[s] || '') + '">' + esc(STATUS_LABEL[s] || s) + '</span>';

const OUTCOME_PILL = {
  'Consultation booked': 'success', 'Intake complete': 'info', 'Transferred': 'accent', 'Callback requested': 'warning',
  'Message taken': '', 'Abandoned': 'danger', 'Missed': 'danger',
};
export const outcomePill = (o) => '<span class="pill ' + (OUTCOME_PILL[o] || '') + '">' + esc(o) + '</span>';

// Sidebar layout used by Admin and Firm dashboards.
export function shell({ nav, active, title, subtitle, body, actions = '' }) {
  const u = currentUser();
  return `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-dot">RQ</div>ReplyQuick</div>
      <nav class="nav">
        ${nav.map(n => n.label ? `<div class="side-label">${esc(n.label)}</div>` :
          `<a href="${n.href}" class="${n.href === active ? 'active' : ''}">${esc(n.text)}</a>`).join('')}
      </nav>
      <div class="side-foot">
        <div><b>${esc(u ? u.name : '')}</b></div>
        <div style="opacity:.7">${esc(u ? u.email : '')}</div>
        <button class="btn ghost sm" data-action="logout">Log out</button>
      </div>
    </aside>
    <main class="main">
      <div class="page-head">
        <div><h1>${esc(title)}</h1>${subtitle ? `<p class="muted">${esc(subtitle)}</p>` : ''}</div>
        <div class="btn-row">${actions}</div>
      </div>
      ${body}
    </main>
  </div>`;
}

// Global click handlers for logout and demo reset.
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  if (a.dataset.action === 'logout') { logout(); location.hash = '#/login'; }
  if (a.dataset.action === 'reset-demo') {
    if (confirm('Reset all demo data back to the starting state?')) { resetDemo(); toast('Demo data reset'); }
  }
});
