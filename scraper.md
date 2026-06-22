# Scraper Instructions — Best Buy Member Deals

These are the instructions Claude Code follows when the user says:
**"Scrape the deals tab and update the deals data."**

## Goal
Read the current My Best Buy+ member deals from the open Chrome tab and overwrite `deals.json`
in this project with the latest deals, in the exact schema below.

## Preconditions (the employee handles these — Claude does NOT)
- The employee is already **logged in** to the Best Buy store account in Chrome.
- The Best Buy member deals page is **already open** in a Chrome tab.
- Claude Code must **never** enter, request, or store login credentials.

## Steps
1. **Connect** to the open Chrome tab showing the Best Buy member deals page (Claude in Chrome).
2. **Scroll** the page from top to bottom in steps, allowing lazy-loaded deals to render. Take a
   screenshot after each scroll step so the full list is captured. Keep scrolling until the bottom
   of the deal list is reached (no new products appear).
3. **Extract** from the screenshots, for every deal:
   - `name` — full product name as shown
   - `regularPrice` — the **Comp. Value** (regular/non-member price), as a number
   - `memberPrice` — the **Plus Member Price**, as a number
   - `category` — map the product to ONE of: `TVs`, `Laptops & Computers`, `Appliances`,
     `Audio`, `Other`. Use `Other` for anything that doesn't fit the first four (games, toys,
     smart home, automotive keys, etc.). Note any ambiguous ones to the user.
   - **Availability** — read the green pickup line on each card. This drives `inStock` + `pickup`.
4. **Determine availability** for each deal:
   - `inStock` = `true` if the card shows pickup at **Lexington** ("Pick up in 1 hour at Lexington"
     or "Pick up today at Lexington") OR the item is in stock at the **Charlotte Warehouse**.
     Otherwise `false` (only available at other stores like Columbiana Mall, Augusta, Spring Valley, Blakeney).
   - `pickup` = a short string summarizing that line, e.g. `"Lexington — pickup in 1 hr"`,
     `"Charlotte Warehouse — pickup in 1 hr"`, `"Columbiana Mall +5 (not Lexington)"`.
5. **Compute** for each deal:
   - `dollarSavings` = `regularPrice - memberPrice` (rounded to 2 decimals)
   - `percentSavings` = `round(dollarSavings / regularPrice * 100)` (whole number)
   - `id` = a stable unique slug from the name (e.g. lowercase, hyphenated, e.g. `samsung-65-qn90d`)
   - `lastUpdated` = today's date in `YYYY-MM-DD`
5. **Write** the full array to `deals.json`, **overwriting** the previous contents (do not append).
6. **Report** to the user: how many deals were captured, the date set, and any items whose category
   or price was uncertain.

## Output Schema (`deals.json`)
A JSON array. Each element:
```json
{
  "id": "samsung-65-qn90d",
  "name": "Samsung 65\" Class QN90D Neo QLED 4K Smart TV",
  "category": "TVs",
  "regularPrice": 1799.99,
  "memberPrice": 1499.99,
  "dollarSavings": 300.00,
  "percentSavings": 17,
  "inStock": true,
  "pickup": "Lexington — pickup in 1 hr",
  "lastUpdated": "2026-06-22"
}
```
- Prices are **numbers**, not strings (no `$` or commas).
- `category` must be exactly one of the five valid values (`TVs`, `Laptops & Computers`,
  `Appliances`, `Audio`, `Other`).
- `inStock` is a boolean; `pickup` is the short availability string.

## Reading from screenshots (current method)
Browser automation ("Claude in Chrome") is not wired into this Claude Code session, so the live
workflow is **screenshot-based**: the employee saves zoomed-in screenshots of the deal cards into
the `screenshots/` folder, and Claude reads them with vision. Wide full-page grid captures are
usually too low-resolution to read reliably — **zoom in so each card's price and the green pickup
line are legible.** Claude will only extract deals it can read clearly and will flag anything uncertain.

## Quality Checks Before Saving
- No duplicate `id`s.
- Every deal has both `regularPrice` and `memberPrice`, and `memberPrice` < `regularPrice`.
- `dollarSavings` and `percentSavings` are internally consistent with the two prices.
- The file is valid JSON (it will fail to load in the site otherwise).

## After Scraping (employee does this)
1. Review the reported summary.
2. Deploy to Vercel: `git push` (auto-deploy) or `vercel --prod`.
3. Refresh the Vercel URL on the work computer — deals are now current.
