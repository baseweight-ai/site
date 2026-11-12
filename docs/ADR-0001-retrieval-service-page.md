# ADR-0001: Retrieval page, route and composition

Status: Accepted 2026-10-30.
Inputs: `docs/INTEGRATION-BRIEF.md`, `docs/DISCOVERY.md`, `CLAUDE.md`.

## Context

The feature is one page carrying a live demo of the RAG service and its measured results,
shipped in three passes: the page with results pending, then the demo, then the figures. The
demo leads the layout (brief §1), directly under the page's claim. The site is static HTML on Vercel with no server runtime, and
the service takes no credential, so the browser calls it directly (DISCOVERY §9, brief §5a).
`/retrieval-service` already exists as a noindexed stub that the homepage links to; the served
HTML matched the file at HEAD on 2026-10-30 (DISCOVERY §6). `methodology.html` is the layout
precedent and `benchmark.html` the data-read precedent (DISCOVERY §7).

## Decision

### Route

- Path `/retrieval-service`, file `retrieval-service.html`. The page is named Retrieval in the
  nav, the title, the h1 and the homepage published row; the path keeps the longer name,
  since renaming it would cost a redirect and buy nothing. The entry points are the homepage
  published row (`index.html:820`) and the nav, which carries Home, Benchmark, Retrieval and
  About, and collapses to the menu button at ≤730px (`components.css`).
- Pass 1 removes the `noindex` meta tag and adds `https://baseweight.co/retrieval-service` to
  `sitemap.xml`, with the expected list at `e2e/site.spec.ts:153-161` updated in the same
  change.
- Head: title, description, canonical on the apex (the site convention), Open Graph and
  Twitter tags in the shape of `methodology.html:6-22`. The title keeps matching
  `e2e/site.spec.ts:21`.

### Layout

- One column at full container width. Prose, headings and tables take `methodology.html`'s
  `.methodology-content` and `.table-wrap` rules, copied into the page `<style>` with the
  `:root` tokens. No heading carries a section number.
- `html { scroll-padding-top: 96px }`, as at `index.html:55`. Every image and background loads
  from the site's own origin.

### Sections, in this order

The reader is a prospective client outside the field who reads almost nothing. The page is
one sentence at the top, the question box with its examples, the comparison columns, and the
results at the bottom, and nothing else: no global diagram, no closing CTA (the nav's stays),
and no sentence beyond the top one. Two things show besides, both required: the attribution
where passages appear, and the snapshot's limitations. Failure states show when something
fails. Every other sentence and qualification sits in the notes, one closed control at the
foot. Pass 1 ships sections 1 and 3 (pending), with 2 and the notes' demo part hidden. Pass 2
shows them. Pass 3 fills section 3 and shows its limitations.

1. **Hero**: one sentence saying the page compares different RAG setups, and nothing else
   visible. It holds whether or not the demo shows, so the meta and social descriptions carry
   it too. The h1 "Retrieval" is there for screen readers and search, visually hidden.
2. **Demo**, directly under the sentence with no heading of its own, on `POST /v1/compare`. At
   390px and at 1280px wide, the question box and at least one answer show before any
   scrolling.
   - A labelled `<input>` and a `<button>`; a click handler submits, and script handles Enter.
   - One column per rung, in the order the response lists them
     (`COMPARE_RUNGS`: `closed_book`, `bm25`, `hybrid`, `full`): four across, two below 860px,
     one below 640px. Each column's `h2` is the first part of its rung's label, above its answer
     or that rung's own error, the citations its `[cN]` markers open (each to its passage, the
     service's `supported` flag and its title linked to its `url`, a passage past eight rendered
     lines cut, with a button that opens the rest), its pipeline, each passage title once with
     its count, by first rank, with a "By rank" control holding the titles by rank, repeats
     included, and its latency in seconds to one decimal.
   - Each column's pipeline is drawn from its rung's `stages` alone (brief §3): each stage it
     lists, in that order and under that name, a skipped stage dashed, struck through and named
     skipped in its accessible text. A rung without the field shows no pipeline; a malformed one
     makes the comparison unavailable. A failed rung shows its pipeline, since the field
     describes the rung, not one run. The pipeline shows the label's "how", so neither the rest
     of the label nor the rung's `name` shows. No global diagram.
   - Rungs carry no `citation_supported_ratio`, so each citation's
     `supported` flag shows instead. No charged amount shows until display precision has a
     rule (Risk 12).
   - Answer, snippet and title strings enter the DOM as text (`textContent` and
     `createElement`, as at `methodology.html:401-417`). A citation's link is built from its
     `url` alone; `[cN]` markers attach citations and do nothing else.
   - States: idle; waiting, held through a cold start; result; `429` showing the
     `Retry-After` window when the header is readable, and a plain rate-limit state when it is
     not; `503 budget_exhausted` as a spent budget, the service's daily cap and the provider's
     spend limit told apart by `message`; unavailable, covering network errors, CORS refusals,
     timeouts and any response outside the error envelope.
   - `GET /v1/meta` and `GET /v1/health` are first sent when the question box or a prepared
     question takes focus, and a question is sent only once `/v1/meta` has answered. From it the
     demo takes the attribution and checks that `public_mode` is `read_only`, which the demo's
     limits note states beside the rate limit and the daily budget, with no figures: no endpoint
     reports the compare limit. Comparison answers carry no `index_version`, so the deployed
     commit and index version come from `/v1/health`; each rung's latency comes from the answer.
   - The attribution ships with the demo, since the page shows no corpus text until the demo
     renders a passage. `#demoAttribution`, in the smallest type the page sets, sits directly
     under the rung columns, where the
     passages appear, the last thing in the section. It holds the deployed `attribution`
     verbatim as of 2026-11-01 (brief §3) and shows only while a passage is on screen, as a
     retrieved title or a citation. The demo writes a copy into the notes. Once `GET /v1/meta`
     answers, the demo replaces both texts with the response's `attribution`, before any rung
     output.
   - Under the box, the prepared questions, with no label or control, staying while answers
     show. Nothing about the corpus or privacy sits in the demo: the footer links the policy,
     which says where a question goes. The demo's notes are in the notes, in full: the corpus
     boundary, the anecdote, the
     limits (read-only, rate-limited, a daily budget), what a question sends, and the deployed
     commit and index version from `/v1/health`.
   - One polite live region announces state changes. Waiting and returned are announced, not
     shown, since the elapsed time and the columns show them; a failure is also shown.
3. **Results**:
   - Source: `data/retrieval-service/results.json`, the service's `results/latest.json` copied
     verbatim by a human, read with a same-origin `fetch`.
   - States: "measurement pending" when the fetch returns 404; failure when the fetch, the
     parse or the schema check fails in any other way; figures when the snapshot is valid.
     Figures enter the page only through this script.
   - The pending state is the label "Measurement pending" in the tables' place.
   - Figures: a stamp from `generated_at` and `git_sha` at the section top; metric rows split
     on `gated` into two tables, each with a `<caption>` naming its category, "Gated" or
     "Advisory", the notes' terms, ruled solid for gated and dashed for advisory; per row
     `name`, `config`, `tier`, `slice`, `n`, `value`, `ci_low` to `ci_high`, and the delta with
     its bounds where set, under the headers Metric, Setup, Question set, Subset, n, Score, CI,
     Change from baseline and Change CI; an operational line (`p50_latency_ms`,
     `p95_latency_ms`, `cost_usd_total`).
   - With a snapshot, under the tables: `limitations` as a list, every entry verbatim, shown
     without opening anything.
   - Last in the section and on the page, in every state, the notes: one `<details>`, closed,
     its summary "How it's measured, and its limits". Inside: gold ids taken from the corpus's
     provenance data; the gated and the advisory category, each defined in one sentence, and
     which one gates CI; the clustered, paired bootstrap, clustered by source page; what `n` and
     a CI are; a provenance line from `dataset`, `system` and `judge`; the demo's notes, held
     back while the demo is. Mechanism only: every figure, `n`, metric name, model name and corpus name on
     the page renders from the snapshot or a live response.
   - The page relates the demo's index to the measured index only after the handoff confirms
     they match (brief §5).

### Copy

- Every visitor-readable string, script strings included, is written under the
  `baseweight-site-copy` skill and passes `e2e/copy-lint.spec.ts`. The budget at
  `e2e/copy-budget.spec.ts:29` rises in the same change, with its note.
- The brief's required elements stay through every cut: the definitions of the two categories,
  the limitations in full, the attribution, rung errors, the budget and rate-limit states. The
  skill sets their wording.

### Headers

- `vercel.json` site rule: `connect-src` gains `https://baseweight-service.fly.dev`.
- New `vercel.json` `headers` entry, `source: "/retrieval-service"`: the site policy in full,
  with `img-src 'self' https://baseweight-service.fly.dev`.
- A static spec asserts both rules against `vercel.json`, as `e2e/site.spec.ts:186-204` does
  for redirects.

### Tests

- `e2e/retrieval-service.spec.ts` validates the committed snapshot from disk when present
  (every metric row carries `n`, `ci_low`, `ci_high`, `gated`; `limitations` is non-empty),
  drives the three results states with `page.route`, pins the section order, and drives each
  demo state against a mocked service whose payloads follow the deployed `openapi.json`.

## Consequences

- Reusing the stub keeps the homepage link, the asserted title and the redirect set unchanged.
- A snapshot missing from a deploy reads as pending; the snapshot spec ties the committed file
  to the page state. Pass 3 is a data commit plus rendering code, committed separately
  (`CLAUDE.md`, Commits).
- A visitor who never touches the demo sends nothing to the service, and crawlers do not start
  the Fly Machine.
- Real comparisons run from a local copy at `http://127.0.0.1:8080`. A deployed page first makes
  one in production (Risk 1).
- While the demo is hidden the page is its sentence and the results, pending until a snapshot
  lands. The body carries no CTA of its own; the nav's "Book a call" is always on screen.

## Risks

1. **No real demo call from a deployed page before production.** The service's CORS allows only
   `https://www.baseweight.co` and `http://127.0.0.1:8080` (brief §3). Real comparisons run from a
   local copy at that second origin, where no headers apply (DISCOVERY §10). CORS refuses
   `http://localhost:8080` and previews on `*.vercel.app`, which also sit behind Vercel SSO. So the
   page's CSP first meets a real call in production, and the e2e specs mock the service.
2. **CORS on error responses.** `Retry-After` is not a CORS-safelisted response header: the
   page can read it only if the service sends `Access-Control-Expose-Headers: Retry-After`.
   Error bodies are readable only if non-2xx responses carry `Access-Control-Allow-Origin`.
   The brief records neither.
3. **The page's CSP stands alone.** No headers apply locally (DISCOVERY §10). On two previews
   on 2026-11-01, Firefox received one `Content-Security-Policy` header on
   `/retrieval-service`, the page rule's, and the site rule's on `/`. So the page rule
   repeats the whole site policy, which `e2e/site.spec.ts` asserts.
4. **Precedent code that does not transfer.** `benchmark.html` renders through `innerHTML`,
   barred for model output (brief §5b). The `data:` grain overlay (`methodology.html:62-71`) is
   blocked by the page's `img-src`. Gold and blue mean hosted API and open-weight on
   `/benchmark` (`benchmark.html:49-51`). No input styling exists and no page sets
   `color-scheme`, so an unstyled question box renders in light UA defaults.
5. **Service behaviour.** The $0.15 daily cap is shared by both endpoints and a comparison
   spends several generations, so the budget state will be common. Counters live in process
   memory and reset on each start. The two budget states differ only in `message` text the site
   does not control, so an unmatched message needs a fallback. One cold start took 15–19 s; the
   figure cannot be typed into copy. What the URL answers after the Fly trial ends is unknown
   (brief §3).
6. **Privacy text.** The demo sends the visitor's question and IP address to Fly.io, a model
   provider, and Langfuse at 50% trace sampling (brief §5). `privacy.html:127` and `144` name
   only Cal.com, Google and Vercel and say no form collects data. Owner decision before pass 2
   ships.
7. **Copy lint collisions.** Likely trips, script strings included: ", not" (comma-not
   contrast), "correct answer", "currently" or "right now" in error states, "both models" or
   "four questions" (count anchors), "proof", "scan", "we never", "real numbers", "honest"
   (`e2e/copy-lint.spec.ts:30-91`). The fix is a rewrite, never the allowlist (`CLAUDE.md`).
8. **Prose cannot carry the brief's numbers.** Brief §2's approximations (about 400 cases,
   about 30 cases, ±14 points) and its metric names cannot be typed; brief §3 records that the
   handoff names no metrics. The snapshot schema has no confidence-level field, so "95%" has no
   data source.
9. **Homepage promise.** The published row and the stub's subtitle say "with tracing"
   (`index.html:822`, `retrieval-service.html:93`); the page offers no trace links (brief §5).
   The row is homepage copy, asserted at `e2e/home.spec.ts:215-217`; changing it is the owner's
   call.
10. **Public docs.** `.vercelignore` lists `docs/` and the e2e fixtures, so the brief,
    DISCOVERY.md and this ADR stay off `www.baseweight.co`. What the build reads stays public,
    and `e2e/site.spec.ts` asserts what the deploy carries.
11. **Apex.** CORS excludes `https://baseweight.co`, which today answers 307 to www (live).
    Serving the page from the apex would break the demo.
12. **Rounding.** "Do not round" (`CLAUDE.md`, Honesty) meets a precedent that rounds
    (`benchmark.html:616`, `685`). Display precision for snapshot values and live costs needs a
    rule before pass 3.
13. **Line endings.** No `.gitattributes`; edits from the Windows host could commit CRLF.
    Reported only (brief §7).

## Not determined

- The `/v1/compare` request and rung shapes. Source: the deployed `openapi.json`, pass 2.
- Whether the service exposes `Retry-After` and sends CORS headers on errors (Risk 2). Source:
  a request carrying `Origin: https://www.baseweight.co`, pass 2.
- Whether the snapshot will carry `ablations` whose configs map to the rungs, and whether the
  page shows them. Pass 3, owner.
- The confidence level the page may state, and display precision (Risks 8, 12). Owner.
- Noindex timing: pass 1 proposed, pass 2 the alternative. Owner.
- A dashboard build-command override (the Vercel API response did not include the setting) and
  the project's environment variables (not inspected).
