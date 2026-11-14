// Shared login page. Every account type signs in here.
import { login } from '../store.js';
import { $, esc } from '../ui.js';

const DEMO = [
  { label: 'Admin', email: 'admin@replyquick.demo' },
  { label: 'Law firm owner', email: 'owner@morganlaw.demo' },
  { label: 'Receptionist', email: 'sarah@replyquick.demo' },
];

export function mount(root) {
  root.innerHTML = `
  <div class="login-wrap">
    <div class="login-card">
      <div class="brand"><div class="brand-dot">RQ</div>ReplyQuick</div>
      <h2>Sign in</h2>
      <p class="muted" style="margin:4px 0 20px">One login for firms, receptionists and admins.</p>
      <form id="loginForm" class="stack">
        <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="username" /></label>
        <label class="field"><span>Password</span><input type="password" name="password" required autocomplete="current-password" /></label>
        <div id="err" class="error hidden">That email and password don't match an account.</div>
        <button class="btn primary lg" style="width:100%" type="submit">Sign in</button>
      </form>
      <div class="demo-accounts">
        <div class="small muted">Prototype demo accounts (password: demo)</div>
        ${DEMO.map(d => `<button class="btn" data-email="${esc(d.email)}"><span>${esc(d.label)}</span><span class="muted small">${esc(d.email)}</span></button>`).join('')}
      </div>
    </div>
  </div>`;

  const form = $('#loginForm', root);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = login(form.email.value, form.password.value);
    if (!u) { $('#err', root).classList.remove('hidden'); return; }
    location.hash = '#/';
  });
  root.querySelectorAll('[data-email]').forEach(b => b.addEventListener('click', () => {
    form.email.value = b.dataset.email; form.password.value = 'demo'; form.requestSubmit();
  }));
}
