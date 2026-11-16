# ReplyQuick decisions

## Locked

- Law firms only. Other industries would be a separate brand later.
- Every call is answered by a live receptionist, 24/7. No voicemail, no message line, no AI answering.
- One login page. Three dashboards by account type: Admin (ReplyQuick owner), Firm (law firm owner), Receptionist.
- No public signup. Admin creates every account.
- Onboarding is a tab inside Admin, run by a real person walking the firm through the questions.
- Each firm gets a dedicated ReplyQuick Twilio number on the client's existing Twilio account.
- The website number swap script is generated per firm in onboarding, based on their website platform and current numbers.
- Calls not coming from the website are covered by the onboarding checklist: Google Business Profile number, forwarding the old office line, and directory listings.
- Call recording is on per firm (switch in Admin). Callers hear "This call may be recorded" before a receptionist picks up, which covers states that require every party's consent. Recordings play from the Calls tab for firms and admin.
- No text messages. Firms see everything on their dashboard.
- Billing is handled in Stripe, outside the app.
- Firms have no settings screen. ReplyQuick sets up and edits everything (greeting, hours, transfers, FAQs, cheat sheet) from Admin, Law firms.
- Firm dashboard: Overview (pipeline plus an estimated "without ReplyQuick" comparison at a 70% answer rate, set in store.js), Calls, Calendar (Google and Outlook connections).
- No callbacks or average answer time are shown to firms.
- Each firm has a receptionist cheat sheet, edited in Admin and shown to receptionists during calls.
- Office hours do not change whether calls are answered (always answered); they only decide who can receive transfers.

## Parked for later

- Routing modes (overflow, after-hours only, screening rules). Needs a full scenario map first.
- Long-wait alerts to the admin (caller waiting more than about 20 seconds).
- Law-specific intake templates per practice area and conflict-check capture.
- Separate sales/onboarding role and firm staff (non-owner) logins.
- Audited "view as firm" support mode for admins.
- Clio / MyCase integrations.
- Outbound calling campaigns.
- SMS of any kind.
