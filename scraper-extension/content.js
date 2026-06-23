/*
 * Member Deals Scraper — content script
 *
 * Runs on every bestbuy.com page, but only DOES anything when a scan is
 * active (started from the popup). When active it:
 *   1. waits for the deal cards to render
 *   2. extracts every deal on the current page (reads the DOM text directly)
 *   3. follows the "next page" link and repeats until the last page
 *   4. stores everything in chrome.storage so it survives page reloads
 *   5. on the last page, finalizes + (best-effort) auto-downloads deals.json
 *
 * The popup can always download the collected JSON manually too.
 */

const SCAN_KEY = "bbMemberDealsScan";

/* -------- selector config (the only the store-specific bit) -------- */
// Card containers are tried in order; first one that matches >3 elements wins.
// If the store changes their markup, only this list needs updating.
const CARD_SELECTORS = [
  "li.sku-item",
  ".sku-item-list .sku-item",
  "ol.sku-item-list > li",
  '[data-testid="list-item"]',
  "main li[data-test-sku]",
  'li[class*="product-list-item"]'
];

/* ----------------------------- helpers ----------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getState() {
  return (await chrome.storage.local.get(SCAN_KEY))[SCAN_KEY] || null;
}
async function setState(s) {
  await chrome.storage.local.set({ [SCAN_KEY]: s });
}

function money(str) {
  if (!str) return null;
  const m = String(str).replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1]) : null;
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function categorize(name) {
  const n = name.toLowerCase();
  if (/\b(tv|oled|qled|mini-?led|uled|fire tv|google tv|roku tv)\b/.test(n) &&
      !/(mount|stand|antenna|remote)\b/.test(n)) return "TVs";
  if (/(laptop|macbook|chromebook|desktop|imac|tablet|ipad|galaxy tab|monitor|keyboard|mouse|webcam|ssd|hard drive|hdd|external drive|\bram\b|memory|router|wi-?fi|mesh|range extender|printer|\bink\b|toner|surface|stylus|pencil)\b/.test(n)) return "Laptops & Computers";
  if (/(refrigerator|fridge|washer|dryer|dishwasher|range|oven|microwave|vacuum|air purifier|humidifier|\bfan\b|juicer|blender|coffee|air fryer|cooktop|freezer|styler|hair dryer)\b/.test(n)) return "Appliances";
  if (/(headphone|headset|earbud|earphone|speaker|soundbar|sound bar|\baudio\b|microphone|airpods|beats|\bmic\b)\b/.test(n)) return "Audio";
  return "Other";
}

// in stock = Lexington pickup (1 hr / today) OR Charlotte Warehouse
function deriveStock(pickup) {
  const p = (pickup || "").toLowerCase();
  const charlotte = /charlotte warehouse/.test(p);
  const lexNow = /lexington/.test(p) && /(1 hour|1 hr|today)/.test(p);
  return charlotte || lexNow;
}

function findCards() {
  // the store "brix" search results: each product is <li data-testid="<skuId>">.
  const lis = [...document.querySelectorAll("li[data-testid]")].filter((li) =>
    /^\d{5,}$/.test(li.getAttribute("data-testid") || "")
  );
  if (lis.length) return lis;
  // fallback: any <li> that contains a price block
  return [...document.querySelectorAll("li")].filter((li) =>
    li.querySelector('[data-testid="price-block"], [data-testid="price-block-customer-price"]')
  );
}

// lines that are badges/labels/ratings — never the product name
const NAME_BADGE = /^(best selling|trending deal|overall pick|clearance|top deal|deal of the day|only at best buy|free delivery|free installation|free shipping|recycle and save|save \$?\d|sponsored|pre-?order|member exclusive|hot deal|reduced price|today only|new\b)/i;
const NAME_LABEL = /^(rating\b|plus member|member price|comp\.?|the comparable|more buying|from \$|\+ ?\d|pick ?up|pickup|get it|sold out|add to cart|compare\b|see (more|details)|out of \d|\(?\d[\d,]* ?reviews?\)?$|\$|\d+(\.\d+)?$)/i;

function parseCard(el) {
  const text = (el.innerText || "").replace(/ /g, " ");

  // strip financing amounts like "$80.84/mo." so they're never picked as a price
  const clean = text.replace(/\$\s?[\d,]+\.\d{2}\s*\/\s*mo\.?/gi, " ");
  const lines = clean.split("\n").map((s) => s.trim()).filter(Boolean);

  // name: prefer a heading element; else the longest "real" text line
  let name = "";
  const h = el.querySelector('h2, h3, h4, [data-testid*="title" i]');
  if (h && /[a-z]/i.test(h.textContent) && h.textContent.trim().length > 6) {
    name = h.textContent.trim().replace(/\s+/g, " ");
  } else {
    const cands = lines.filter(
      (l) => /[a-z]/i.test(l) && l.length >= 8 && !NAME_BADGE.test(l) && !NAME_LABEL.test(l)
    );
    name = (cands.sort((a, b) => b.length - a.length)[0] || lines[0] || "").replace(/\s+/g, " ");
  }
  if (!name) return null;

  // prices via the labels the store renders on each card
  const memberPrice = money((clean.match(/plus member price\s*\$?\s*([\d,]+\.\d{2})/i) || [])[1]);
  const regularPrice = money((clean.match(/comp\.?\s*value:?\s*\$?\s*([\d,]+\.\d{2})/i) || [])[1]);
  const saveAmt = money((clean.match(/save\s*\$?\s*([\d,]+(?:\.\d{2})?)/i) || [])[1]);

  // member price is the headline deal price; if the label isn't found,
  // fall back to the first (non-financing) $ amount on the card.
  let member = memberPrice;
  if (member == null) member = money((clean.match(/\$\s?([\d,]+\.\d{2})/) || [])[1]);
  if (member == null) return null;

  // pickup / availability line
  let pickup = "";
  for (const line of lines) {
    if (/^(pick ?up|get it|sold out|available|in stock)/i.test(line)) { pickup = line; break; }
  }

  // savings: prefer explicit "Save $X", else derive from comp value
  let dollarSavings = saveAmt;
  let regular = regularPrice;
  if (dollarSavings == null && regular != null) dollarSavings = +(regular - member).toFixed(2);
  if (regular == null && dollarSavings != null) regular = +(member + dollarSavings).toFixed(2);
  const percentSavings =
    regular && dollarSavings != null ? Math.round((dollarSavings / regular) * 100) : null;

  const sku = el.getAttribute("data-testid");

  return {
    id: /^\d{5,}$/.test(sku || "") ? `sku-${sku}` : slug(name),
    name,
    category: categorize(name),
    regularPrice: regular ?? null,
    memberPrice: member,
    dollarSavings: dollarSavings ?? null,
    percentSavings,
    inStock: deriveStock(pickup),
    pickup: pickup || null,
    lastUpdated: new Date().toISOString().slice(0, 10)
  };
}

function extractDeals() {
  return findCards().map(parseCard).filter((d) => d && d.name && d.memberPrice != null);
}

function findNextPageUrl() {
  const sels = [
    "a.sku-list-page-next",
    'a[aria-label*="next page" i]',
    'a[aria-label="Next"]',
    'a[rel="next"]',
    '.pagination a[aria-label*="Next" i]'
  ];
  for (const s of sels) {
    const a = document.querySelector(s);
    if (a && a.href && a.getAttribute("aria-disabled") !== "true") return a.href;
  }
  // fallback: bump the ?cp= page param
  try {
    const u = new URL(location.href);
    const cur = parseInt(u.searchParams.get("cp") || "1", 10);
    u.searchParams.set("cp", String(cur + 1));
    return u.toString();
  } catch (e) {
    return null;
  }
}

async function waitForCards(maxMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (findCards().length > 3) return true;
    await sleep(400);
  }
  return findCards().length > 0;
}

// the store lazy-renders product cards as you scroll (and may unload off-screen
// ones), so scroll the whole page in steps and accumulate every card we see,
// deduped by SKU. Returns all deals on the current page.
async function collectCurrentPage(maxMs = 30000) {
  const bySku = new Map();
  const grab = () => {
    for (const d of extractDeals()) if (!bySku.has(d.id)) bySku.set(d.id, d);
  };
  grab();
  const start = Date.now();
  let atBottomStreak = 0;
  while (Date.now() - start < maxMs) {
    window.scrollBy(0, Math.round(window.innerHeight * 0.85));
    await sleep(450);
    grab();
    const atBottom =
      window.innerHeight + window.scrollY >= document.body.scrollHeight - 4;
    if (atBottom) {
      atBottomStreak++;
      if (atBottomStreak >= 3) break; // settled at the bottom
    } else {
      atBottomStreak = 0;
    }
  }
  window.scrollTo(0, 0);
  await sleep(300);
  grab();
  return [...bySku.values()];
}

function downloadJson(text, filename) {
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    /* popup can still download from storage */
  }
}

function dedupe(deals) {
  const seen = new Map();
  for (const d of deals) if (!seen.has(d.id)) seen.set(d.id, d);
  return [...seen.values()];
}

/* ----------------------------- main loop --------------------------- */

(async function main() {
  const state = await getState();
  if (!state || !state.active) return; // not scanning — do nothing

  await waitForCards();
  const pageDeals = await collectCurrentPage();

  state.deals = (state.deals || []).concat(pageDeals);
  state.pagesScanned = (state.pagesScanned || 0) + 1;
  state.lastCount = pageDeals.length;
  state.visited = (state.visited || []).concat([location.href]);

  const nextUrl = findNextPageUrl();
  const more =
    pageDeals.length > 0 &&
    nextUrl &&
    !state.visited.includes(nextUrl) &&
    state.pagesScanned < (state.maxPages || 20);

  if (more) {
    await setState(state);
    await sleep(800 + Math.random() * 600); // be gentle
    location.href = nextUrl;
  } else {
    state.active = false;
    state.done = true;
    state.deals = dedupe(state.deals);
    await setState(state);
    downloadJson(JSON.stringify(state.deals, null, 2), "deals.json");
  }
})();
