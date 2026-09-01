# TGD Dumpster Pricing Sheet

## Overview
Internal pricing lookup and quote builder tool for **The Green Dumpster** — a dumpster rental company serving the greater Los Angeles / Southern California area. Used by Customer Service Representatives (CSRs) to instantly look up zone-based pricing by zip code, build itemized quotes, and send them to customers via automated email/SMS through GoHighLevel (GHL).

## ⚠️ Read This First — Rules That Prevent Real Damage

**1. ALWAYS `git fetch` before you edit anything.**
The owner edits `index.html` directly in the GitHub web editor. Local clones go stale without warning.
This has already caused a near-miss: a June 2026 web edit added CSR "John P." to `CSR_NAMES`/`CSR_EMAILS`,
and a local branch built on the pre-edit commit would have silently deleted him on merge. Fetch, rebase
onto current `main`, *then* work.

**2. A zip code must live in exactly ONE zone.**
`ZIP_MAP` is built by iterating `ZONES` top-to-bottom and overwriting:
```js
ZONES.forEach(z => z.zips.forEach(zip => { ZIP_MAP[zip] = z; }));
```
There is no collision check. If two zones list the same zip, **the one later in the `ZONES` array
silently wins** — purely an accident of file position. This produced a real bug: 92782 (Tustin) was in
both Avel Anaheim Zone 2 (index 12) and Irvine / South Orange (index 21), so CSRs got
"NO HAULER — Do NOT book" instead of Avel's real pricing. When moving a zip between zones,
**remove it from the old zone** — don't just add it to the new one.

**3. Pushing to `main` goes live to CSRs immediately.**
GitHub Pages serves `main` at https://kawiride027.github.io/TGD-Dumpster-PRICING-SHEET/.
There is no staging environment. Propagation takes ~60 seconds. Do not push without the owner's
explicit go-ahead — this is the live quoting tool the sales team reads prices from.

**4. Never change outsourced-zone pricing on your own.**
Only **In-House** zones are TGD's to price. Outsourced zones (Avel, Budget, Monarch, Red Box,
Rent A Bin, Heritage) carry rates set by the partner hauler. Changing them misquotes real jobs.

**5. Verify against live before pushing — diff every cell, not just the lines you touched.**
See "Verification Recipe" below. A pricing edit that accidentally moves a neighboring value is
invisible in a line diff but obvious in a cell-by-cell comparison.

## Data Conventions

Learned the hard way; violating these produces subtly wrong quotes.

- **`cp` vs `rp`** — In every in-house zone, contractor and residential prices are **identical** on
  3 Yard, 3 Yard w/ Wheels, and 9 Yard (one number per cell). They **diverge on 25 Yard and 40 Yard**,
  where residential is priced lower. Check before assuming a single value covers both.
- **`ct` vs `rt`** — Usually differ on 25/40 Yard (residential gets less included tonnage). **Exception:**
  TGD San Gabriel Valley Zone has `cp === rp` AND `ct === rt` on every bin, inherited from Heritage's
  flat pricing structure. Don't "normalize" it.
- **`disc` moves in $5 increments.** The quote builder steps discounts by $5, so any `disc` value must
  be a multiple of 5. `disc: 0` means no discounting allowed in that zone.
- **`cp: null` / `rp: null`** means that bin is not available in that zone — not free, not zero.
- **`zips` arrays are sorted ascending.** Keep them that way when adding.
- **New zones go with the in-house group**, before `TGD Junk Removal ONLY` in the `ZONES` array.
  Position matters (see rule 2).
- **Zone-level fields:** `multiBin3Yd: null` = no multi-bin deal. `miles` and `dryRunLg` scale with
  distance from the yard ($130 at 14 mi → $200 at 34+ mi).

## Pricing Change Methodology

- **The number that matters when raising prices is `(new price − disc)` vs the OLD price** — not `disc`
  vs the size of the increase. A $20 raise with a $20 max discount still nets a gain if the discounted
  floor lands above what customers paid before. Always compute the floor.
- **Round to the nearest dollar** unless told otherwise. Watch for values landing exactly on `.50`.
- Pricing is tied to fuel cost. The owner adjusts **per bin size and per zone**, not globally —
  expect requests like "raise just the 9yd 5% in all zones except SCV."
- **SCV Zone is a no-discount zone by design** (`disc: 0` on every bin). It's also frequently excluded
  from across-the-board raises. Confirm before including it. **Decided 2026-08-19:** SCV keeps
  `disc: 0` on 9 Yard — it was deliberately left out when 9 Yard discounts were normalized to $15 in
  the other eight in-house zones. Do not "fix" this for consistency; zero is intentional.
- **TGD San Gabriel Valley Zone is also `disc: 0` on every bin**, by design (see Recent Changes).

## Deploy & Verify Workflow

```
git fetch origin                     # ALWAYS first — see rule 1
git checkout -b <descriptive-branch>
# ...make changes...
# verify with the recipe below
git checkout main && git merge --ff-only <branch>
git push origin main                 # only with owner's explicit approval
# wait ~60s, then re-fetch the live URL and confirm
```
After a deploy, **tell the owner to have CSRs hard-refresh (Ctrl+Shift+R)** — the page is cached and
anyone with it already open keeps seeing stale prices.

### Verification Recipe

`ZONES` is a plain JS array literal, so it can be extracted and diffed directly:

```js
// extract ZONES from any version of index.html (local file or `git show origin/main:index.html`)
const s = fs.readFileSync(file, 'utf8');
const i = s.indexOf('const ZONES = ['), j = s.indexOf('
];', i);
fs.writeFileSync(tmp, s.slice(i, j + 3) + '
module.exports=ZONES;');
const ZONES = require(tmp);
```
Then compare live vs. local across every zone/bin/field (`bin, cp, ct, rp, rt, days, xtra, over, disc`)
and every zip. ~1,400 pricing cells total — the diff should contain *only* your intended changes.
Also rebuild `ZIP_MAP` the same way the app does and assert no zip resolves to an unexpected zone.

**Rendering:** run a local static server and check the app in a browser. Confirm no console errors,
then look up a zip in each changed zone. `zip 99999` reveals the hidden Docket CSV export button.

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
- App maps it to one of **22 service zones** covering **570 zip codes**, via `ZIP_MAP` (built from the `ZONES` array). The app displays this count in its own footer — cross-check it after any zip change.
- **In-House (10):** Valley, South Valley, South West, East Valley, LA, Far East Valley, Beach, Far West, SCV, San Gabriel Valley
- **Outsourced (10):** Avel LA Z1, Avel Anaheim Z2, Budget Z1, Monarch Z1, Red Box Z1, Rent A Bin Z2, Heritage SGV / IE West / San Bernardino / Banning-Beaumont
- **Other (2):** TGD Junk Removal ONLY, Irvine / South Orange (NEED HAULER)

### Zone Types
- **In-House** — serviced by TGD's own fleet (supports discounts)
- **Outsourced** — serviced by partner haulers (no discounts, shows hauler name/phone)
- **NEED HAULER** — no hauler assigned, cannot book without owner approval
- **Junk Removal Only** — no dumpster pricing, junk removal service only

### Pricing Structure
Each zone has pricing for multiple bin sizes:
- **3 Yard**, **3 Yard w/ Wheels**, **9 Yard**, **10 Yard Clean** (inert materials), **10 Yard** (mixed trash), **16 Yard**, **25 Yard**, **40 Yard**
- Two zone-specific bins: **12 Yard** (Avel zones only) and **10 Yard Mini** (Rent A Bin only). Bin lists are not uniform across zones — always read the zone's own `pricing` array.
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
Evelyn, Tais, Emely, Kevin, CJ, Luis, Felix, Yuly, Dory, John P., Dustin, Clint — each mapped to their @thegreendumpster.com email in `CSR_EMAILS`. Note `CSR_NAMES` and `CSR_EMAILS` are two separate constants; adding a CSR requires editing **both**.

## Development Notes
- No build step — edit `index.html` directly, refresh browser
- All zone/pricing data is hardcoded in the `ZONES` array (starts ~line 64). No database, no API — the array *is* the source of truth.
- To add a new zone: add an object to `ZONES` with `name`, `zips`, `pricing`, `service`, etc.
- To add a new zip code: add it to the appropriate zone's `zips` array
- To update pricing: modify the `cp`/`rp` values in the zone's `pricing` array
- Brand palette: dark bg `#0a0f0a`, green accents `#22c55e`/`#4ade80`, muted green text `#6b8f6b`/`#4a6b4a`

## Pricing Strategy
- Pricing is tied to fuel costs — baseline fuel price: **$5.50/gal**
- As of 2026-03-26, fuel is **$7.09/gal** ($1.59 increase, ~29%)
- Only in-house zone pricing is within TGD's control; outsourced zones are set by partner haulers

## Known Open Issues

- **90720** (Los Alamitos) — listed in both Avel LA Zone 1 and Avel Anaheim Zone 2. Resolves to
  Anaheim by array position. Both are Avel, but pricing differs. Needs an owner decision.
- **91789** (Walnut) — listed in both Avel Anaheim Zone 2 and Heritage - SGV. Two *different* haulers.
  Resolves to Heritage SGV. Needs an owner decision.
- **91014** — requested as an addition but left unmapped. Falls between Far East Valley
  (91011/91012 La Cañada) and Heritage SGV (91010/91016 Duarte/Monrovia) territory, and may not be an
  assigned USPS zip. Pending confirmation.
- **No pricing-change history file.** Change history currently lives only in git commits and the
  Recent Changes section below. A `PRICING-HISTORY.md` plus archived Docket CSV snapshots has been
  proposed but not built.

## Recent Changes
- **2026-08-19**: **10 Yard Clean repriced** in three in-house zones. Valley $628.00 → **$600** (`disc` $25 → **0**), East Valley $643.04 → **$600** (`disc` $50 → **0**), South Valley $672.98 → **$650** (`disc` $20 → **$10**). Far East Valley left alone at $807.66 / $50. Fixes an inversion where East Valley's larger discount let a farther zone quote below Valley ($593.04 vs $603.00). Valley and East Valley now match at a flat $600 with no discount; South Valley floors at $640. Tonnage (13T), days, xtra, and overage unchanged. Note these zones are NOT no-discount zones — other bins keep their `disc`, so 10 Yard Clean simply drops out of the max-discount chip list.
- **2026-08-19**: **New zone — TGD San Gabriel Valley Zone (In-House).** Took 7 zips back from Heritage SGV (Heritage service quality declined): 90031 Lincoln Heights, 90032 El Sereno, 91006/91007 Arcadia, 91776 San Gabriel, 91780 Temple City, 91803 Alhambra. All 7 removed from Heritage - SGV (31 → 24 zips) so there is no duplicate-zip collision. **Heritage's 4 prices carried over unchanged** (3yd w/Wheels $375, 10yd Clean $875, 25yd $885, 40yd $975) — existing customers see no change; the other 4 bins are new at Far East Valley +8% (3yd $338, 9yd $545, 10yd $680, 16yd $725). `cp === rp` and `ct === rt` on every bin, matching Heritage's flat structure rather than the residential split other TGD zones use. 40 mi, $200 dry run / -$70 sm truck, `disc: 0` on all bins, `multiBin3Yd: null`, $120/Ton (normalized from Heritage's $125). 10 Yard Clean gets the standard 8-day rental instead of Heritage's 5-day. First in-house zone with no discounts *and* no multi-bin deal, so it renders the "No Discounts This Zone" panel.
- **2026-08-19**: **Zip coverage update.** Removed all 12 Inglewood zips (90301–90312) from **Avel LA Zone 1** — Avel no longer services that city; zone drops 155 → 143 zips and all 12 now show "Zip code not found in service area." Added 91308 / 91332 / 91404 to **Valley Zone**, 90019 to **LA Zone**, 91319 to **Far West Zone** (each placed with its already-mapped neighbors). Confirmed 90231 is not mapped. 91014 left unmapped pending confirmation — it falls between Far East Valley and Heritage SGV territory.
- **2026-08-19**: Fixed **92782** (Tustin) resolving to the NEED HAULER zone. It was listed in both Avel Anaheim Zone 2 and Irvine / South Orange; because `ZIP_MAP` is built top-to-bottom and the last zone wins, Irvine (later in `ZONES`) was overriding Avel. Removed 92782 from Irvine / South Orange so it now resolves to **Avel Anaheim Zone 2**. Also de-duplicated Irvine / South Orange's own zip list (41 entries → 21 unique; the repeats were showing twice in the "other zips in this zone" chips). **Still duplicated across zones:** 90720 (Avel LA + Avel Anaheim → resolves Anaheim) and 91789 (Avel Anaheim + Heritage SGV → resolves Heritage SGV).
- **2026-08-19**: Raised **9 Yard** base price **+5% (rounded to nearest dollar)** across all 8 discountable in-house zones. SCV Zone excluded (held at $675). Outsourced zones untouched (partner-set). New: Valley $420, South Valley $439, South West $447, East Valley $490, LA $523, Far East Valley $503, Beach $558, Far West $551. Both `cp` and `rp` updated (identical on this bin). Included tonnage, overage rate, days, and xtra unchanged.
- **2026-08-19**: Set **9 Yard max discount (`disc`) to $15** across all 8 discountable in-house zones — was $20 in most, $40 East Valley, $30 Far East Valley. Normalizes 9yd discount room to 2.7–3.6% of price and puts every zone's max-discount floor above its pre-raise price. SCV Zone left at `disc: 0` (no-discount zone by design, all bins). Outsourced zones unchanged.
- **2026-03-26**: Raised minimum overage rate to $120/Ton across ALL zones (in-house + outsourced) for 9yd+ bins. Heritage zones stay at $125/Ton (already above minimum). 3yd bins stay at $16/100 Lb everywhere. Updated BIN_CONFIG desc strings and overCol to match. Updated 10yd/10yd Clean inHouse desc: general trash $120/ton, C&D $130/ton. Updated getOverCol fallback to 120.
- Added unique estimate numbers (TGD-YYYYMMDD-XXXX) to every quote — shown in app, email, and GHL payload
- Added Google Sheet auto-logging via Apps Script — every sent quote logs to a spreadsheet for team reference
- (Initial CLAUDE.md creation — March 2026)
