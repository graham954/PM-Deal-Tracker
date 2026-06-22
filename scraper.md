# Scraping Workflow

Deal data in `deals.json` is produced by a small Chrome extension kept locally on the
laptop (it is **not** part of this repo). The extension reads the member deals list
directly from the page DOM — exact prices, every page, no screenshots or OCR.

## How a refresh works
1. Log in and set the store to **Lexington**, then open the member deals list (page 1).
2. Click the extension → **Scan all pages**. It scrolls each page to load all cards,
   pages through the whole list, and downloads a fresh `deals.json`.
3. Replace `deals.json` in this project with the downloaded file.
4. Deploy: `git push` (Vercel auto-deploy) or `vercel --prod`.

## What it captures per deal
`id` (`sku-<skuId>`), `name`, `category` (auto-classified), `regularPrice`,
`memberPrice`, `dollarSavings`, `percentSavings`, `inStock`, `pickup`, `lastUpdated`.

- `inStock` is `true` when pickup is at **Lexington (1 hr / today)** or the **Charlotte Warehouse**.
- `regularPrice` / savings may be `null` when no comparable value is shown; the card then
  displays just the member price.

## Constraints
- The associate must be logged in **before** scanning; the tooling never handles credentials.
- There is no public API for member deals — reading the live page is the only automated option.
- Deals typically refresh weekly — re-scan on Mondays.
