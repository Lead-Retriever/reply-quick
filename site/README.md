# site/

Public landing page for Live Service 24/7. Plain HTML, CSS and a little JavaScript, no build step.

```
site/
  index.html        the whole page (styles and scripts are inside)
  assets/           logo, favicon, grain texture and photos
```

## Deploy (Cloudflare Pages)

This is its own Cloudflare Pages project, separate from the app.

1. Cloudflare dashboard, Workers & Pages, Create, Pages, Connect to Git, pick this repo.
2. Framework preset: None. Build command: leave empty. Build output directory: `site`.
3. Save and Deploy.

The Dashboard buttons link to `https://replyquick-app.pages.dev`. Swap to `https://app.yourdomain.com` once the domain is live.

## Review build

This version is for client review of design and copy. It is hidden from search engines (`noindex` tag in `index.html` and `robots.txt`). Remove both at real launch.

## To replace before launch

- Get Started and "Schedule a call" buttons use `href="#"`: drop in the real booking link.
- Prices are not shown yet (pricing cards list calls per month only).
- Photos in `assets/` are free Unsplash stock (unsplash.com/license). Swap for the real team when ready.
- Sample content to swap for real before launch: hero "100,000 calls" label, 4.9 rating and "200+" count, team names and call stats, and the three client quotes (names, firms and stock photos).
- "Spanish speaking callers" tile in Tailored to you: keep only if Spanish speaking receptionists are offered.
- Calculator is the visitor's own estimate; the dashboard mockup is labeled as sample data.
