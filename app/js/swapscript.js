// ============================================================
// Phone number swap script generator.
// Builds the per-firm snippet that replaces the firm's own phone
// numbers (text and click-to-call links) with their Live Service 24/7
// number, plus install steps for the firm's website platform.
// ============================================================
import { fmtPhone } from './store.js';

// LT keeps the literal text "<script" out of this file so the app can be inlined into one HTML page.
const LT = '<';
const digits10 = (e164) => String(e164).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

export function buildScript({ firmName, originalNumbers, rqNumber, catchAll }) {
  const swap = {};
  originalNumbers.forEach(n => { const d = digits10(n); if (d.length === 10) swap[d] = true; });
  const swapJson = JSON.stringify(swap);
  const display = fmtPhone(rqNumber);
  const dial = rqNumber;
  const safeName = String(firmName).replace(/[^\w &.,'-]/g, '');

  // Same snippet as the approved website demo: number swap, fixed 24/7 banner,
  // desktop call bubble + popup, mobile bottom call bar. Copy and colors are fixed;
  // only the numbers change per firm.
  return String.raw`${LT}!-- Live receptionist website snippet for ${safeName}: number swap + fixed 24/7 banner + call bubble/bar + call popup -->
${LT}script>
(function () {
  // ============ PER-FIRM SETTINGS (the only part that changes per firm) ============
  var CONFIG = {
    phoneDisplay: "${display}",   // our number for this firm, as shown
    phoneDial: "${dial}",        // same number, for tel: links
    swap: ${swapJson},     // firm's old numbers (10 digits) to replace
    catchAll: ${catchAll ? 'true' : 'false'}                   // true = replace every phone number on the site
  };
  // ================================================================================

  // Fixed design and copy (same on every firm's site)
  var COLOR = "#0f8b7e", BANNER = "#13213a", POPUP_DELAY = 12;
  var COPY = {
    banner: "Our team is available 24/7 to answer your questions.",
    badge: "real human available 24/7",
    human: "Real human available 24/7",
    title: "Ready To Help",
    text: "Tell us what happened and we'll take it from here"
  };

  var PHONE_RE = /(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g;
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1 };
  var NEW = { display: CONFIG.phoneDisplay, dial: CONFIG.phoneDial };
  var TEL = "tel:" + CONFIG.phoneDial;

  // ---------- 1. Number swap ----------
  function normalize(raw) {
    var d = String(raw).replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    return d.length === 10 ? d : null;
  }
  function lookup(raw) {
    var d = normalize(raw);
    if (!d) return null;
    return (CONFIG.swap[d] || CONFIG.catchAll) ? NEW : null;
  }
  function swapTextNode(node) {
    var parent = node.parentNode;
    if (!parent || SKIP[parent.nodeName]) return;
    var text = node.nodeValue;
    var out = text.replace(PHONE_RE, function (m) { var r = lookup(m); return r ? r.display : m; });
    if (out !== text) node.nodeValue = out;
  }
  function swapLink(a) {
    var href = a.getAttribute("href") || "";
    var m = href.match(/^(tel|sms):(.*)$/i);
    if (!m) return;
    var r = lookup(decodeURIComponent(m[2]));
    if (r && href !== m[1] + ":" + r.dial) a.setAttribute("href", m[1] + ":" + r.dial);
  }
  function processNode(root) {
    if (!root) return;
    if (root.nodeType === 3) { swapTextNode(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n, nodes = [];
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(swapTextNode);
    if (root.matches && root.matches('a[href^="tel:"], a[href^="sms:"]')) swapLink(root);
    root.querySelectorAll('a[href^="tel:"], a[href^="sms:"]').forEach(swapLink);
  }
  function startSwap() {
    processNode(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (mu) {
        if (mu.type === "characterData") swapTextNode(mu.target);
        else if (mu.type === "attributes") swapLink(mu.target);
        else mu.addedNodes.forEach(processNode);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href"] });
  }

  // ---------- Shared pieces ----------
  // Each widget lives in a Shadow DOM so the firm's CSS can't break it, and ours can't break theirs.
  function mount(id, css, html) {
    var host = document.createElement("div");
    host.id = id;
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    root.innerHTML = "<style>:host{all:initial}" + css + "</style>" + html;
    return { host: host, root: root };
  }
  var FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  // Bold handset with rounded corners (outline from Lucide icons, ISC license, filled and stroked for weight)
  var PHONE = '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  // Smiling receptionist illustration. Swap for a real photo later by replacing this with <img src="...">.
  var FACE = '<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">' +
    '<circle cx="24" cy="24" r="24" fill="#dff3ef"/>' +
    '<path d="M8 46c2-9 8.5-13 16-13s14 4 16 13" fill="' + COLOR + '"/>' +
    '<path d="M20.5 29h7v5.5a3.5 3.5 0 0 1-7 0z" fill="#e8b48f"/>' +
    '<ellipse cx="24" cy="21" rx="9" ry="10" fill="#f2c4a0"/>' +
    '<path d="M14.6 21c-.6-8 3.6-12 9.4-12s10 4 9.4 12c-1.3-4.2-4-6.6-9.4-6.9-5.4.3-8.1 2.7-9.4 6.9z" fill="#3b2a20"/>' +
    '<path d="M15 20c-1.4 0-2.4 1.4-2.2 3.3.2 1.6 1.2 2.6 2.5 2.4M33 20c1.4 0 2.4 1.4 2.2 3.3-.2 1.6-1.2 2.6-2.5 2.4" fill="#f2c4a0"/>' +
    '<circle cx="20.3" cy="20.6" r="1.25" fill="#2b2b2b"/><circle cx="27.7" cy="20.6" r="1.25" fill="#2b2b2b"/>' +
    '<path d="M19.6 25.2c1.3 2.1 2.7 3 4.4 3s3.1-.9 4.4-3" fill="none" stroke="#9b4a3a" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M13.4 22a10.6 10.6 0 0 1 21.2 0" fill="none" stroke="#1f2937" stroke-width="1.6"/>' +
    '<rect x="11.6" y="20.5" width="3.2" height="5.6" rx="1.4" fill="#1f2937"/><rect x="33.2" y="20.5" width="3.2" height="5.6" rx="1.4" fill="#1f2937"/>' +
    '<path d="M34.8 26c0 3.2-2.6 5-6.2 5" fill="none" stroke="#1f2937" stroke-width="1.3" stroke-linecap="round"/><circle cx="28.2" cy="31" r="1.3" fill="#1f2937"/></svg>';
  // Phones and tablets only (touch screen, no mouse). A narrow desktop window still gets the bubble.
  var MOBILE = !!(window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var WIGGLE = "@keyframes wig{0%,86%,100%{transform:rotate(0)}88%{transform:rotate(-14deg)}90%{transform:rotate(14deg)}92%{transform:rotate(-10deg)}94%{transform:rotate(10deg)}96%{transform:rotate(-4deg)}}" +
    "@media (prefers-reduced-motion:reduce){.wig{animation:none!important}}";

  // ---------- 2. Fixed top banner ----------
  function addBanner() {
    var css = ".bar{" + FONT + "position:fixed;top:0;left:0;right:0;z-index:2147483000;background:" + BANNER + ";color:#fff;font-size:14px;line-height:1.4;padding:10px 16px;text-align:center}" +
      ".dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3ddc84;margin-right:8px;vertical-align:middle}" +
      "a{color:#fff;font-weight:700;text-decoration:none;white-space:nowrap;margin-left:8px;display:inline-flex;align-items:center;gap:6px;vertical-align:middle}" +
      "a svg{font-size:15px}a span{border-bottom:1px solid rgba(255,255,255,.5)}";
    var w = mount("rq-banner", css, '<div class="bar" role="region" aria-label="Contact"><span class="dot"></span>' + COPY.banner +
      '<a href="' + TEL + '">' + PHONE + '<span>Call ' + CONFIG.phoneDisplay + '</span></a></div>');
    document.body.appendChild(w.host);
    var bar = w.root.querySelector(".bar");
    var pad = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    var moved = [];
    // Push the page down so the banner never covers it, and move the site's own
    // fixed/sticky header (if it has one) below the banner.
    function layout() {
      var h = bar.offsetHeight;
      document.body.style.paddingTop = (pad + h) + "px";
      var els = document.body.querySelectorAll("*");
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.id && el.id.indexOf("rq-") === 0) continue;
        var cs = getComputedStyle(el);
        if ((cs.position === "fixed" || cs.position === "sticky") && moved.indexOf(el) === -1 && parseFloat(cs.top) === 0 && cs.bottom !== "0px") moved.push(el);
      }
      moved.forEach(function (el) { el.style.top = h + "px"; });
    }
    layout();
    window.addEventListener("resize", layout);
    window.addEventListener("load", layout);
  }

  // ---------- 3a. Desktop: call bubble with "real human" card ----------
  function addBubble(openPopup) {
    // Circle with the call icon; a small floating white card sits up and to the left,
    // its bottom-right corner tucked under the circle's upper-left edge.
    var css = ".wrap{" + FONT + "position:fixed;right:22px;bottom:22px;z-index:2147483000;width:60px;height:60px}" +
      ".card{position:absolute;right:42px;bottom:42px;z-index:1;display:flex;align-items:center;gap:8px;background:#fff;color:#16202f;padding:6px 16px 6px 6px;border-radius:14px;box-shadow:0 6px 22px rgba(16,24,40,.16);cursor:pointer;border:0;font:inherit;white-space:nowrap}" +
      ".face{width:30px;height:30px;border-radius:50%;overflow:hidden;position:relative;flex:none}" +
      ".on{position:absolute;right:0;bottom:0;width:8px;height:8px;border-radius:50%;background:#22c55e;border:2px solid #fff}" +
      ".card b{font-size:12.5px;font-weight:700}" +
      ".btn{position:absolute;inset:0;z-index:2;border-radius:50%;background:" + COLOR + ";color:#fff;border:0;cursor:pointer;display:grid;place-items:center;font-size:26px;box-shadow:0 8px 22px rgba(15,139,126,.4)}" +
      ".btn:hover{filter:brightness(1.08)}.btn .wig{display:grid;animation:wig 5s ease-in-out infinite}" + WIGGLE;
    var w = mount("rq-bubble", css,
      '<div class="wrap"><button class="card" aria-label="' + COPY.human + '"><span class="face">' + FACE + '<span class="on"></span></span><b>' + COPY.human + '</b></button>' +
      '<button class="btn" aria-label="Call us"><span class="wig">' + PHONE + '</span></button></div>');
    document.body.appendChild(w.host);
    w.root.querySelector(".btn").addEventListener("click", function () { openPopup(true); });
    w.root.querySelector(".card").addEventListener("click", function () { openPopup(true); });
  }

  // ---------- 3b. Mobile: fixed bottom call bar ----------
  function addBottomBar() {
    var css = ".bb{" + FONT + "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#fff;box-shadow:0 -4px 20px rgba(16,24,40,.14);display:flex;align-items:center;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}" +
      ".face{width:40px;height:40px;border-radius:50%;overflow:hidden;position:relative;flex:none}" +
      ".on{position:absolute;right:1px;bottom:1px;width:10px;height:10px;border-radius:50%;background:#22c55e;border:2px solid #fff}" +
      ".txt{flex:1;min-width:0;color:#16202f;font-size:13px;font-weight:700;line-height:1.25}" +
      ".call{display:flex;align-items:center;gap:8px;background:" + COLOR + ";color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 16px;border-radius:12px;white-space:nowrap}" +
      ".call .wig{display:grid;font-size:18px;animation:wig 5s ease-in-out infinite}" + WIGGLE;
    var w = mount("rq-bottombar", css,
      '<div class="bb"><span class="face">' + FACE + '<span class="on"></span></span><span class="txt">' + COPY.human + '</span>' +
      '<a class="call" href="' + TEL + '"><span class="wig">' + PHONE + '</span>Call Now</a></div>');
    document.body.appendChild(w.host);
    function pad() { document.body.style.paddingBottom = w.root.querySelector(".bb").offsetHeight + "px"; }
    pad(); window.addEventListener("resize", pad);
  }

  // ---------- 4. Desktop popup ----------
  function addPopup() {
    var css = ".ov{" + FONT + "position:fixed;inset:0;background:rgba(10,16,28,.55);z-index:2147483001;display:none;align-items:center;justify-content:center;padding:20px}" +
      ".ov.open{display:flex;animation:fade .2s ease-out}" +
      ".box{background:#fff;color:#16202f;border-radius:18px;max-width:400px;width:100%;padding:32px 28px 28px;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:up .25s ease-out}" +
      ".x{position:absolute;right:12px;top:10px;background:none;border:0;font-size:24px;color:#8a94a6;cursor:pointer;padding:4px 8px}" +
      ".badge{display:inline-flex;align-items:center;gap:8px;background:#e8f7ef;color:#167a45;font-size:12.5px;font-weight:700;padding:5px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em}" +
      ".badge i{width:8px;height:8px;border-radius:50%;background:#22b35d;display:inline-block}" +
      "h2{font-size:26px;line-height:1.2;margin:16px 0 8px;color:#16202f}" +
      "p{font-size:15.5px;line-height:1.55;color:#4b5565;margin:0 0 22px}" +
      ".call{display:flex;align-items:center;justify-content:center;gap:10px;background:" + COLOR + ";color:#fff;text-decoration:none;font-size:18px;font-weight:700;padding:15px;border-radius:12px}" +
      ".call:hover{filter:brightness(1.08)}" +
      "@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes up{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}" +
      "@media (prefers-reduced-motion:reduce){.ov.open,.box{animation:none}}";
    var w = mount("rq-popup", css,
      '<div class="ov" role="dialog" aria-modal="true" aria-label="' + COPY.title + '"><div class="box">' +
      '<button class="x" aria-label="Close">&times;</button>' +
      '<span class="badge"><i></i>' + COPY.badge + '</span>' +
      '<h2>' + COPY.title + '</h2><p>' + COPY.text + '</p>' +
      '<a class="call" href="' + TEL + '">' + PHONE + ' Call ' + CONFIG.phoneDisplay + '</a></div></div>');
    document.body.appendChild(w.host);
    var ov = w.root.querySelector(".ov");
    function open(force) {
      if (!force && store("rq_popup_seen")) return;
      store("rq_popup_seen", "1");
      ov.classList.add("open");
    }
    function close() { ov.classList.remove("open"); }
    w.root.querySelector(".x").addEventListener("click", close);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    // Auto-open once per visit: after a delay, or when the visitor heads for the tab bar to leave.
    setTimeout(function () { open(false); }, POPUP_DELAY * 1000);
    document.addEventListener("mouseout", function (e) { if (!e.relatedTarget && e.clientY <= 0) open(false); });
    return open;
  }

  function start() {
    startSwap();
    addBanner();
    if (MOBILE) addBottomBar();          // phones: bottom call bar, no popup
    else addBubble(addPopup());          // computers: bubble + popup
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
${LT}/script>`;
}

export const PLATFORMS = {
  wordpress: {
    label: 'WordPress',
    steps: [
      'Log in to the WordPress admin (yoursite.com/wp-admin).',
      'Go to Plugins, Add New, search "WPCode", then install and activate it (skip if already installed).',
      'Go to Code Snippets, Add Snippet, choose "Add Your Custom Code", and set the code type to HTML Snippet.',
      'Paste the script, set Location to "Site Wide Footer", switch it to Active, and save.',
      'If the site uses a caching plugin (WP Rocket, LiteSpeed, W3 Total Cache), clear the cache.',
    ],
  },
  webflow: {
    label: 'Webflow',
    steps: [
      'Open the site in Webflow and go to Site Settings, then the Custom Code tab.',
      'Paste the script into the "Footer Code" box (before </body> tag).',
      'Save changes, then click Publish and publish to all domains.',
    ],
  },
  squarespace: {
    label: 'Squarespace',
    steps: [
      'In Squarespace, go to Settings, Advanced (or Developer Tools), then Code Injection.',
      'Paste the script into the "Footer" box and save.',
      'Note: Code Injection requires a Business plan or higher.',
    ],
  },
  wix: {
    label: 'Wix',
    steps: [
      'In the Wix dashboard, go to Settings, then Custom Code (under Advanced).',
      'Click Add Custom Code, paste the script, and choose "All pages" and "Load code once".',
      'Set placement to "Body: end" and apply. Requires a premium plan with a connected domain.',
    ],
  },
  godaddy: {
    label: 'GoDaddy Website Builder',
    steps: [
      'GoDaddy Website Builder does not allow site-wide footer scripts.',
      'Instead: update the phone number in the site header, footer and contact sections by hand to the Live Service number.',
    ],
  },
  gtm: {
    label: 'Google Tag Manager',
    steps: [
      'Open the firm\'s Google Tag Manager container.',
      'Tags, New, Tag Configuration: Custom HTML. Paste the script.',
      'Triggering: All Pages (or "DOM Ready"). Save, then Submit and Publish the container.',
    ],
  },
  other: {
    label: 'Other / custom-coded site',
    steps: [
      'Send the script to whoever manages the website.',
      'It goes right before the closing </body> tag on every page (usually a shared footer template).',
    ],
  },
};

export function checklist(firmName, rqNumber, originalNumbers) {
  const rq = fmtPhone(rqNumber);
  const old = originalNumbers.length ? originalNumbers.map(fmtPhone).join(', ') : 'their current office number';
  return [
    `Google Business Profile: change the primary phone number to ${rq}. Keep ${old} as an additional number so Google still matches the business. Google may ask to re-verify.`,
    `Office phone: forward ${old} to ${rq} (forward all calls) through the firm's phone provider. This catches people who call from old ads, cards, signage and directories.`,
    `Other listings: update Yelp, Avvo, Justia, FindLaw, Martindale, Facebook and the state bar profile to ${rq} where possible.`,
    `Test: open the website on a phone, confirm ${rq} shows everywhere, tap the call button, and confirm it rings the Live Service 24/7 desk as ${firmName}.`,
  ];
}
