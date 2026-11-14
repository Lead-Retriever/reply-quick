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
- Call recording is off at launch; a per-firm switch exists in Admin for later.
- No text messages. Firms see everything on their dashboard.
- Billing is handled in Stripe, outside the app.
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
