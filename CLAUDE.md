# Baseweight site — agent guide

Static marketing site. No build step, no framework, no bundler. Each page is a standalone
HTML file with an inline `<style>` block (design tokens are duplicated per page under
`:root`). Shared nav + footer are injected at runtime by `components.js`; their styling
lives in `components.css`.

> This file holds only **stable, structural facts**. Positioning, naming, copy, pricing, and
> offer structure are deliberately **not** here — they change often and are under active
> review. Don't treat anything that's absent from this file as fixed. The current strategy (ICP, audiences, positioning, offer ladder) is the working baseline in `STRATEGY.md` — the yardstick for copy/design/offers, itself a decision record open to revision.

## Run / test
- Serve from the repo root: `npx serve` or `python3 -m http.server 8080`.
  `serve` and Vercel resolve clean URLs (`/benchmark`, `/fit-score`, …); `python -m http.server`
  does **not** rewrite, so open `*.html` directly. Internal links use the clean, no-`.html` form.
- E2E: `npm run test:e2e` (Playwright, Firefox). The config auto-starts the static server on
  `:8080`. Specs are in `e2e/`.

## Structural invariants (don't break)
- Nav and footer are injected by `components.js` into `<nav id="nav">` and `<footer>` on every
  page, and the footer is identical everywhere. Don't hand-roll per-page nav/footer.
- The e2e suite encodes the site's **current** copy, labels, CTAs, titles, and page list —
  these are *decisions, not law*. When you intentionally change one, update its assertion in
  the **same** change so the suite tracks the decision instead of freezing it.

## Lead capture (mechanics + a hard external dependency)
- Captures POST to a Google Apps Script endpoint via a hidden iframe — formkey `k`, a `company`
  honeypot, success state swapped in by the form's `onsubmit`. Reuse this wiring; don't add new
  capture infrastructure.
- The Fit Score additionally POSTs a computed `verdict` + an `answers` blob. **The deployed
  Apps Script must be extended server-side to store those fields — it lives outside this repo.
  Until it is, submissions record only the email and silently drop the diagnosis.**

## Data provenance
- Any benchmark figures shown in the marketing pages (e.g. the homepage proof strip) are a
  hardcoded snapshot derived from `data/benchmark/results.json` — they are not live. Re-sync
  them if the benchmark reruns (see the comment by the proof strip).
