-- ============================================================
-- ReplyQuick database schema (Postgres)
-- Run once against the Render Postgres database:
--   psql "$DATABASE_URL" -f server/db/schema.sql
-- Every firm-owned table carries firm_id so the server can enforce
-- "a firm only sees its own records" on every query.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS firms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  practice           text,
  address            text,
  timezone           text NOT NULL DEFAULT 'America/New_York',
  contact_name       text,
  contact_email      text,
  status             text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding','live','paused')),
  greeting           text NOT NULL DEFAULT '',
  instructions       text NOT NULL DEFAULT '',
  hours              jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { mon: {open:"09:00",close:"17:00"} | null, ... }
  faqs               jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ q, a }]
  recording_enabled  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Numbers: the ReplyQuick Twilio number plus the firm's own numbers (used by the swap script).
CREATE TABLE IF NOT EXISTS phone_numbers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  e164          text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('replyquick','original')),
  twilio_sid    text,                         -- PN... for ReplyQuick numbers
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS phone_numbers_rq_unique ON phone_numbers(e164) WHERE kind = 'replyquick';

-- Logins. role: admin | firm | receptionist. No public signup; admin creates all rows.
CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  name           text NOT NULL,
  role           text NOT NULL CHECK (role IN ('admin','firm','receptionist')),
  firm_id        uuid REFERENCES firms(id) ON DELETE CASCADE,   -- required when role = 'firm'
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (role <> 'firm' OR firm_id IS NOT NULL)
);

-- Receptionist profile (one per receptionist login).
CREATE TABLE IF NOT EXISTS agents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'offline' CHECK (status IN ('available','ringing','on_call','after_call','break','offline')),
  shift_started_at     timestamptz,
  twilio_worker_sid    text,                  -- WK... TaskRouter worker
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Which firms each receptionist may answer for.
CREATE TABLE IF NOT EXISTS agent_firms (
  agent_id  uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  firm_id   uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, firm_id)
);

-- Status history for shift time, break time and availability reporting.
CREATE TABLE IF NOT EXISTS agent_status_log (
  id         bigserial PRIMARY KEY,
  agent_id   uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status     text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now()
);

-- Transfer directory.
CREATE TABLE IF NOT EXISTS firm_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name          text NOT NULL,
  role          text,
  phone         text NOT NULL,
  can_transfer  boolean NOT NULL DEFAULT true,
  after_hours   boolean NOT NULL DEFAULT false,
  sort_order    int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id          uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  twilio_call_sid  text UNIQUE,
  caller_phone     text,
  caller_name      text,
  callback_number  text,
  caller_type      text,                     -- New inquiry | Existing client | Other
  reason           text,
  notes            text,
  outcome          text,                     -- Intake complete | Message taken | Transferred | Callback requested | Wrong number / spam | Abandoned
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','ringing','answered','abandoned','missed')),
  agent_id         uuid REFERENCES agents(id) ON DELETE SET NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  answered_at      timestamptz,
  ended_at         timestamptz,
  wait_seconds     int,
  duration_seconds int,
  recording_url    text
);
CREATE INDEX IF NOT EXISTS calls_firm_started ON calls(firm_id, started_at DESC);
CREATE INDEX IF NOT EXISTS calls_caller ON calls(caller_phone);

-- Raw event trail per call (Twilio webhooks + app actions) for reconciliation.
CREATE TABLE IF NOT EXISTS call_events (
  id        bigserial PRIMARY KEY,
  call_id   uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  type      text NOT NULL,
  data      jsonb NOT NULL DEFAULT '{}'::jsonb,
  at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfer_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  contact_id  uuid REFERENCES firm_contacts(id) ON DELETE SET NULL,
  to_name     text,
  to_phone    text,
  type        text NOT NULL CHECK (type IN ('warm','blind')),
  result      text NOT NULL DEFAULT 'ringing' CHECK (result IN ('ringing','accepted','failed')),
  at          timestamptz NOT NULL DEFAULT now()
);

-- Callback tasks shown on the firm dashboard.
CREATE TABLE IF NOT EXISTS tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  call_id     uuid REFERENCES calls(id) ON DELETE SET NULL,
  title       text NOT NULL,
  detail      text,
  due_at      timestamptz,
  done        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Onboarding drafts (admin's Onboarding tab).
CREATE TABLE IF NOT EXISTS onboarding_drafts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data        jsonb NOT NULL,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id        bigserial PRIMARY KEY,
  user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  action    text NOT NULL,
  detail    text,
  firm_id   uuid REFERENCES firms(id) ON DELETE SET NULL,
  at        timestamptz NOT NULL DEFAULT now()
);
