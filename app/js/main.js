// ============================================================
// Live Service 24/7 app entry: one login, then each account is sent to
// its own dashboard based on role (admin, firm, receptionist).
// Routes use the URL hash (#/admin/overview) so this works on
// Cloudflare Pages with no server-side routing.
// ============================================================
import { currentUser } from './store.js';
import * as loginView from './views/login.js';
import * as adminView from './views/admin.js';
import * as firmView from './views/firm.js';
import * as deskView from './views/receptionist.js';

const root = document.getElementById('app');
let unmount = null;

const HOME = { admin: '#/admin/overview', firm: '#/firm/overview', receptionist: '#/desk' };

function route() {
  const hash = location.hash || '#/login';
  const parts = hash.replace(/^#\//, '').split('/');
  const user = currentUser();

  if (!user) {
    if (parts[0] !== 'login') { location.hash = '#/login'; return; }
    return mount(loginView, []);
  }
  if (parts[0] === 'login' || parts[0] === '') { location.hash = HOME[user.role]; return; }

  // Role guard: an account can only open its own dashboard.
  const allowed = { admin: 'admin', firm: 'firm', receptionist: 'desk' }[user.role];
  if (parts[0] !== allowed) { location.hash = HOME[user.role]; return; }

  if (parts[0] === 'admin') return mount(adminView, parts.slice(1));
  if (parts[0] === 'firm') return mount(firmView, parts.slice(1));
  if (parts[0] === 'desk') return mount(deskView, parts.slice(1));
}

function mount(view, args) {
  if (unmount) { try { unmount(); } catch (e) { /* ignore */ } unmount = null; }
  document.querySelectorAll('.overlay').forEach(o => o.remove()); // close any open drawer on navigation
  root.innerHTML = '';
  unmount = view.mount(root, args) || null;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
