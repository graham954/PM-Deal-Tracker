# Member Deals Scraper (Chrome extension)

Scrapes **every page** of the member deals list by reading the page's
actual text (no screenshots, no OCR) and exports a `deals.json` in the exact schema
the Member Deals Search tool uses.

## Install (one time)
1. Open Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `scraper-extension` folder.
4. Pin the extension (puzzle-piece icon → pin) so you can click it easily.

## Use (each refresh)
1. Log in to the store and set your store to **Lexington** (so pickup/availability text
   reflects your store).
2. Open the **member deals list on page 1**.
3. Click the extension → set **Max pages** (e.g. 20 to cover all 18) → **Scan all pages**.
4. It pages through automatically (keep the tab open). When it finishes it downloads
   `deals.json`. If the auto-download is blocked, reopen the popup and click
   **Download collected JSON**.
5. Replace `deals.json` in the project with the new file (or hand it to Claude Code to merge),
   then redeploy to Vercel.

## What it captures per deal
`id, name, category, regularPrice, memberPrice, dollarSavings, percentSavings, inStock, pickup, lastUpdated`

- **category** is auto-classified (TVs / Laptops & Computers / Appliances / Audio / Other) from the name.
- **inStock** is `true` when the card shows Lexington pickup (1 hr / today) or Charlotte Warehouse.
- **pickup** is the raw availability line from the card.

## If it collects 0 deals (the store changed their markup)
The card selectors live at the top of `content.js` (`CARD_SELECTORS`). To fix them, open the
member deals page, open DevTools console, and run:

```js
copy(document.querySelector('li.sku-item, .sku-item, [data-testid="list-item"]')?.outerHTML || 'NONE')
```

That copies one deal card's HTML to your clipboard. Paste it to Claude Code and the
selectors will be updated to match.

## Notes
- The extension never handles your login — you must already be signed in.
- It only acts when you press **Scan**; otherwise it does nothing.
- A small random delay is added between pages to be gentle on the site.
