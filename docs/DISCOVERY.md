# Discovery: retrieval service page

Recorded 2026-10-30 on `main` at `2511cbb`, with this feature's uncommitted `CLAUDE.md`
change and untracked `docs/INTEGRATION-BRIEF.md` in the tree. Every finding cites a repo
path. "Live" marks an HTTP request to production on 2026-10-30; "Vercel API" marks a
read-only project query the same day.

## 1. Topology

- Two repos, not a monorepo. `git rev-parse --show-toplevel` returns
  `/home/pstevens/projects/baseweight/site` here and `/home/pstevens/projects/baseweight/service`
  for `../service`.
- Branch `main`, tracking `origin/main`, no ahead/behind against the last fetch (no fetch
  run). `.git/HEAD`, `.git/config`.
- Dirty: `M CLAUDE.md` (43 added lines, the "Agent operating rules" block) and untracked
  `docs/INTEGRATION-BRIEF.md`. Nothing else.
- Remote: `origin` = `git@github.com:baseweight-ai/site.git`. `.git/config`.
- `CLAUDE.md` existed before this feature: first added in `a10d9d6` (2026-03-03), re-added in
  `2d743c0` (2026-05-31), tracked at HEAD. `AGENTS.md` has never existed in any ref
  (`git log --all -- AGENTS.md` is empty).
- Documentation location: no ADR convention or ADR file exists in any ref. Docs sit at the
  root (`CLAUDE.md`, `COPY-STYLE.md`), beside data (`data/benchmark/DOCTRINE.md`), and, for
  this feature, in `docs/`. The ADR goes there as `docs/ADR-0001-retrieval-service-page.md`;
  the service repo's ADR numbers (its ADR 0064, brief §3) are a separate series.

## 2. Framework, runtime, packages

- No framework, bundler or build step: hand-written HTML pages at the repo root, each with an
  inline `<style>`, plus vanilla JS. `index.html`, `CLAUDE.md` (intro).
- Router: file-based static routes with clean URLs. `vercel.json:2`, `serve.json:2`. Live:
  `/retrieval-service.html` answers 308 to `/retrieval-service`.
- Package manager npm, lockfile `package-lock.json` (lockfileVersion 3). One devDependency,
  `@playwright/test` 1.59.1. `package.json:10-12`.
- Runtime version: not pinned (no `engines`, `.nvmrc`, `.node-version`, `.tool-versions`).
  Local: Node v24.13.1, npm 11.10.0, Python 3.13.9 (runs the test server). Vercel API: Node
  `24.x`. Playwright needs Node >=18 (`package-lock.json`).
- Third-party code loaded by pages: Chart.js 4.4.7 from jsDelivr on `/benchmark` only
  (`benchmark.html:26`); Google Fonts, IBM Plex Mono and Syne, on every page
  (`methodology.html:10`).
- Layout: one package, no workspaces. Shared code is `components.js` and `components.css`;
  page data in `data/benchmark/`; tests in `e2e/`.

## 3. Styling and tokens

- Plain CSS. Each page's `<style>` duplicates a `:root` token set and adds page rules;
  `components.css` holds the shared rules: skip link, nav, footer, focus ring,
  `.btn-ghost`/`.cta-routes`, the measurement-surface background, the one reduced-motion
  guard. `components.css:1-288`, `CLAUDE.md` (Structural invariants).
- Colours (`methodology.html:26-44`): `--bg-primary #080808`, `--bg-secondary #0d0d0d`,
  `--bg-card #111111`, `--bg-card-hover #161616`, `--border #1c1c1c`, `--border-accent #282828`,
  `--text-primary #e8e4de`, `--text-secondary #898580`, `--text-muted #807d76` (the AA floor,
  `CLAUDE.md`), `--accent #dcb875`, `--accent-hover #dbb960`. `/benchmark` adds model-family
  colours (`--color-opensource #60a5fa`, `--color-frontier #dcb875`, `--color-apift #4ade80`)
  and instrument tokens. `benchmark.html:48-58`.
- Token drift: `retrieval-service.html:31-46` lacks `--bg-card-hover`, `--accent-dim`,
  `--accent-glow`; `privacy.html:26-40` also lacks `--border-accent`.
- Type: family tokens only (`--font-display` Syne, `--font-mono` IBM Plex Mono); no size
  scale. Body 15px/1.75 on every page; prose 14px/1.85 (`methodology.html:177-180`); eyebrow
  `.section-label` 11px uppercase 0.15em; table headers 11px uppercase
  (`methodology.html:208-213`). h1 sizes are per-page `clamp()` values that differ
  (`methodology.html:98`, `benchmark.html:105`, `retrieval-service.html:59`).
- Spacing: `--max-width: 1120px` everywhere; gutter `clamp(24px, 5vw, 48px)`; `--section-pad`
  is `clamp(80px, 12vh, 140px)` on index, about, privacy and the stub, `clamp(60px, 8vh, 100px)`
  on benchmark and methodology (`retrieval-service.html:45`, `methodology.html:43`). Nav is
  72px (`components.css:53`); `scroll-padding-top: 96px` exists only at `index.html:55`.
- Breakpoints: hard-coded `max-width` queries, no tokens. 640px is the shared one (nav
  collapse, `components.css:198`); per page 860 (`methodology.html:242`, `index.html:538`),
  900 and 620 (`index.html:431-432`), 760, 700, 520.
- Dark mode: the site is dark-only. No `prefers-color-scheme` and no `color-scheme`
  declaration in any page or `components.css`, so a native form control renders with UA
  defaults unless styled.

## 4. Component inventory

| Kind | Existing | Source |
| --- | --- | --- |
| Buttons | `.btn-primary`, duplicated per page | `index.html:207-225`, `about.html:246-264`, `benchmark.html:177-178` |
| | `.btn-ghost`, `.cta-routes` (shared) | `components.css:248-268` |
| | `.carousel-btn`, the only `<button>` in page markup, with a disabled state | `index.html:388-406`, `798-799` |
| | `.task-tab`, buttons created by script | `benchmark.html:119-130`, `563-570` |
| Cards | `.who-card`, `.offer-card`, `.published-row` | `index.html:507-522`, `331-365`, `445-479` |
| | `.repo-card` | `methodology.html:227-239` |
| | `.repro-grid`/`.repro-art`; framed `.chart-container` | `benchmark.html:225-231`, `167`, `297-299` |
| Tables | `.table-wrap` + table: scrolls, uppercase headers, tabular numerals | `methodology.html:200-224` |
| | `.leaderboard-table`: sortable, expandable `role="button"` rows | `benchmark.html:139-160`, `268-295` |
| Legends | `.table-legend` (colour dot plus text); `.error-legend` | `benchmark.html:162-164`, `375-378`, `113-116` |
| Callouts, states | `.cta-block` closing CTA | `benchmark.html:174-176`, `306-309`, `398-401` |
| | `.bench-stamp` run stamp from data, hidden when empty | `benchmark.html:109-110`, `541-558` |
| | `.repro-prov` provenance line | `benchmark.html:231`, `727-735` |
| | "Results pending" placeholder, `.repro-pending` | `benchmark.html:838-846`, `222` |
| | `.hero-proof` link row, `.task-blurb`; `.bench-note` (CSS only, unused) | `benchmark.html:205-210`, `171`, `255-256` |
| Code | inline `<code>` only; no `<pre>` or code-block component | `methodology.html:317`, `benchmark.html:221` |
| Prose | `.methodology-content`: numbered h2s, `p.lead`, square bullets | `methodology.html:149-198` |
| | `.privacy-inner`, `.about-body-inner` (720px column) | `privacy.html:67-71`, `about.html:180-189` |
| | `.case-hero`/`.case-body` (the stub) | `retrieval-service.html:64-68` |
| Navigation aids | sticky TOC built from h2/h3 | `methodology.html:115-146`, `400-437` |
| | task tabs, `role="tab"` | `benchmark.html:119-130`, `561-572` |
| | mouse-driven tooltip | `benchmark.html:181`, `916-943` |
| Inputs | none on any page; `input:focus-visible` already has the ring | `components.css:224-232` |

Reuse for this feature:

- As is: `components.css` and `components.js` (nav, footer, `.reveal` observer).
- Copied into the page `<style>`, the repo's convention: `:root` tokens, `.page-hero`,
  `.section-label`, `.methodology-content`, `.table-wrap` (methodology); `.cta-block`,
  `.btn-primary`, `.bench-stamp`, `.repro-prov`, the `.table-legend` layout (benchmark); the
  `.carousel-btn` disabled-state idiom (index).
- Does not transfer: `innerHTML` rendering (11 uses in `benchmark.html`; brief §5b), the
  mouse-only tooltip, the tab pattern (no tabpanels), Chart.js, the grain overlay `body::after`
  (a `data:` image, §10).
- No precedent: text input, rung columns, live-region status, demo error states.

## 5. Content model

- Hand-authored HTML; no MDX, markdown pipeline or CMS. The long-form page `methodology.html`
  is static HTML in an `<article>`, with a TOC built client-side from its headings
  (`methodology.html:280-389`, `400-437`).
- Nav and footer render client-side into `<nav id="nav">` and `<footer>`
  (`components.js:11-64`).
- Data is fetched at request time, in the browser, from a committed same-origin JSON file; no
  build-time data and no server rendering (`benchmark.html:512-535`). That fetch's catch only
  logs (`benchmark.html:532-534`); brief §4 says not to follow it.
- `data/benchmark/results.json` is gitignored and force-added (`.gitignore:25`); a snapshot at
  another path, such as `data/retrieval-service/`, is not ignored.

## 6. Routing and navigation

- File-based routes with clean URLs in production and under `npx serve` (`vercel.json:2`,
  `serve.json:2`). The test server, `python3 -m http.server`, does not rewrite, so specs load
  `/<page>.html` (`playwright.config.ts:18-23`).
- One source for nav and footer links: `components.js:5-9` (Home, Benchmark, About), the CTA
  (`components.js:2`, `26`), the footer (`components.js:51-64`). The nav set is asserted
  (`e2e/site.spec.ts:59-70`).
- Redirects: `vercel.json:3-34`, mirrored in `serve.json:3-10`, asserted equal and permanent
  (`e2e/site.spec.ts:186-204`).
- Sitemap: hand-written `sitemap.xml`, five apex URLs, asserted, and barred from listing
  redirected or noindexed pages (`e2e/site.spec.ts:150-177`). Robots: `robots.txt` allows all
  and points at the apex sitemap. Noindex is per page by meta tag (`retrieval-service.html:10`).
- The target route exists: `/retrieval-service` is a noindexed stub linked from the homepage
  published row (`index.html:820`, asserted at `e2e/home.spec.ts:212-218`). Live: 200, and
  the served HTML is identical to `retrieval-service.html` at HEAD.
- The page list comes from disk (`e2e/copy-text.ts:16-21`; `convert.html` exempt at line 14):
  a new `.html` file fails the suite until it has a title expectation
  (`e2e/site.spec.ts:16-30`) and a word budget (`e2e/copy-budget.spec.ts:33-41`).

## 7. Closest precedent

**`methodology.html`**, the site's methods write-up: `.page-hero` with a breadcrumb eyebrow,
numbered h2 sections in `.methodology-content`, tables in `.table-wrap`, a sticky TOC that
collapses at 860px, a `.repo-card` at the end (`methodology.html:261-389`). Later tasks mirror
its layout.

The data-read precedent is `benchmark.html`: committed-JSON fetch (`512-535`), run stamp from
`generated_at` (`541-558`), legend (`375-378`), closing `.cta-block` (`398-401`).

## 8. Metadata and SEO

- Hand-written per page: `<title>`, `meta description`, `link rel="canonical"`, Open Graph
  (`og:type`, `og:url`, `og:title`, `og:description`, `og:image` = `/images/featured.jpg`, with
  1200x627 dimensions on all but methodology), `meta author`, `link rel="author"`
  (`methodology.html:6-22`, `247-248`; `retrieval-service.html:6-27`).
- Twitter card tags on index, about, benchmark and methodology; none on privacy or the stub.
  JSON-LD on index, about and privacy (`index.html:615-662`, `about.html:275-302`,
  `privacy.html:78-96`).
- Canonical, `og:url`, sitemap and robots use the apex `https://baseweight.co`
  (`retrieval-service.html:16`, `sitemap.xml`, `robots.txt:4`). Live: the apex answers 307 to
  `https://www.baseweight.co/`.
- Titles are asserted per page (`e2e/site.spec.ts:16-23`; the stub matches
  `/Retrieval service/`). Meta and OG content is linted as copy (`e2e/copy-text.ts:42-44`).

## 9. Deployment

- Host: Vercel, project `baseweight` (`.vercel/project.json`, local only, gitignored at
  `.gitignore:15`). Vercel API: framework `null`, Node `24.x`, GitHub `baseweight-ai/site`
  connected, production deploys from `main` (current production is `2511cbb`), domains
  `www.baseweight.co` and `baseweight.co` plus `*.vercel.app` aliases.
- Build command: none in the repo (no build script in `package.json`; no `buildCommand`,
  `outputDirectory` or `framework` in `vercel.json`). The Vercel API response carried no
  build-command setting; live, repo files are served from the root (`/COPY-STYLE.md` 200).
- Preview deploys: yes, per pushed branch (Vercel API: `READY` previews from branch `pivot`).
  Deployment protection is Vercel SSO on everything except custom domains
  (`ssoProtection: all_except_custom_domains`), so preview URLs need a Vercel login.
- Environment variables: nothing reads them (no build, no functions). `.env` and `.env.local`
  are gitignored (`.gitignore:11-12`); the only `process.env` read is `CI`
  (`playwright.config.ts:8`, `21`). The project's Vercel env list was not inspected.
- Server-side routes and edge functions: none. No `api/`, no `middleware.*`, no `functions`,
  `rewrites` or `routes` in `vercel.json`. A same-origin proxy is not possible without adding a
  server runtime, which brief §5a rules out and `AUTH = none` makes unnecessary: the browser
  calls the service directly.
- `.vercelignore` excludes only `CLAUDE.md`, `STRATEGY.md`, `COMPETITIVE-ANALYSIS.md` and
  `apps-script/`. Live: `/COPY-STYLE.md`, `/data/benchmark/DOCTRINE.md` and
  `/e2e/site.spec.ts` are publicly served, so `docs/` will be once committed.

## 10. Security headers

- One header rule, `source: "/(.*)"` (`vercel.json:35-61`): `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a CSP. Live headers on
  `/` and `/retrieval-service` match it.
- CSP (`vercel.json:56-57`): `default-src 'self'; script-src 'self' 'unsafe-inline'
  https://cdn.vercel-insights.com https://*.vercel-scripts.com https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src
  https://fonts.gstatic.com; img-src 'self' data: https:; frame-src 'none'; form-action 'none';
  connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com`.
- Where the API origin goes: `vercel.json`, the `headers` entry whose `source` is `/(.*)`
  (line 37), header key `Content-Security-Policy` (line 56), directive `connect-src`: append
  `https://baseweight-service.fly.dev`. The page's own rule (brief §5b) is a second `headers`
  entry with `source: "/retrieval-service"`, the clean path the `.html` URL redirects to.
- No CSP applies locally: `serve.json` has no headers and the test server sends none
  (`playwright.config.ts:18-23`).
- The grain overlay is a `data:` SVG loaded as a CSS background, which `img-src` governs
  (`methodology.html:62-71`, `benchmark.html:89-93`, `index.html:84-93`, `about.html:83-92`).

## 11. Quality gates

One gate exists: **`npm run test:e2e`** (`package.json:5`, runs `playwright test`). Config
`playwright.config.ts`: Firefox only, fully parallel, 1 retry locally and 2 when `CI` is set,
starts `python3 -m http.server 8080` and reuses a running one outside CI. Specs:
`e2e/site.spec.ts`, `e2e/home.spec.ts`, `e2e/benchmark.spec.ts`, `e2e/copy-lint.spec.ts`
(COPY-STYLE patterns over visible text, meta content and inline-script strings of 8+
characters, `e2e/copy-text.ts:65-78`), `e2e/copy-budget.spec.ts` (per-page word budgets).
Confirm a suspected flake with `--workers=1` (`CLAUDE.md`).

`test:e2e:headed` and `test:e2e:ui` run the same suite interactively; `setup:browsers`
installs Firefox (`package.json:6-8`).

Absent: lint (no ESLint, Stylelint or HTML validator), typecheck (no `typescript`; Playwright
transpiles the specs), build, CI workflow (no `.github/`), git hooks (`.git/hooks` holds
samples only), Claude Code hooks (none in `.claude/settings.local.json`). `squirrel.toml`
configures the squirrelscan crawler (CLI at `~/.local/bin/squirrel`), but nothing runs it and
it audits a live domain, so it is not a gate.

Recorded run, 2026-10-30 16:41:10 to 16:42:11 UTC, HEAD `2511cbb`, `CI` unset:

```text
Running 98 tests using 4 workers
  98 passed (55.6s)
npm run test:e2e  187.69s user 67.62s system 416% cpu 1:01.36 total
exit=0
```

By spec: site 36, home 27, benchmark 22, copy-budget 7, copy-lint 6. No failure, no flaky
test, no retry. The server log shows 146 requests answered 404, all for
`/_vercel/speed-insights/script.js`, a path only Vercel serves; no test depends on it. No
pre-existing failure.

## 12. Analytics and consent

- Every page loads Vercel Web Analytics (`https://cdn.vercel-insights.com/v1/script.js`,
  `defer`) and Speed Insights (`/_vercel/speed-insights/script.js` with the `window.si` stub)
  (`methodology.html:250-252`, `retrieval-service.html:74-79`). Live: both scripts 200.
  Beacons go to `va.vercel-scripts.com` and `vitals.vercel-insights.com` (`vercel.json:57`).
- Other third-party requests on load: Google Fonts on every page; jsDelivr on `/benchmark`.
- No consent gate: no banner, CMP or script gates any outbound call. `privacy.html:128`
  describes cookieless page-view counting; `privacy.html:127` and `144` name Cal.com, Google
  and Vercel as the only processors and say no form on the site collects data.

## 13. Accessibility and performance

- In use: skip link to `#main-content` on every page (`components.css:4-24`); one
  focus-visible ring for links, buttons and inputs (`components.css:224-232`); one
  reduced-motion guard (`components.css:276-288`); `aria-current` on the active nav link
  (`components.js:17-18`); labelled icon links (`components.js:57-59`); keyboard-operable
  carousel and expandable rows (`index.html:764`, `798-799`; `benchmark.html:763-765`,
  `830-834`); AA text tokens (`CLAUDE.md`).
- Gaps: tooltips open on mouseover only (`benchmark.html:916-943`); task tabs have
  `role="tab"` without `tabpanel` or `aria-controls` (`benchmark.html:561-572`); the nav toggle
  has no `aria-expanded` (`components.js:28`).
- Automated checks: no axe or contrast test. Behavioural assertions only: focus clears the
  fixed nav (`e2e/home.spec.ts:278-286`), a fast jump never paints a blank viewport
  (`e2e/home.spec.ts:288-301`), tab `aria-selected` (`e2e/benchmark.spec.ts:74-85`).
- Performance: font preconnect with `display=swap`; logo preload on index, about, privacy and
  the stub; deferred analytics; pinned reveal timing (`components.js:66-88`). Chart.js loads
  render-blocking in `<head>` on `/benchmark` (`benchmark.html:26`).
- Budgets: per-page word budgets only (`e2e/copy-budget.spec.ts:24-31`); no performance
  budget and no Lighthouse check.

## 14. i18n and line endings

- i18n: none. `lang="en"` on every site page (`convert.html:2` has none); JSON-LD
  `inLanguage: "en-US"` (`index.html:658`); dates formatted `en-GB` in UTC
  (`benchmark.html:545`).
- Line endings: not normalised. No `.gitattributes`; `core.autocrlf` and `core.eol` unset at
  every config level; `git ls-files --eol` shows all 35 text files LF in index and working
  tree, plus 3 binaries. Reported only (brief §7).

## 15. Noted, not fixed

- Tracked docs and specs outside `.vercelignore` are public (live 200: `/COPY-STYLE.md`,
  `/data/benchmark/DOCTRINE.md`, `/e2e/site.spec.ts`), against the intent stated at
  `.vercelignore:1-2`.
- `convert.html` is deployed (live `/convert` 200) and references `images/banner.jpg`, which is
  not in the repo (`convert.html:33`).
- Canonical URLs point at the apex, which answers a temporary 307 to www (`sitemap.xml`, each
  page's `link rel="canonical"`).
- `scroll-padding-top: 96px`, which `CLAUDE.md` describes as site behaviour, is set only at
  `index.html:55`.
