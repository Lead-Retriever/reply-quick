# Prompt for the landing page chat

Paste everything below the line into a new chat. Attach the brand.css from the branding chat if it's ready.

---

I need a landing page for my client's business, ReplyQuick. Build it as a single self-contained index.html (CSS in the file, minimal or no JavaScript) that I will drop into the `site/` folder of a GitHub repo and host free on Cloudflare Pages. Give me the finished file(s) in a .zip.

## The business

ReplyQuick is a 24/7 live receptionist service for law firms. Real human receptionists answer every call to the firm, day or night, weekends and holidays, so the firm never loses a potential client to voicemail. It is NOT an AI product; never call it AI, a bot, or an "AI receptionist," and never imply automated answering.

How it works for the firm:
1. ReplyQuick sets the firm up with its own dedicated phone number and a small script for their website that swaps their website's phone numbers to the ReplyQuick number. Their Google Business Profile number and their existing office line (forwarding) point to it too.
2. Every call is answered live by a trained receptionist with the firm's own greeting, who knows the firm's FAQs, office hours and who to transfer calls to.
3. The receptionist takes the caller's details and reason for calling, transfers to the right attorney or staff member when appropriate (warm or blind transfer), or logs a message or callback request.
4. The firm logs into its own dashboard to see every call: caller name and number, reason, notes, outcome, who answered, and callbacks due.

Who it's for: solo attorneys up to small multi-partner firms in any practice area (personal injury, family, criminal defense, estate, immigration, etc.). The pain: missed calls are missed cases. A caller who hits voicemail usually calls the next firm on Google.

Things that are true and can be used in copy: live humans, 24/7/365, every call answered, firm's own greeting, warm transfers to attorneys, intake details captured, callback tasks, client dashboard, no long setup (onboarding is done for them, a person walks them through it). Receptionists never give legal advice.

Things NOT to claim (they don't exist): AI, texting/SMS alerts, call recording, CRM or Clio integrations, bilingual staff, specific prices, specific answer-time guarantees, client counts, testimonials or logos. Do not invent reviews, stats or testimonials; leave clearly labeled placeholders where real ones will go later.

## Page requirements

- Main call to action: "Book a demo." Use href="#" with a comment so I can drop in the real calendar link later.
- A small, secondary "Client Login" button in the header next to the main CTA. Link it to https://replyquick-app.pages.dev for now (comment it so I can swap to app.[domain] later). This is where firms, receptionists and admins all log in.
- Sections (suggested): hero, the problem (missed calls cost cases), how it works (3 or 4 steps), what the firm gets (live answering, transfers, intake details, dashboard), what the dashboard shows (can include a simple illustrated mock, clearly not a real screenshot), FAQ, final CTA, footer.
- Mobile first, fast, accessible, good contrast. No heavy libraries.
- Basic SEO: title, meta description, Open Graph tags, and LegalService/ProfessionalService-appropriate structured data only if it doesn't claim anything untrue. Domain is not bought yet, so leave the canonical URL as a commented placeholder.

## Writing rules

- Never use em dashes or en dashes anywhere. Use commas, colons, periods or semicolons. Hyphens only inside true compound words (full-time, 24/7 is fine).
- Plain, confident, professional tone that attorneys trust. No hype words like "revolutionary" or "game-changing."

## Branding

Use the attached brand.css variables if provided. If not, use these placeholders in :root so I can swap them later: primary #13213a (navy), accent #0f8b7e (teal), fonts Space Grotesk (headings) and Inter (body) from Google Fonts.

Ask me any questions before you start if something is unclear.
