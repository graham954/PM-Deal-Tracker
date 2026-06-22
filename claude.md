# Member Deals Search Tool — CLAUDE.md

## Project Overview
A hosted web app that lets a sales associate quickly search current member-pricing deals by keyword, category, or SKU during a customer conversation. Deal data is scraped from the store's member deals page and written to `deals.json`. The site is deployed to Vercel so it can be opened from the work computer.

## Goals
- Instantly surface member-priced products during customer conversations
- Make savings (dollar and percentage) obvious to help pitch the membership
- Keep deal data fresh with minimal manual effort

## Architecture & Hosting
- **Hosted on Vercel** as a static site, reached by URL from the work computer.
- **Scraping happens on the personal laptop.** The work computer only views the deployed site.
- **Data is stored in `deals.json`** committed to the repo and deployed with the site — NOT in `localStorage`. localStorage is per-device and per-origin, so it cannot carry data from the laptop scrape to the work computer. `index.html` fetches `deals.json` at runtime.
- The page also caches the fetched `deals.json` in `localStorage` as a fallback if the network is briefly unavailable.

## Tech Stack
- **Frontend:** Single HTML file (vanilla JS, no framework), plus `deals.json`
- **Data:** Static `deals.json` fetched by the page
- **Scraper:** A Chrome extension kept locally on the laptop (not committed to this repo) that reads the member deals list DOM directly and exports `deals.json` — exact prices, all pages, no OCR.
- **Hosting:** Vercel (static deploy)
- **No backend/database required**

## Features

### Search Tool (Website)
- **Search bar** — matches product name, category, and **SKU** (paste a SKU to find an item), live filtering as you type
- **"In stock" filter** — independent toggle that shows only items available for pickup at **Lexington (in 1 hr / today)** or in stock at the **Charlotte Warehouse**. Combines with category + search.
- **Category filter buttons:** TVs, Laptops & Computers, Appliances, Audio, Other (plus an "All" view)
- **Deal cards** showing: product name, regular price, member price, dollar + percentage savings, pickup availability, and **SKU**
- **"Last updated" timestamp** so the associate knows how fresh the data is
- Clean branded styling (blue/yellow palette, scannable cards)
- Graceful empty state when no deals match / no data loaded yet

## File Structure
```
PM Deal Tracker/
├── claude.md          # This file — project instructions
├── index.html         # The associate-facing search tool UI
├── deals.json         # Scraped deal data (deployed with the site)
└── scraper.md         # Notes on the scraping workflow
```
(The scraper Chrome extension is kept locally and is not part of this repo.)

## How to Run a Refresh (Weekly Workflow)
1. On the **personal laptop**, log in and set the store to **Lexington**, then open the member deals list (page 1).
2. Click the scraper extension → **Scan all pages** → it downloads an updated `deals.json`.
3. Replace `deals.json` in the project with the new file.
4. Deploy: `git push` (Vercel auto-deploy) or `vercel --prod`.
5. Open/refresh the Vercel URL on the work computer — deals are current.

## Data Schema
`deals.json` is an array of deal objects:
```json
[
  {
    "id": "sku-6526125",
    "name": "Product Name",
    "category": "TVs",
    "regularPrice": 149.99,
    "memberPrice": 129.99,
    "dollarSavings": 20.00,
    "percentSavings": 13,
    "inStock": true,
    "pickup": "Pick up in 1 hour at Lexington, Columbiana Mall and 4 other stores",
    "lastUpdated": "2026-06-22"
  }
]
```
- `id` — `sku-<skuId>` when available (the numeric part is shown/searchable on the card).
- Valid categories: `TVs`, `Laptops & Computers`, `Appliances`, `Audio`, `Other`.
- `inStock` — `true` only when pickup is at **Lexington (in 1 hr / today)** OR in stock at the **Charlotte Warehouse**. Items only available at other stores are `false`.
- `regularPrice` / `dollarSavings` / `percentSavings` may be `null` when no comparable value is shown; the card then displays just the member price.

## Notes & Constraints
- The associate must be logged in **before** scraping; the tooling never handles login credentials.
- There is no public API for member deals — reading the live page is the only automated option.
- Deals typically refresh weekly — plan to re-scrape on Mondays.
