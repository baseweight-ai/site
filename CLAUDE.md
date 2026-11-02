# Baseweight site: agent guide

Static marketing site. No framework, no bundler: the repo root deploys as is, and the one
build step, `build.mjs`, validates the retrieval-service results snapshot and applies the
Retrieval demo's flag. Each page is a standalone HTML file with an inline `<style>` block
(design tokens are duplicated per page under `:root`). Shared nav + footer are injected at
runtime by `components.js`; their styling lives in `components.css`.

## Authority order

- **Positioning: the homepage wins.** Baseweight is an AI engineering consultancy: build,
  measure, harden and optimize LLM systems in production. "Forward-deployed" was dropped
  from every surface on 2026-09-20 and does not come back. `index.html` is the
  authoritative statement of what is offered, to whom, and at what price; its sections read
  hero, what we do, who we work with, offers, published, CTA.
- **Copy: `COPY-STYLE.md`**, enforced by `e2e/copy-lint.spec.ts` (patterns) and
  `e2e/copy-budget.spec.ts` (per-page word budgets).
- **Head-to-head asset: `data/benchmark/DOCTRINE.md`** (doctrine and build plan for the
  public head-to-head). The asset is named three ways on purpose: it lives at `/benchmark`,
  the nav says "Benchmark", and the page's own title, heading, and copy say "head-to-head".
  `/head-to-head` 301s to `/benchmark`.
- Memory files are advisory.
- **Numbers.** Head-to-head figures (28–138×, the $0.46 GPU rate) come from
  `data/benchmark/results.json`. Offer prices live in the homepage carousel; anything
  beyond list price (discounts, payment terms, SOW scope) belongs on the call.

## Offers

Four, in the homepage carousel, in this order. Titles are noun phrases naming the
engagement, with no trailing qualifier:

1. **Production Diagnostic** (reliability and cost/latency in one diagnostic).
2. **Eval Harness Sprint**.
3. **Eval Retainer**.
4. **Post-Training** (feasibility, then a build).

- **Prices are published** (set 2026-09-22): Production Diagnostic $7,500 / 2 weeks, Eval
  Harness Sprint from $24,000 / 3 weeks, Eval Retainer from $5,000/month, Post-Training
  from $45,000 / 6 weeks. Each card's spec line keeps price and duration co-equal on one
  line separated by a middle dot, because a price without a duration is not decidable; the
  retainer carries no duration. `e2e/home.spec.ts` asserts each spec line, so a change is a
  reviewed pricing decision rather than a copy edit.
- Every card renders exactly four elements and nothing else: `.offer-index`, `h3`, `p`,
  `.offer-spec`, in that order, asserted in `e2e/home.spec.ts`. Outcome, fee-credit and
  findings lines were tried on the diagnostic cards and cut on 2026-09-20; a seven-field
  card made the row unreadable. The spec is anchored to the card's bottom edge, since cards
  stretch to the row's tallest.
- Three audiences, named on the page: startups, agencies (white-label), operators. The
  agencies card carries the site's one in-card contact link, a text link to
  `hello@baseweight.co`.
- Every CTA on every page is "Book a call" to `https://cal.com/baseweight/intro`. There is
  no form, no lead magnet, and no qualification asset on the site. The homepage closing CTA
  carries one secondary route beside it, an outlined "Email us" to `hello@baseweight.co`,
  for the reader who will not book on a first visit; the footer carries the same address on
  every page. The email route is never a filled button and never leads.
- **One CTA per viewport.** The nav CTA is always on screen, so the body carries only the
  hero and closing CTAs. The offer cards carry none, and the floating sticky bottom bar was
  removed from every page on 2026-09-18: with the nav CTA it stacked up to five identical
  gold buttons in one viewport.
- Removed offers and names, never to reappear in copy: "Scan", the standalone "Pilot", and
  "Assurance" (posture-noun). `/pilot` 301s to `/`; so do `/scope` and `/fit-score`, whose
  fit-check wizard was removed on 2026-09-18, and `/contact`, whose page was deleted on
  2026-09-20. `/contact` lands on `/#cta`, the closing CTA, where the call and the email
  route both are.

## Run / test

- Serve from the repo root: `npx serve` or `python3 -m http.server 8080`.
  `serve` and Vercel resolve clean URLs (`/benchmark`, `/about`, …); `python -m
  http.server` does **not** rewrite, so open `*.html` directly. Internal links use the
  clean, no-`.html` form.
- E2E: `npm run test:e2e` (Playwright, Firefox; the config auto-starts the static server on
  `:8080`; specs in `e2e/`). Confirm a suspected flake with `--workers=1`.
- Redirects are server config, so no dev server built from `python3 -m http.server` applies
  them and every retired path 404s locally there. `vercel.json` is production; `serve.json`
  mirrors it for `npx serve`. The two are asserted to agree in `e2e/site.spec.ts`; add a
  retired path to both or the suite fails.

## Structural invariants (don't break)

- Nav and footer are injected by `components.js` into `<nav id="nav">` and `<footer>` on
  every page, and the footer is identical everywhere. Don't hand-roll per-page nav/footer.
  `components.js` also runs the one scroll-reveal observer for `.reveal`, and
  `components.css` holds the shared component CSS (skip link, footer, button press, the
  closing-CTA `.cta-routes`/`.btn-ghost` pair, and the single reduced-motion guard, whose
  `!important` rules make any page-level copy dead). Per-page `<style>` blocks carry the
  `:root` tokens and page-specific rules only.
- The e2e suite encodes the site's **current** copy, labels, CTAs, titles, and page list;
  these are *decisions, not law*. When you intentionally change one, update its assertion
  in the same change so the suite tracks the decision instead of freezing it.
- **All visitor-readable copy must pass `COPY-STYLE.md`** (lint) and stay inside its page's
  word budget (`e2e/copy-budget.spec.ts`). When the linter fires, rewrite the copy rather
  than allowlisting; when the budget blocks an addition, cut before raising. New slop
  patterns go into both the linter and the rulebook in the same change.
- Text tokens must hold WCAG AA contrast (>=4.5:1 on background and cards); `--text-muted`
  is #807d76 after a failed #555 regression.
- "frontier" was internals-only until 2026-09-20, when the owner put "a frontier API" into
  the `/benchmark` hero and the homepage published row. It now names the hosted API tier in
  those two places and nowhere else; everywhere else the buyer-facing phrase stays
  "big-platform" or "hosted API". The `model_family` enum and the CSS tokens are unchanged.
- The homepage offer carousel is a scroll-snap track: the arrows and rail are progressive
  enhancement over a plain scroller, so touch swipe and keyboard scrolling work with JS off.
  Card width is derived from the track (`--per-view`: 3 / 2 / 1 by width) so only whole cards
  show, never a card cut mid-sentence. Nothing peeks past the edge, so the "there is more"
  signal is a fade on the edge that has more cards behind it (`.offer-viewport.has-prev` /
  `.has-next`, kept in step by the scroll handler, right side on by default for JS off),
  backed by the arrows. Cards stretch to the row's tallest.
- `/benchmark` is a method page, and every tab on it opens onto published numbers: a task
  enters `TASKS` when its run is in `results.json`, never before. The placeholder-tab
  machinery (`upcoming`, `.task-tab-soon`, the status panel) was removed with the in-build
  tab on 2026-09-20; bringing back an in-build tab means bringing back that code and its
  tests. The run date is rendered from `generated_at` into the hero stamp, so the reader
  meets it before the numbers; never type it by hand.
- `/benchmark` carries no stat callouts and no cost calculator (both cut 2026-09-20): a
  number that is already a row in the results table does not get repeated as a headline,
  and a savings calculator reads as a marketing device on a page whose credibility is
  restraint. Page order is hero, tasks, results table, error analysis, artifacts, CTA.
- `/about` is one screen: the lead, the founder, the CTA. Anything about how the work is
  done or what is offered is homepage territory and belongs there instead.
- `/retrieval-service` is published: indexed, in the sitemap and in the nav. With no snapshot
  the page shows its pending state.
- The `vercel.json` build command runs `build.mjs`; Vercel refuses a build command over 256
  characters, so build logic goes in that file, never inline. It runs `parseSnapshot` from
  `e2e/retrieval-service-schema.ts` on `data/retrieval-service/results.json`, so a malformed
  snapshot fails the deploy, and moving that parser breaks every deploy. It also holds the
  Retrieval demo's flag: the page ships `<section id="demo" hidden>`, and the build drops
  `hidden` only when the Vercel environment variable `RETRIEVAL_DEMO` is `on` (declared `off`
  for Production and Preview), failing if the page stops holding that tag exactly once.
  Switching the demo is that variable and a redeploy, with no commit.
- Scroll-reveal is 0.4s and pre-triggers 25% below the viewport, with a 1.5s failsafe that
  reveals everything. Slower or later-triggering values leave fast scrollers on a blank
  viewport. `html { scroll-padding-top: 96px }` keeps scrolled-to targets clear of the
  72px fixed nav.

## Lead capture (none on the site; endpoint lives outside this repo)

- The site has no form. The head-to-head notify opt-in was removed from `/about` on
  2026-09-20 with the rest of that page's middle, so the only routes are the call and
  `hello@baseweight.co`. The e2e suite asserts no page carries a `<form>`. Don't add capture
  infrastructure back without a decision.
- The Google Apps Script endpoint and its sheet still exist and still hold the addresses
  collected before that date; `/privacy` describes them as a closed list. `apps-script/Code.gs`
  is the reference copy. It carries dead branches for the removed fit check and the removed
  about-page form; the DEPLOYED script is updated by hand (paste Code.gs, Deploy → Manage
  deployments → edit → New version, which keeps the /exec URL), so those stay live until the
  owner redeploys.

## Head-to-head data provenance

- `/benchmark` is the only page carrying head-to-head figures: the homepage proof strip
  was removed on 2026-09-20, and with it the last hardcoded snapshot on a marketing page.
  Any figure quoted outside `/benchmark` needs a provenance comment naming its
  `data/benchmark/results.json` rows and a re-sync when the head-to-head reruns.
- The homepage published section carries no figures, but its one row counts the run's tasks
  ("two vertical tasks"). That is a census, so it goes stale the moment a third task
  publishes; it is allowlisted in `e2e/copy-lint.spec.ts` rather than exempt, and re-syncing
  it is part of a head-to-head rerun.
- In `results.json`, `pricing_provenance.gpu_hourly_rate_used` (0.46, mirrored on every
  open-source row) is load-bearing: `cost_per_query = rate / (qps × 3600)`, and it
  propagates into the published "28–138× cheaper" claims. Change it only via a full
  pipeline rerun, never by hand; a hand-edit silently moves published numbers (0.46 → 0.44
  turns "138×" into "144×"). External prices cited on the site were verified May 2026;
  re-verify before reuse.

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

## Skill routing (outreach)

- Every LinkedIn outreach message (connection notes, invites, first DMs: drafting, revising,
  or reviewing, quick tweaks included) runs through the `connection-note` skill.
- Prospect-list building, coverage passes, owner identification, and contact validation run
  through `icp-to-outreach` (it chains prospecting / account-research / icp-discovery itself).

## Agent operating rules

Read this file and `docs/INTEGRATION-BRIEF.md` before your first edit.

## Repo boundary
You are in `~/projects/baseweight/site`, the live codebase behind https://www.baseweight.co. The sibling `~/projects/baseweight/service` is out of bounds: never edit it, build it, or add a dependency to it. Data crosses between repos as a file a human copies. If a task appears to require touching the sibling, stop and say so.

Host is Windows with WSL; repos are on the WSL side. Run the entire toolchain inside WSL.

## Session
- One task per session. Do the task you were given and stop.
- Before your first edit, write a plan of ten lines or fewer: files you will touch, tests you will write, order. If it does not fit the task's blast radius, stop and say so.
- Blast radius is binding. Touching an unlisted path requires stopping and asking. This includes reformatting, import reordering, typo fixes, dependency bumps.
- If your diff will exceed ~400 changed lines excluding lockfiles and fixtures, stop and propose a split.

## No scope creep
- No new dependencies. No new framework, styling system, state library or component kit. No version bumps. If a task appears to need one, stop and say so.
- Do not refactor shared components, restyle existing pages, or touch routes unrelated to this feature.
- If something unrelated is broken, note it. Do not fix it.
- Follow the conventions already in this repo. Do not introduce your own.

## Invariants
Do not change the gated-versus-advisory metric distinction described in `docs/INTEGRATION-BRIEF.md`, or the results-snapshot schema. If you believe one is wrong, say so in one paragraph and stop.

## Honesty
- Every figure, label, confidence interval, sample size, date and model name on the page comes from the committed results snapshot or from a live service response: `/v1/meta` for models, corpus, attribution and limits; each answer for its own index version and latency; `/v1/health` for the deployed commit. Never type a metric value into markup. Do not round, clean up, or select favourable numbers.
- If the results snapshot is absent, the page ships with an explicit "measurement pending" state and no figures. Not example values, not placeholder charts, not illustrative figures.
- Never claim a test passed, a build succeeded or the demo works without executing it. If you did not run it, write "not run".
- No secret reaches the browser. Any upstream key is injected server-side. Never in client code, never in a publicly-prefixed environment variable, never in a committed file.

## Copy
Load the `baseweight-site-copy` skill before writing any user-facing prose, including legends, error states and UI strings. Where it contradicts wording suggested in a task, the skill wins.

## Blocked
State the blocker in one sentence, give two options with trade-offs, wait. If a gate fails and the cause is not obvious within two attempts, `git restore` to the last commit and re-plan.

## Commits
You do not commit. Propose the message. Do not run `git commit`, `git push`, `git rebase`, or `git reset --hard`.
Conventional Commits: `type(scope): subject`, types `feat fix chore ci docs test refactor data`.
The existing history predates this rule.
Subject line only. Add a body only if one line is genuinely needed, never more. No lists. No summary of what you verified or did not verify. No commands, output, metrics, reasoning or diff summary. No trailers of any kind, no `Co-Authored-By`.
Code and committed data go in separate commits.
