# TGD Dumpster Pricing Sheet

## Overview
Internal pricing lookup and quote builder tool for **The Green Dumpster** — a dumpster rental company serving the greater Los Angeles / Southern California area. Used by Customer Service Representatives (CSRs) to instantly look up zone-based pricing by zip code, build itemized quotes, and send them to customers via automated email/SMS through GoHighLevel (GHL).

## Tech Stack
- **React 18** (CDN-loaded via `react.production.min.js`)
- **Babel Standalone** (in-browser JSX transpilation)
- **Single-file app** — all logic lives in `index.html` (no build step, no bundler)
- **GoHighLevel (GHL) webhook** for quote delivery (email + SMS)
- **Branded HTML email template** — `email-template.html`

## Project Structure
```
TGD-Dumpster-PRICING-SHEET/
├── index.html              # Entire app — React components, zone data, pricing logic, CSV export
├── email-template.html     # GHL-triggered branded email template for customer quotes
├── google-sheet-script.js  # Google Apps Script — paste into Sheets for auto-logging quotes
└── CLAUDE.md
```

## How It Works

### Zip Code Lookup
- CSR enters a 5-digit zip code
- App maps it to one of **18 service zones** via `ZIP_MAP` (built from `ZONES` array)
- Zones cover: Valley, South Valley, South West, East Valley, LA, Far East Valley, Beach, Far West, SCV, and outsourced partner zones (Avel, Budget, Monarch, Red Box, Rent A Bin, Heritage)

### Zone Types
- **In-House** — serviced by TGD's own fleet (supports discounts)
- **Outsourced** — serviced by partner haulers (no discounts, shows hauler name/phone)
- **NEED HAULER** — no hauler assigned, cannot book without owner approval
- **Junk Removal Only** — no dumpster pricing, junk removal service only

### Pricing Structure
Each zone has pricing for multiple bin sizes:
- **3 Yard**, **3 Yard w/ Wheels**, **9 Yard**, **10 Yard Clean** (inert materials), **10 Yard** (mixed trash), **12 Yard**, **16 Yard**, **25 Yard**, **40 Yard**
- Each bin has: `cp` (contractor price), `ct` (contractor tons), `rp` (residential price), `rt` (residential tons), `days` (rental period), `xtra` (extra day fee), `over` (overload rate), `disc` (max discount)
- `null` price = bin not available in that zone

### Quote Builder
- CSR selects their name, enters customer info (name, phone, optional email)
- Picks bin size(s), adjusts quantity (1-10), applies discounts (in $5 increments up to max)
- Sends quote payload to GHL webhook → triggers automated email + SMS to customer
- Webhook URL: `GHL_WEBHOOK_URL` constant at top of file

### Discount System (In-House zones only)
- **Per-bin discounts** — each bin has a `disc` field (max dollar discount allowed)
- **Multi-Bin 3 Yard Deal** — some zones offer $X off each bin when customer rents 2x 3-Yard bins
- **Extended Rental** — up to 2 free extra days beyond standard rental period
- Discounts are a *closing tool*, not an opener — only offer if customer is hesitant

### Estimate Numbers
- Every quote gets a unique estimate number in format `TGD-YYYYMMDD-XXXX` (e.g., `TGD-20260320-4827`)
- Generated at send time via `generateEstimateNumber()` function
- Included in GHL webhook payload as `estimate_number`
- Displayed on the "Quote Sent!" success screen for CSR reference
- Shown prominently in the customer email template

### Google Sheet Logging
- Quotes auto-log to a Google Sheet via Google Apps Script web app
- **Setup**: `GOOGLE_SHEET_URL` constant at top of `index.html` (next to `GHL_WEBHOOK_URL`)
- Fire-and-forget POST — won't block the UI or cause errors if it fails
- **Sheet columns**: Estimate #, Date/Time, CSR, Customer Name, Phone, Email, Zip, Zone, Customer Type, Bin Details, Total Quote, Total Discounts
- Script file: `google-sheet-script.js` — paste into Google Sheets Apps Script editor

### Hidden Features
- **Docket CSV Export** — type zip `99999` to reveal export button; generates a full pricing matrix CSV for Docket import

## Key Components (all in index.html)
| Component | Purpose |
|-----------|---------|
| `App` | Main shell — zip input, zone display, pricing table, tab switching |
| `QuoteBuilder` | Multi-bin quote form with discounts, quantities, GHL webhook send |
| `DiscountPanel` | Expandable panel showing available discounts per zone |
| `InfoChip` | Small badge component for dry run fees, truck adjustments |
| `exportDocketCSV()` | Generates Docket-compatible CSV from all zone pricing data |

## Email Template (`email-template.html`)
- MJ/MJML-compatible responsive HTML email
- Uses GHL template variables: `{{inboundWebhookRequest.customer_name}}`, `{{inboundWebhookRequest.quote_summary_html}}`, `{{inboundWebhookRequest.total_quote}}`, `{{inboundWebhookRequest.csr_name}}`, etc.
- Brand colors: green `#1B8C2A`, dark green `#1a3a1a`, accent `#2ECC40`
- Company phone: (818) 404-5865
- Company address: 9909 Topanga Cyn Blvd #272 Chatsworth, CA 91311

## CSR Team
Evelyn, Tais, Emely, Kevin, CJ, Luis, Felix, Yuly, Dory, Dustin, Clint — each mapped to their @thegreendumpster.com email in `CSR_EMAILS`.

## Development Notes
- No build step — edit `index.html` directly, refresh browser
- All zone/pricing data is hardcoded in the `ZONES` array (starts ~line 47)
- To add a new zone: add an object to `ZONES` with `name`, `zips`, `pricing`, `service`, etc.
- To add a new zip code: add it to the appropriate zone's `zips` array
- To update pricing: modify the `cp`/`rp` values in the zone's `pricing` array
- Brand palette: dark bg `#0a0f0a`, green accents `#22c55e`/`#4ade80`, muted green text `#6b8f6b`/`#4a6b4a`

## Pricing Strategy
- Pricing is tied to fuel costs — baseline fuel price: **$5.50/gal**
- As of 2026-03-26, fuel is **$7.09/gal** ($1.59 increase, ~29%)
- Only in-house zone pricing is within TGD's control; outsourced zones are set by partner haulers

## Recent Changes
- **2026-03-26**: Raised minimum overage rate to $120/Ton across ALL zones (in-house + outsourced) for 9yd+ bins. Heritage zones stay at $125/Ton (already above minimum). 3yd bins stay at $16/100 Lb everywhere. Updated BIN_CONFIG desc strings and overCol to match. Updated 10yd/10yd Clean inHouse desc: general trash $120/ton, C&D $130/ton. Updated getOverCol fallback to 120.
- Added unique estimate numbers (TGD-YYYYMMDD-XXXX) to every quote — shown in app, email, and GHL payload
- Added Google Sheet auto-logging via Apps Script — every sent quote logs to a spreadsheet for team reference
- (Initial CLAUDE.md creation — March 2026)
