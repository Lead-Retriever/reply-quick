# Live Service 24/7

A 24/7 live receptionist service for law firms. Real receptionists answer every call to a firm's Live Service 24/7 number, log the details, and transfer when needed. Firms see everything on their dashboard.

## Folders

| Folder | What it is | Hosted on |
|---|---|---|
| `app/` | The logged-in app: one login page, then Admin, Firm or Receptionist dashboard by account type | Cloudflare Pages (free) |
| `server/` | API, database and Twilio webhooks | Render, paid starter plan + Postgres |
| `site/` | Public landing page (built in a separate chat) | Cloudflare Pages (free) |
| `docs/` | Decisions, parked ideas, and the landing page prompt | Not deployed |

## Current status: Phase 1 (clickable prototype)

`app/` runs fully in the browser on demo data. Nothing is connected to Twilio or the server yet.

Demo logins (password for all: `demo`):

- Admin: `admin@liveservice247.demo`
- Law firm: `owner@morganlaw.demo` (also `owner@riveralaw.demo`, `owner@chendefense.demo`)
- Receptionist: `sarah@liveservice247.demo` (also john, maria, priya, ken @liveservice247.demo)

Tip: open the receptionist desk in one tab and the firm dashboard in another. A call you save as the receptionist shows up on the firm's dashboard right away.

## Hosting (Cloudflare Pages, two projects from this one repo)

| Project name | Build output directory | Custom domain |
|---|---|---|
| `liveservice247-site` | `site` | `liveservice247.com` and `www.liveservice247.com` |
| `liveservice247-app` | `app` | `app.liveservice247.com` |

Both: Framework preset None, build command empty. The server runs on Render (see `server/`); its `APP_ORIGIN` setting must be `https://app.liveservice247.com`.

## Rebranding

All colors and fonts live in `app/brand.css` (matched to the website). Replace that one file with the brand.css from the branding chat and every dashboard updates.

## Build phases

1. Clickable prototype of all three dashboards on demo data (done)
2. Server live on Render, real logins and database (`server/db/schema.sql`)
3. Live Twilio calls ringing in the receptionist workspace (Voice JS SDK + TaskRouter)
4. Onboarding buys the Twilio number automatically
5. Landing page in `site/`

See `docs/decisions.md` for everything decided and everything parked for later.
