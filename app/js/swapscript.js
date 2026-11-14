// ============================================================
// Phone number swap script generator.
// Builds the per-firm snippet that replaces the firm's own phone
// numbers (text and click-to-call links) with their ReplyQuick
// number, plus install steps for the firm's website platform.
// ============================================================
import { fmtPhone } from './store.js';

const digits10 = (e164) => String(e164).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

export function buildScript({ firmName, originalNumbers, rqNumber, catchAll }) {
  const swap = {};
  originalNumbers.forEach(n => { const d = digits10(n); if (d.length === 10) swap[d] = { display: fmtPhone(rqNumber), dial: rqNumber }; });
  const swapJson = JSON.stringify(swap, null, 4).replace(/\n/g, '\n  ');
  const catchJson = catchAll ? JSON.stringify({ display: fmtPhone(rqNumber), dial: rqNumber }) : 'null';
  const safeName = String(firmName).replace(/[^\w &.,'-]/g, '');

  return String.raw`<!-- ReplyQuick number swap for ${safeName} -->
<script>
(function () {
  // Original number (10 digits) mapped to the ReplyQuick number.
  var SWAP = ${swapJson};

  // Catch-all: replace ANY US phone number on the site (null = off).
  var CATCH_ALL = ${catchJson};

  var PHONE_RE = /(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g;
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1 };

  function normalize(raw) {
    var d = String(raw).replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    return d.length === 10 ? d : null;
  }
  function lookup(raw) {
    var d = normalize(raw);
    if (!d) return null;
    return SWAP[d] || CATCH_ALL;
  }
  function swapTextNode(node) {
    var parent = node.parentNode;
    if (!parent || SKIP[parent.nodeName]) return;
    var text = node.nodeValue;
    var out = text.replace(PHONE_RE, function (match) {
      var r = lookup(match);
      return r ? r.display : match;
    });
    if (out !== text) node.nodeValue = out;
  }
  function swapLink(a) {
    var href = a.getAttribute("href") || "";
    var m = href.match(/^(tel|sms):(.*)$/i);
    if (!m) return;
    var r = lookup(decodeURIComponent(m[2]));
    var newHref = r ? m[1] + ":" + r.dial : href;
    if (r && newHref !== href) a.setAttribute("href", newHref);
  }
  function process(root) {
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
  function start() {
    process(document.body);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mu) {
        if (mu.type === "characterData") swapTextNode(mu.target);
        else if (mu.type === "attributes") swapLink(mu.target);
        else mu.addedNodes.forEach(process);
      });
    }).observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["href"]
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>`;
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
      'Instead: update the phone number in the site header, footer and contact sections by hand to the ReplyQuick number.',
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
    `Test: open the website on a phone, confirm ${rq} shows everywhere, tap the call button, and confirm it rings the ReplyQuick desk as ${firmName}.`,
  ];
}
