# Best Buy Member Deals Search Tool — CLAUDE.md

## Project Overview
A hosted web app that lets a Best Buy employee quickly search current My Best Buy+ member pricing deals by keyword or category during a customer conversation. Claude Code scrapes deal data from the Best Buy member deals page in Chrome (on the employee's personal laptop) and writes it to `deals.json`. The site is deployed to Vercel so it can be opened from the work computer.

## Goals
- Instantly surface member-priced products during customer conversations
- Make savings (dollar and percentage) obvious to help pitch memberships
- Keep deal data fresh with minimal manual effort

## Architecture & Hosting
- **Hosted on Vercel** as a static site, reached by URL from the work computer.
- **Scraping happens on the personal laptop** (where Claude Code + Chrome run). The work computer only views the deployed site.
- **Data is stored in `deals.json`** committed to the repo and deployed with the site — NOT in `localStorage`. localStorage is per-device and per-origin, so it cannot carry data from the laptop scrape to the work computer. `index.html` fetches `deals.json` at runtime.
- Optional: cache the fetched `deals.json` in `localStorage` as a fallback if the network is briefly unavailable.

## Tech Stack
- **Frontend:** Single HTML file (vanilla JS, no framework), plus `deals.json`
- **Data:** Static `deals.json` fetched by the page
- **Scraper:** Chrome extension (`bestbuy-deals-extension/`) that reads the member deals DOM directly and exports `deals.json`. Preferred over screenshots — exact prices, all 18 pages, no OCR.
- **Hosting:** Vercel (static deploy)
- **No backend/database required**

## Features

### Search Tool (Website)
- **Keyword search bar** — matches against product name and category, live filtering as you type
- **"In stock" filter** — independent toggle that shows only items available for pickup at **Lexington (in 1 hr / today)** or in stock at the **Charlotte Warehouse**. Combines with category + search.
- **Category filter buttons:** TVs, Laptops & Computers, Appliances, Audio, Other (plus an "All" view)
- **Deal cards** showing:
  - Product name
  - Regular price
  - Member price
  - Dollar savings + percentage savings (visually emphasized)
- **"Last updated" timestamp** so the employee knows how fresh the data is
- Best Buy branded styling (blue/yellow palette, clean scannable cards)
- Graceful empty state when no deals match / no data loaded yet

### Scraper (Claude Code)
- Connects to the open Chrome tab showing Best Buy member deals
- Scrolls through the full deals page (handles lazy-loaded content)
- Screenshots and extracts: product name, regular price, member price, category
- Computes dollar savings and percent savings
- Writes clean JSON to `deals.json` in the correct schema

## File Structure
```
PM Deal Tracker/
├── claude.md          # This file — project instructions for Claude Code
├── index.html         # The employee-facing search tool UI
├── deals.json         # Scraped deal data (deployed with the site)
└── scraper.md         # Instructions for the Claude Code browser scraping session
```

## How to Run a Refresh (Weekly Workflow)
1. On the **personal laptop**, open the Best Buy member deals page in Chrome (logged in to the store account).
2. Open this project in Claude Code (VS Code) with Claude in Chrome active.
3. Tell Claude: **"Scrape the deals tab and update the deals data."**
4. Claude scrolls, screenshots, extracts, and writes updated `deals.json`.
5. Deploy to Vercel: `git push` (auto-deploy) or `vercel --prod`.
6. Open/refresh the Vercel URL on the work computer — deals are current.

## Data Schema
`deals.json` is an array of deal objects:
```json
[
  {
    "id": "unique-id",
    "name": "Product Name",
    "category": "TVs",
    "regularPrice": 999.99,
    "memberPrice": 799.99,
    "dollarSavings": 200.00,
    "percentSavings": 20,
    "inStock": true,
    "pickup": "Lexington — pickup in 1 hr",
    "lastUpdated": "2026-06-22"
  }
]
```
Valid categories: `TVs`, `Laptops & Computers`, `Appliances`, `Audio`, `Other` (anything that doesn't fit the first four — games, toys, smart home, automotive, etc.).

- `inStock` — `true` only when the item shows pickup at **Lexington (in 1 hr or today)** OR is in stock at the **Charlotte Warehouse**. Items only available at other stores (Columbiana Mall, Augusta, Spring Valley, Blakeney, etc.) are `false`.
- `pickup` — short human-readable availability string shown on the card, e.g. `"Lexington — pickup in 1 hr"`, `"Charlotte Warehouse — pickup in 1 hr"`, or `"Columbiana Mall +5 (not Lexington)"`.

## Notes & Constraints
- Employee must be logged into the Best Buy account in Chrome **before** scraping.
- Claude Code should **never** handle login credentials.
- Best Buy has no public API for member deals — scraping the live page is the only automated option.
- Deals typically refresh weekly — plan to re-scrape on Mondays.
