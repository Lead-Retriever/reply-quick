// ============================================================
// ReplyQuick server (SKELETON)
// Runs on Render (paid starter plan so it never sleeps).
// Phase 1 (now): health check, login, role checks, firm-scoped reads.
// Phase 3: Twilio inbound calls, TaskRouter queue, browser agent tokens.
// ============================================================
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  PORT = 3000, DATABASE_URL, JWT_SECRET = 'dev-only-secret', APP_ORIGIN = '*', PUBLIC_URL = '',
  TWILIO_AUTH_TOKEN, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'ReplyQuick Admin',
} = process.env;

const db = new pg.Pool({ connectionString: DATABASE_URL, ssl: DATABASE_URL && !DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false });
const app = express();
app.use(cors({ origin: APP_ORIGIN === '*' ? true : APP_ORIGIN.split(',') }));
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio posts form-encoded

app.get('/', (_req, res) => res.send('ReplyQuick server is running. Health check: /health'));

// ---------- Health (Render health check + uptime monitor) ----------
app.get('/health', async (_req, res) => {
  try { await db.query('select 1'); res.json({ ok: true, db: true }); }
  catch { res.status(500).json({ ok: false, db: false }); }
});

// ---------- Auth ----------
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await db.query('select * from users where lower(email) = lower($1) and active', [email || '']);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ sub: u.id, role: u.role, firmId: u.firm_id }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role, firmId: u.firm_id } });
});

function auth(...roles) {
  return (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      req.user = jwt.verify(token, JWT_SECRET);
      if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch { res.status(401).json({ error: 'Not signed in' }); }
  };
}

// Tenant rule: firm accounts are locked to their own firm_id, whatever the request asks for.
function firmScope(req) {
  if (req.user.role === 'firm') return req.user.firmId;
  return req.query.firmId || null; // admin may filter; null = all firms
}

app.get('/api/me', auth(), async (req, res) => {
  const { rows } = await db.query('select id, name, email, role, firm_id from users where id = $1', [req.user.sub]);
  res.json(rows[0] || null);
});

app.get('/api/calls', auth('admin', 'firm'), async (req, res) => {
  const firmId = firmScope(req);
  const { rows } = await db.query(
    `select * from calls where ($1::uuid is null or firm_id = $1) order by started_at desc limit 500`, [firmId]);
  res.json(rows);
});

// Admin creates every account (no public signup).
app.post('/api/users', auth('admin'), async (req, res) => {
  const { email, password, name, role, firmId } = req.body || {};
  if (!email || !password || !name || !['admin', 'firm', 'receptionist'].includes(role)) return res.status(400).json({ error: 'Missing fields' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await db.query(
      'insert into users (email, password_hash, name, role, firm_id) values ($1,$2,$3,$4,$5) returning id, email, name, role, firm_id',
      [email, hash, name, role, role === 'firm' ? firmId : null]);
    if (role === 'receptionist') await db.query('insert into agents (user_id) values ($1)', [rows[0].id]);
    await db.query('insert into audit_log (user_id, action, detail) values ($1, $2, $3)', [req.user.sub, 'Account created', email + ' (' + role + ')']);
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.code === '23505' ? 'Email already in use' : 'Could not create account' });
  }
});

// ---------- Twilio inbound (Phase 3) ----------
// Every ReplyQuick number's Voice webhook points here: POST {PUBLIC_URL}/twilio/voice
function twilioOnly(req, res, next) {
  if (!TWILIO_AUTH_TOKEN) return next(); // local dev without Twilio
  const ok = twilio.validateRequest(TWILIO_AUTH_TOKEN, req.headers['x-twilio-signature'] || '', PUBLIC_URL + req.originalUrl, req.body);
  return ok ? next() : res.status(403).send('Bad signature');
}

app.post('/twilio/voice', twilioOnly, async (req, res) => {
  const vr = new twilio.twiml.VoiceResponse();
  const { rows } = await db.query(
    `select f.* from phone_numbers p join firms f on f.id = p.firm_id where p.e164 = $1 and p.kind = 'replyquick'`, [req.body.To]);
  const firm = rows[0];
  if (!firm) { vr.say('This number is not in service.'); return res.type('text/xml').send(vr.toString()); }

  const call = await db.query(
    `insert into calls (firm_id, twilio_call_sid, caller_phone, status) values ($1,$2,$3,'queued')
     on conflict (twilio_call_sid) do update set status = excluded.status returning id`,
    [firm.id, req.body.CallSid, req.body.From]);

  // TODO Phase 3: hand the call to TaskRouter so the next available receptionist
  // assigned to this firm rings in the browser with the firm's context.
  // vr.enqueue({ workflowSid: process.env.TWILIO_WORKFLOW_SID })
  //   .task({}, JSON.stringify({ firmId: firm.id, callId: call.rows[0].id, from: req.body.From }));
  vr.say('Thank you for calling ' + firm.name + '. Connecting you now.');
  res.type('text/xml').send(vr.toString());
});

// ---------- Startup: create tables and the first admin login ----------
// Safe to run on every start: every table uses CREATE ... IF NOT EXISTS.
async function setup() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schema = fs.readFileSync(path.join(here, '..', 'db', 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Database tables ready');
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const { rows } = await db.query("select id from users where role = 'admin' limit 1");
    if (!rows.length) {
      await db.query('insert into users (email, password_hash, name, role) values ($1,$2,$3,$4)',
        [ADMIN_EMAIL, await bcrypt.hash(ADMIN_PASSWORD, 10), ADMIN_NAME, 'admin']);
      console.log('First admin login created for ' + ADMIN_EMAIL);
    }
  }
}

if (!DATABASE_URL) { console.error('DATABASE_URL is missing. Add it in Render > Environment.'); process.exit(1); }
setup()
  .then(() => app.listen(PORT, () => console.log('ReplyQuick server listening on ' + PORT)))
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
