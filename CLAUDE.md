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
├── index.html              # Dumpster app — React components, zone data, pricing logic, CSV export
├── restrooms/
│   ├── index.html          # Portable restroom quote app. Prices live in RESTROOM_PRICES.
│   └── img/                # Unit photos copied from All Site Rentals product photos
├── email-template.html     # GHL-triggered branded email template for dumpster quotes
├── google-sheet-script.js  # Google Apps Script — paste into Sheets for auto-logging dumpster quotes
└── CLAUDE.md
```

## Portable Restroom Quote Tool

CSR quote tool for portable restrooms. It is a separate single-file app at `restrooms/index.html` (GitHub Pages: https://kawiride027.github.io/TGD-Dumpster-PRICING-SHEET/restrooms/). It does not read `ZONES` or `ZIP_MAP`. Do not edit the dumpster `index.html` when changing restroom rates or the restroom webhook. The restroom brand name is exactly **The Green Dumpster/All Site Rentals** (header, page title, quote text, and `company_name`). The restroom phone is `(818) 960-1941` (`tel:+18189601941`) in the header, footer, quote text, and `company_phone`. The heading email is the fixed `office@thegreendumpster.com`. The quote text, page footer, `quote_summary`, `quote_summary_html`, `company_email`, and `csr_email` are the selected CSR's address from `CSR_EMAILS`. With no CSR selected they fall back to `info@thegreendumpster.com`. A sent restroom quote also posts the dumpster sheet's 12 field names to the dumpster Apps Script, so the row lands on that same tab. `RESTROOM_ESTIMATES_URL` opens that spreadsheet. The header logo is `restrooms/img/tgd-asr-logo.webp`. Construction includes Deluxe with Sink at the confirmed Deluxe rates: first 28 days $316.47, then $217.47 each added 28 days. The 11/23/2026 Global cost increase applies only to Deluxe Flushable: first 28 days $425.68 ($10 unit + $99 delivery + $316.68 service), then $351.35 ($10 unit + $341.35 service) each added 28 days. Global's cost is $315 the first period and $260 each added period, priced at cost / 0.74 for a 26% margin. Construction also quotes 100A and 200A temp power poles from Dustin's 11/16/2026 prices. Poles are not on Events. The 1x/2x/3x multiplier does not change pole lines, and a pole does not waive a containment tray's delivery.

- **No zip lookup.** The price is the same for every address. The job address is free text on the quote.
- **Step 1** asks "Is this for an Event or a Long-term Construction Site?" with two large text cards: EVENT and Long Term Construction Site.
- **Step 2** is the product cards for that type only. CSRs can select more than one. There is no VIP or luxury trailer.
- **Step 3** is the quote. Events lines are still placeholders (per day or a Friday–Sunday weekend) and keep Event date and Delivery date. Every Events quote also adds one Delivery & Set-Up line, charged once per drop from `RESTROOM_PRICES.eventsDelivery` (placeholder `$99`, same figure as the construction book). It is not per unit. Construction uses the price book: Unit, one-time Delivery & Set-Up per unit, and Service Fee, billed in 28-day periods. Recurring billing starts after the first 28 days. Construction asks "How many days per week of service?" when a restroom or tray is on the quote. The buttons read **1x**, **2x**, and **3x**. The payload value `service_days_per_week` stays a number. A poles-only quote hides that question and does not send `service_days_per_week`. That number multiplies the restroom service fee only. "Added 28-day periods on this quote (Leave blank if not known)" may be left blank; blank means 0 added periods and does not error. The construction date label is Requested Delivery Date for restrooms, Requested Installation Date for poles only, and Requested Delivery / Installation Date when both are on the quote. Both `requested_delivery_date` and `requested_installation_date` carry that date.
- **All rates** are in `RESTROOM_PRICES` at the top of `restrooms/index.html`. `samplePrices` is per mode. Events is `true` (SAMPLE PRICES banner). Construction is `false`. `disc` steps by $5; `0` means no discount. `price: null` hides that events line. Construction totals are the sum of the line items. Standard's first 28 days is Unit `$10` + Delivery & Set-Up `$99` + Service Fee `$158.40` = `$267.40`. Each added 28 days is `$10` + `$158.98` = `$168.98`. Construction delivery stays per unit. The Events `$99` drop is the only Events delivery line; the old optional "Delivery & Pickup" add-on at `$150` per drop is gone. Extra Service / Pump-Out stays `$95` per visit.
- **Send** matches the dumpster app: `POST` JSON to a LeadConnector inbound webhook. The constant is `RESTROOM_WEBHOOK_URL`. It is a restroom trigger, not the dumpster workflow **CSR Dumpster Quote**.
- **Estimate numbers** are `TGD-PR-YYYYMMDD-XXXX` (portable restroom). Dumpster estimates stay `TGD-`.
- **Payload:** `estimate_number`, `csr_name`, `csr_email`, `customer_name`, `customer_phone`, `customer_email`, `job_address`, `service_type`, `use_case` (`Event` or `Construction`), `customer_type` (the same value as `use_case`), `unit_count`, `unit_N_name`, `unit_N_qty`, `unit_N_price_each`, `unit_N_line_total`, `unit_N_service_frequency`, `unit_N_rental_period`, `quote_summary`, `quote_summary_html`, `total_quote`, `company_name`, `company_phone`, `company_email`, `timestamp`. `service_type` is `Portable Restroom` for restrooms only, `Temp Power Pole` for poles only, and `Portable Restroom & Temp Power Pole` when both are on the quote. `customer_type` matches `use_case`. SMS fields are added beside those: `sms_summary` (plain text, no emojis), `service_label` (the service type in lowercase), `total_display` (the total with a `$` sign), and `date_display` (the event date for events, the requested delivery or install date for construction). Email fields are added beside those: `service_title`, `recurring_display`, `service_schedule_line`, and `service_schedule_html`. Events also sends `event_date` and `delivery_date`, and adds a Delivery & Set-Up row (qty 1, per drop) that counts in `unit_count`. Construction sends `service_days_per_week` (a number) when a restroom or tray is on the quote, plus `requested_delivery_date`, `requested_installation_date`, and `recurring_28_day_total` instead of the event dates. A poles-only quote omits `service_days_per_week`. `quote_summary` uses the dumpster emoji layout with 🚻 on each unit line. `quote_summary_html` sets `font-size` and `color` on every text cell. `slack_quote_block` is one more Slack field, joined with real newlines and no trailing newline. A line is left out when its value is empty. The lines are `{emoji} {service_title} · {use_case}` (🚽, ⚡ for poles only, or 🚽⚡ when both are on the quote), `💰 {total_display}` plus ` (then {recurring_display}/28 days)` only for construction when `recurring_display` is set, `📅 {date_display}`, `📍 {job_address}`, and `🧾 Est #{estimate_number}`.
- The restroom CSR list matches the dumpster list except Evelyn, who is removed here. `CSR_NAMES`, `CSR_EMAILS`, and `CSR_SLACK_IDS` in `restrooms/index.html` stay in sync with each other. `CSR_SLACK_IDS` is the Slack member id used for reply alerts. The payload adds `csr_slack_id` and `csr_slack_mention` (`<@U…>`) next to `csr_name` and `csr_email`. The dumpster `index.html` list is edited separately.
- Pushing `main` publishes this page too. Same rule: do not push without the owner's go-ahead.

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
- **2026-11-27**: **Avel Anaheim Zone 2 — 9 Yard now priced at $975** (owner-approved). `cp` and `rp` `null` → **$975**, the same price as that zone's 12 Yard. `ct`/`rt` stay 1, days 8, xtra 40, `over` `$150/Ton`, `disc` 0. Avel LA Zone 1 9 Yard stays **$905**. No other zone, price, tonnage, days, xtra, overweight, or discount changed. Docket export adds the Avel Anaheim Zone 2 9 Yard contractor and residential rows at client cost 975, Cost per Ton Over 150, and `$150/ton` in the description — the same Avel rewrite PR #3 already applied to 12 Yard. Every other Docket row is unchanged.
- **2026-11-18**: Construction restroom rates follow the price book (28-day Unit + Delivery & Set-Up + Service Fee). Standard first 28 days is `$10 + $99 + $158.40 = $267.40`. Each added 28 days stays `$10 + $158.98 = $168.98`. Events prices are still samples. `samplePrices` is per mode.
- **2026-11-18**: Added `restrooms/index.html`, a portable restroom quote tool (Events and Construction, no zip lookup). Dumpster `index.html` was not changed. The restroom send posts to `RESTROOM_WEBHOOK_URL` (empty until a restroom workflow exists), not the dumpster trigger.
- **2026-11-14**: **Avel partner rate update — Avel LA Zone 1 and Avel Anaheim Zone 2 only** (owner-approved). `cp` and `rp` set to the same new value. **Avel LA:** 10 Yard Clean $850 → **$950**, 10 Yard $850 → **$950**, 12 Yard $750 → **$950**, 25 Yard $800 → **$895**, 40 Yard $970 → **$1025**. 3 Yard and 3 Yard w/ Wheels stay **$700**; 9 Yard price stays **$905**. **Avel Anaheim:** 10 Yard Clean $930 → **$1050**, 10 Yard $930 → **$1150**, 12 Yard $795 → **$975**, 25 Yard $975 → **$1050**, 40 Yard $1050 → **$1095**. 3 Yard, 3 Yard w/ Wheels, and 9 Yard stay `null`. **Overweight:** both Avel zones, `over` `$120/Ton` → **`$150/Ton`** on 9 Yard, 10 Yard Clean, 10 Yard, 12 Yard, 25 Yard, and 40 Yard. 3 Yard rows stay `$16/100 Lb`. Tonnage, days, xtra, and `disc` unchanged. No other zone touched. Docket export rewrites the hardcoded `$120/ton` in Avel row descriptions to the row's `$150/ton`; `$130/ton for construction and demolition` left as written (that C&D figure now reads below the new general-trash rate). 9 Yard and 12 Yard had a hardcoded Docket `overCol` of 120, so Avel rows now take Cost per Ton Over from the zone's `$/Ton` rate and export 150.
- **2026-10-11**: **Valley price test on 9 Yard / 3 Yard / 3 Yard w/ Wheels, plus 16 Yard and 25 Yard increases.** `disc` left unchanged on every row (intentional: on most of these rows, new price minus `disc` lands below the old list price). Valley only for the small bins — results to be reviewed in 4–6 weeks before rolling 9/3/3w out to other zones. **Valley:** 9 Yard $420 → **$435**, 3 Yard $235.80 → **$248**, 3 Yard w/ Wheels $269.73 → **$283**, 16 Yard $531.46 → **$551**, 25 Yard cp $596 → **$611** / rp $561.46 → **$576**. **16 Yard +$20** (cp and rp): South Valley $568.84 → **$589**, South West $582.53 → **$603**, East Valley $556 → **$576**, Far West $733.36 → **$753**, Far East Valley $672.29 → **$692**, LA $700.77 → **$721**, Beach $742.71 → **$763**. **25 Yard +$15:** South Valley cp $640.18 → **$655** / rp $598.84 → **$614**, South West cp $680.03 → **$695** / rp $604.03 → **$619**, East Valley cp $630 → **$645** / rp $580 → **$595**. Every other 9 Yard, 3 Yard, and 3 Yard w/ Wheels row matches the previous list. Untouched: 40 Yard, 10 Yard, 10 Yard Clean, SCV, San Gabriel Valley, all outsourced zones, tonnage, days, xtra, and overage.
- **2026-09-11**: Moved zip **90623** (La Palma) from **Avel LA Zone 1** → **Avel Anaheim Zone 2**. Removed from the old zone, not just added to the new one. Geographically correct — every neighbor (90620/90621 Buena Park, 90680 Stanton, 90720 Los Alamitos, 90638 La Mirada) was already Anaheim. Avel LA 143 → 142 zips, Avel Anaheim 59 → 60. Customer-facing impact: Anaheim Z2 does not carry 3 Yard, 3 Yard w/ Wheels, or 9 Yard, and is higher on every shared bin (25yd $800 → $975, 10yd $850 → $930, 40yd $970 → $1050).
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
