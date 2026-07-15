# Baseweight site: agent guide

Static marketing site. No build step, no framework, no bundler. Each page is a standalone
HTML file with an inline `<style>` block (design tokens are duplicated per page under
`:root`). Shared nav + footer are injected at runtime by `components.js`; their styling
lives in `components.css`.

## Authority order

- **Business model: `MVB.md` wins, always.** It is the sole source for segments, problem,
  solution, revenue, pricing, moats, channels, and GTM. Its wording is the authoritative
  statement of the model (write copy from it), but nothing in it is a settled headline,
  tagline, or product name; published wording follows `COPY-STYLE.md`.
- **Copy: `COPY-STYLE.md`**, enforced by `e2e/copy-lint.spec.ts` (patterns) and
  `e2e/copy-budget.spec.ts` (per-page word budgets).
- **Head-to-head asset: `data/benchmark/DOCTRINE.md`** (doctrine and build plan for the
  public head-to-head; the internal `data/benchmark/` path and the GitHub repo name keep
  the old word).
- Memory files are advisory.
- **Vocabulary (MVB terms).** *Lanes* and *segments* are the MVB's: Lane 1 commodity
  services (cash on-ramp), Lane 2 data-flywheel workflows (the wedge: first product entry),
  Lane 3 regulated egress-blocked verticals entered via digital-native sub-segments.
  *Messaging wedges* on the site and in the fit check (cost / quality / compliance, plus
  latency/control in the quiz) are the buyer-facing face of the MVB benefits (cost,
  customization, data control, sovereignty); prefer MVB terms when re-deriving copy.
- **Numbers.** Head-to-head figures (28–138×, the $0.46 GPU rate) come from
  `data/benchmark/results.json`; commercial terms and pricing are not recorded in this repo.

## Offers (the site expression of the MVB)

- **Build** = the MVB services Sprint; **Operate** = the MVB ops Retainer. Every Build
  opens with the head-to-head as a contractual gate; the stop clause and all pricing live
  in the SOW and the sales call, never in page copy. A measurement-only start is a
  call-level fallback, never a site offer.
- Outcome-based Product terms enter copy only once a first operated account exists; nothing
  in the copy forecloses them.
- Removed offers and names, never to reappear in copy: "Scan", the standalone "Pilot"
  (a paid-measurement product forces measurement-as-product copy, and "pilot" names the
  failure pattern in enterprise AI), and "Assurance" (posture-noun). `/pilot` 301s to `/`.
- Early-trust hook decision: the gate at founding rates is the default; a free trial, a
  make-good refund, or deeper design-partner discounts are the bench alternatives; revisit
  after the first three engagements.

## Run / test

- Serve from the repo root: `npx serve` or `python3 -m http.server 8080`.
  `serve` and Vercel resolve clean URLs (`/head-to-head`, `/scope`, …); `python -m
  http.server` does **not** rewrite, so open `*.html` directly. Internal links use the
  clean, no-`.html` form.
- E2E: `npm run test:e2e` (Playwright, Firefox; the config auto-starts the static server on
  `:8080`; specs in `e2e/`). The fit-check wizard tests flake under parallel load; confirm with
  `--workers=1`.

## Structural invariants (don't break)

- Nav and footer are injected by `components.js` into `<nav id="nav">` and `<footer>` on
  every page, and the footer is identical everywhere. Don't hand-roll per-page nav/footer.
- The e2e suite encodes the site's **current** copy, labels, CTAs, titles, and page list;
  these are *decisions, not law*. When you intentionally change one, update its assertion
  in the same change so the suite tracks the decision instead of freezing it.
- **All visitor-readable copy must pass `COPY-STYLE.md`** (lint) and stay inside its page's
  word budget (`e2e/copy-budget.spec.ts`). When the linter fires, rewrite the copy rather
  than allowlisting; when the budget blocks an addition, cut before raising. New slop
  patterns go into both the linter and the rulebook in the same change.
- Text tokens must hold WCAG AA contrast (>=4.5:1 on background and cards); `--text-muted`
  is #807d76 after a failed #555 regression.
- "frontier" survives only as load-bearing internals (the head-to-head's `model_family` enum,
  its CSS tokens, the fit-check form value `frontier-api` in `scope.html`); never in
  visitor copy.

## Lead capture (mechanics; endpoint lives outside this repo)

- Captures POST to a Google Apps Script endpoint via a hidden iframe: formkey `k`, a
  `company` honeypot, success state swapped in by the form's `onsubmit`. Reuse this wiring;
  don't add new capture infrastructure.
- The fit check also POSTs a computed `verdict` + `answers` blob; the Apps Script stores
  these alongside the email. Any new or renamed posted field needs a matching server-side
  change there, since that script lives outside this repo.

## Fit check ( /scope )

- The site's qualification asset: a free wizard at `/scope` (`scope.html`), one question
  per screen, result shown before email capture. Flow: task (multi-select plus optional free line; require at least
  one) → what-handles-it-today → correctness → data → blocker → scale → ownership. The
  `STEPS` array is the source of truth; the DOM order of step blocks deliberately differs.
- Results route from answers: candidate (→ Build), not yet (labelled data missing; ships a
  capture checklist), not measurable yet (no consistent way to judge), you already build
  this (a cost-and-priority read for in-house teams), and keep your API. **Results are next
  steps, never grades:** each headline is an imperative plus what the answers change about
  a Build (length and readiness drivers; dollar figures stay out until real engagements
  calibrate them); the quiz never classifies the visitor in visible copy.
- The posted field `verdict` and the `fit_verdict` analytics event are internal names under
  the server and analytics contracts, never visitor copy. Posted fields (`verdict`,
  `answers`, `q1_task`, the `q7_own` values) are a server-side contract; rename nothing
  without a matching Apps Script change. The hidden `source` field still posts the value
  `fit-score` (server contract) even though the page moved to `/scope`.
- Analytics: `fit_start` / `fit_step` / `fit_verdict` / `fit_capture` fire from the quiz;
  enable and observe them in the Vercel dashboard.
- `apps-script/Code.gs` is the reference copy of the capture endpoint, current with the
  result set as of 2026-07-14; the DEPLOYED script is updated by hand (paste Code.gs,
  Deploy → Manage deployments → edit → New version, which keeps the /exec URL). Pending
  until the owner redeploys.

## Head-to-head data provenance

- Head-to-head figures on marketing pages (e.g. the homepage proof strip) are a hardcoded
  snapshot derived from `data/benchmark/results.json`, not live; re-sync them when the
  head-to-head reruns (see the provenance comment by the proof strip).
- In `results.json`, `pricing_provenance.gpu_hourly_rate_used` (0.46, mirrored on every
  open-source row) is load-bearing: `cost_per_query = rate / (qps × 3600)`, and it
  propagates into the published "28–138× cheaper" claims. Change it only via a full
  pipeline rerun, never by hand; a hand-edit silently moves published numbers (0.46 → 0.44
  turns "138×" into "144×"). The public cost calculator's default (0.44, "A40 ~$0.44/hr")
  is independent. External prices cited on the site were verified May 2026; re-verify
  before reuse.

## Working with the owner (standing feedback)

- **No marketing slop.** The rules and their reasons live in `COPY-STYLE.md`. The root
  failure to avoid in any drafted copy: selling our pronouncement, posture, process, or
  terms instead of the buyer's outcome. Judgment tokens ("verdict"), posture-nouns as names
  ("Assurance"), exit mechanics ("stop at the measured phase"), visitor grading ("You're a
  candidate"), and measurement re-promises were all this one root; check new copy against
  it before writing. When a line keeps failing after rewrites, fix the structure it
  describes (the offer, the output, the layout, the name), not the sentence.
- **Parsimony.** "Apply the principle of parsimony. Use extreme minimal words for maximal
  effectiveness. Avoid constant asides, hedging, unnecessary repetition, overexplaining,
  unnecessary (or even harmful) details." Applies to copy, docs, and replies alike; the
  word budgets are the floor, never the standard.
- **No em dashes anywhere**, including docs, commit messages, and chat: use commas, colons,
  parentheses, or separate sentences. En dashes stay acceptable in compact numeric ranges
  ("$6–9k", "30–40%").
- **Be concise.** Lead with the answer; cut preamble and recaps.
