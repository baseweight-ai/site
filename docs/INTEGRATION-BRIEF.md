# INTEGRATION-BRIEF.md

## 1. The feature

A page on https://www.baseweight.co carrying a read-only live demo of a RAG service built in `~/projects/baseweight/service`, and the measured evaluation results of that service.

The page ships in three passes: the page itself first, with its results section in an explicit "measurement pending" state and no figures; the live demo second; the measured results third, when the service repo has produced them. On the page the demo leads the layout, whichever pass it arrives in.

## 2. The methodology the page must convey

The service's gold document ids come from the corpus's own provenance data, so retrieval quality is measured against ground truth rather than scored by another language model.

Two kinds of number follow, and the page must keep them distinct:

- **Measured** metrics (recall@20, nDCG@10) are computed over roughly 400 cases and gate the service's continuous integration: a change that regresses them cannot merge.
- **Judged** metrics (faithfulness, answer correctness) are computed over roughly 30 hand-written cases and are reported but not gated. At that sample size the 95% confidence interval is about ±14 percentage points; a gate that wide fires on noise.

Confidence intervals come from a clustered, paired bootstrap, clustered by source page because several questions can share one source page.

Where the page gives an `n`, it comes from the snapshot, never from the approximations above. With no snapshot committed it gives none.

The gated/advisory distinction must be visually **and** semantically distinct (carried in the accessible name, not by colour alone), with a legend defining both categories in one sentence each.

## 3. Upstream inputs

Filled from `~/projects/baseweight/service/HANDOFF.md`, which exists. Copy each value from it rather than retyping one. Where that file marks a field `UNKNOWN` or says a value was read from the service's code rather than from a call against the deployed service, carry that qualification across; do not drop it, and never guess a URL or a contract. If a field below has no counterpart in that file, leave it blank and say which.

HANDOFF.md was read against the deployed service on 2026-10-28 between 23:42 and 23:49 UTC, at commit `5eedbfd`. The allowed origins and the retry window were read again, and the compare limit observed, on 2026-11-01 from release v4 (`flyctl releases`), the service answering between 19:03 and 19:05 UTC, and the attribution read again that day from release v6, the service answering at 20:34 UTC. The schema and a comparison were read again on 2026-11-12 from release v7, the service answering between 00:56 and 00:57 UTC. Release v7 is what is deployed: it was built from commit `ec474ed` with no uncommitted change, and its health reported `git_sha` `ec474ed33f094d6f8ba5891673e3951333b4d211`. Between `5eedbfd` and `ec474ed`, `git diff` changes in the served code only the check of the origin list in `app/api.py`, the list itself in `fly.toml`, which v7's deployed configuration gives as v4's did, the attribution string read from v6, and each rung's `stages` in `app/api.py` and `app/schemas.py`, read from v7, so what HANDOFF.md reads from the earlier releases holds for v7.

- **BASE_URL** = `https://baseweight-service.fly.dev`
- **AUTH** = none
- **ALLOWED_ORIGIN** = `https://www.baseweight.co` and `http://127.0.0.1:8080`, and no other, from `flyctl config show`.
  - `http://127.0.0.1:8080` is a developer's copy of the site, served on that machine as `python3 -m http.server 8080` serves it and opened at that address. `http://localhost:8080` is a different origin and is not listed, though the same server answers both, so a page opened at `localhost` is refused. By `Settings` in `app/api.py` at the deployed commit, release v4 refuses a plain `http` entry unless its host is a loopback address written as an IP, so `http://localhost:8080` cannot be listed.
  - The apex, `https://baseweight.co`, is not listed and needs no entry: on 2026-11-01 it answered `307` to the same path on `https://www.baseweight.co` before any page loads. Its preflights were refused `403`: for `POST /v1/chat` on 2026-10-28, for `POST /v1/compare` on 2026-11-01.
  - Preview deployments are not listed, and the list cannot cover them: each has a host generated per deployment, and the list matches whole origins with no wildcard. `https://baseweight.vercel.app`, which serves production with no login, is not listed either (ADR 0065).
- **STREAMING** = not implemented
- **RATE_LIMITS** = `/v1/chat`: 20 per client per hour, from a call to `/v1/meta` | `/v1/compare`: 7 per client per hour, counted apart from chats, from calls on 2026-11-01, when one client's first 7 comparisons were admitted and its 8th was refused. Past either limit the answer is `429` `rate_limited`. The deployed `openapi.json` describes its `Retry-After` header, an integer of seconds, as sent "always for this client's own limit, for the provider's when it gave them". A `429` can therefore come without one.
  - A client is the address Fly's proxy puts in `Fly-Client-IP`, with an IPv6 address counted by its /64. The hour is any 3,600 s window. These come from `CLIENT_HEADER` and `CLIENT_PREFIX` in `app/api.py` and `HOUR_S` in `app/budget.py`, all at the deployed commit.
  - Script on a listed origin can read a `429`'s `Retry-After`, and it is the only header the service exposes. Every answer to a listed origin but a preflight carries `access-control-expose-headers: Retry-After`, and that header names nothing else. Read on 2026-11-01 by a page's script in Chromium 147.0.7727.15 and Firefox 148.0.2 (ADR 0065).
- **COMPARE_RUNGS** = `closed_book`, `bm25`, `hybrid` and `full`, in that order
- **STAGES** = each rung's `stages` lists the served pipeline's eight stages in the order it runs them, `rewrite`, `embed`, `dense`, `bm25`, `fuse`, `rerank`, `generate` and `verify`, each with `runs`, whether that rung runs it, so a stage the rung skips is listed with `runs: false`, never left out.
  - From a call: in the comparison of 2026-11-12, every rung listed all eight in that order. `closed_book` marked `generate` alone as run; `bm25` marked `bm25`, `generate` and `verify`; `hybrid` marked `embed`, `dense`, `bm25`, `fuse`, `generate` and `verify`; and `full` marked all eight.
  - **From the code at the deployed commit and the design, not a call.** The list describes the rung, not one run of it: a failed rung lists the same stages as an answered one, its `error` saying the run stopped, and nothing says at which stage. A stage left nothing to work on still runs, as `rerank` and `verify` do after a search that found nothing. `generate` is the one stage every rung runs, listed so that no stage goes unstated.
- **DAILY_CAP_BEHAVIOUR** = $0.15 a day from midnight UTC, shared by both endpoints. 503 body: not observed. **The cap and both 503 bodies are from the code at the deployed commit, not from a call against the deployed service.** Both bodies carry code `budget_exhausted`, with no `Retry-After`, so only `message` tells them apart:
  - The service's own daily cap: `{"error":{"code":"budget_exhausted","message":"the service's daily spend cap is reached","request_id":"…"}}`
  - The model provider's spend limit: `{"error":{"code":"budget_exhausted","message":"the model provider's spend limit is reached","request_id":"…"}}`
- **OPENAPI** = `GET https://baseweight-service.fly.dev/openapi.json`, from a call to release v7. OpenAPI 3.1.0, 9,871 bytes, sha256 `1f5decd86da99f8b67102c5f69a2a25e3d0d0e042eea2590551175e3fecd53f9`, generated 2026-11-12, between 00:56:41.545Z and 00:56:58Z, by the process whose `GET /v1/health` reported `git_sha` `ec474ed33f094d6f8ba5891673e3951333b4d211`, with no `-dirty` suffix. The same schema is also committed as `openapi.json` at the service repository's root, last changed in commit `ec474ed`.
- **RESULTS_JSON** = ABSENT. No measured evaluation run has finished, so no `results/latest.json` exists to read.
- **SCORECARD_MD** = blank: HANDOFF.md has no scorecard field.
- **EVAL_RUN_DATE/GIT_SHA** = blank: HANDOFF.md records that no measured evaluation run has finished. The deployed commit is not an evaluation run.
- **GATED METRICS** and **ADVISORY METRICS** = the eleven names below, and no others. **Read from the service's design, not from a results file, since no run has produced one: the names from its `docs/DESIGN.md` §8.3 and §8.6, the split from the gate block in §8.6.** HANDOFF.md names no metrics.
  - Gated: `recall_at_20`, `ndcg_at_10`.
  - Advisory: `recall_at_5`, `recall_at_50`, `mrr`, `answer_correct`, `faithfulness`, `citation_precision`, `citation_recall`, `abstention_correct`, `injection_asr`.
  - Each row's own `gated` field decides, not its name: whether a row gates depends on its tier and configuration too.
- **ATTRIBUTION_STRING** = the deployed `GET /v1/meta` response's `attribution` field, verbatim, read from release v6 at 2026-11-01T20:34:16.463Z:

  ```text
  Modified passages from Wikipedia articles, under CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/
  ```

  The passages' authors are credited only by each citation's link, the credit Wikipedia's terms of use let them be given, which the string no longer describes. Wherever the site shows a passage, it shows that citation's `page_title` and links its `url`, the article whose history lists them (ADR 0066).

- **KNOWN GAPS** = HANDOFF.md's Known gaps, verbatim:
  - No `503` was drawn. The two bodies under Daily cap are **from the code at the deployed commit, not from a call against the deployed service**.
  - No `429` was drawn in the check of 2026-10-28. On record are ADR 0064's, from `/v1/chat`, and 2026-11-01's, from `/v1/compare`, under Retry window.
  - The daily cap of $0.15 is **from the code at the deployed commit, not from a call against the deployed service**: no endpoint reports it, and no request here reached it.
  - No `500`, `502` or `413` was drawn, and no rung failed, so a failed rung's `error` object, its `null` `answer` and its `stages` were not seen.
  - The deployed code keeps the daily cap's and the hourly limits' counts in the process's memory, so each start begins them at zero. On the trial that happens on the first request after each 5-minute run. Not exercised here.
  - Suspend and resume were not exercised. On the trial the Machine is stopped, not suspended, so every arrival after a stop pays a cold start like the one above.
  - By the deployed code, a start that the service's own startup checks refuse exits before the service listens, so no request is served until the cause is fixed and the service redeployed. Not exercised.
  - Whether the chat's and the comparison's traces survived the deployment's 50% sampling was not checked.
  - The latencies above are single requests, not a distribution.
  - From HANDOFF.md's Uptime paragraph, verbatim:
    - Uptime: on Fly's free trial the Machine stops 5 minutes after each start, and the next request starts it again. How long the trial lasts: UNKNOWN.
    - A stopped Machine is started by the next request, which waits for it. Here `GET /v1/health` took 18.65 s end to end, with uvicorn listening about 15 s after the start (`flyctl logs`). The first chat after it took 16.0 s (`latency_ms` 15125), and the comparison after that 3.3 s. Release v7 was started the same way on 2026-11-12: `GET /v1/health` took 18.77 s, and the comparison, the first chat or comparison its process served, took 14.56 s (`latency_ms` 13815).
    - How much of the trial's runtime is left: UNKNOWN. Fly's API above reports no such figure.
    - What the URL answers once the trial ends or its runtime is spent: UNKNOWN. It was not observed.

## 4. The results snapshot

A committed file, copied verbatim from the service repo. The page reads it the way `/benchmark` reads `data/benchmark/results.json`, with a same-origin `fetch` of the committed file. Never fetch results from the service or any other origin.

```json
{"generated_at","git_sha",
 "dataset":{"repo","revision","tiers":{"<tier>":{"n"}}},
 "system":{"generator","embedder","reranker","index_version"},
 "judge":{"model","prompt_version","swap_order"},
 "metrics":[{"name","config","tier","slice","n","value","ci_low","ci_high","gated",
             "delta_vs_baseline","delta_ci_low","delta_ci_high"}],
 "ablations":[{"metric","tier","from_config","to_config",
               "delta","delta_ci_low","delta_ci_high"}],
 "operational":{"p50_latency_ms","p95_latency_ms","cost_usd_total"},
 "limitations":[]}
```

Required on every metric row: `n`, `ci_low`, `ci_high`, `gated`. Required on the document: a non-empty `limitations`.

`config` names which configuration of the service produced the row. `delta_vs_baseline` and its bounds are set only on rows from the deployed configuration, so treat them as optional. `ablations` compares one configuration against another and never belongs in a metric row.

One parser, `e2e/retrieval-service-schema.ts`, validates the committed snapshot in two places: a spec in the e2e suite (`npm run test:e2e`) fails on a malformed or truncated file, and the `vercel.json` build command runs the same check, so such a file also fails the deploy. The page never renders blanks or invented figures: when the fetch or the parse fails, it renders an explicit failure state. Follow `/benchmark`'s read, not its catch, which only logs to the console.

The `limitations` array renders verbatim and in full. Do not soften, summarise or omit entries.

## 5. Upstream API, if the demo ships

The handoff states the deployed `chunk_count` and `index_version`. Once a snapshot is committed, the page may say the demo serves the index the figures were measured on only if the handoff confirms the two match. Until then it says nothing about the relationship.

The service identifies a client by the address its own proxy sets, and it has verified that a client cannot forge that address. A same-origin server route in front of it therefore makes every visitor one client: one shared hourly allowance for the whole internet, exhausted by a handful of people. So a proxy is added only to inject a credential. If the handoff states `AUTH = none`, the browser calls the service directly, whether or not this site has a server runtime, and the service's own CORS, per-client limit and daily cap are what protect it. See §5a for the static case.

`POST /v1/compare` is the demo. One question, several rungs, answered side by side (nothing retrieved, lexical retrieval only, hybrid retrieval, and the full pipeline), so a visitor watches the difference the pipeline makes rather than being told it. Each rung returns its own name, label, answer, citations, retrieved passage titles, stages, latency, usage, charged amount, and an error field that is set when that rung alone failed. Its `stages` lists every stage of the served pipeline, in order, each marked as run or not by that rung (§3, STAGES), so each column draws its own pipeline from that field and keeps showing `label` as the rung's own words. The field describes the rung, not one run of it, so a failed rung lists the same stages. A column whose rung carries no `stages` shows no pipeline. Read the deployed `openapi.json` for the exact shape and do not infer it from this paragraph; one comparison costs several generations, so this endpoint has a tighter rate limit of its own and the handoff states it.

`POST /v1/chat` answers once on the full pipeline. It is the simpler endpoint and the less interesting one. Request `{"query": str 1..2000, "session_id": str?, "top_k": int? 1..8}`

```json
{"answer":"string with inline [c1] markers",
 "citations":[{"marker":"c1","chunk_id":"…","source_doc_id":"…","page_title":"…",
               "url":"https://en.wikipedia.org/…","snippet":"…","score":0.0,
               "supported":true}],
 "citation_supported_ratio":0.0,
 "trace_id":"…","model":"…","index_version":"…",
 "usage":{"input_tokens":0,"output_tokens":0,"cost_usd":0.0},
 "latency_ms":0,"charged_usd":0.0}
```

`GET /v1/meta`: model ids and licences, corpus name, required attribution string, limits, `public_mode: "read_only"`.

Errors: one envelope for every non-2xx.

```json
{"error":{"code":"rate_limited|budget_exhausted|invalid_request|upstream_error|internal",
          "message":"…","request_id":"…"}}
```

Two states need distinct user-facing treatment:
- `429` carries a `Retry-After` header in seconds. Render the retry window.
- `503` with code `budget_exhausted` is the daily spend cap, not an outage. Render "the daily demo budget is spent", never a generic error.

Display `citation_supported_ratio` in the demo.

The question box is an `<input>` and a `<button>` with a click handler, with Enter handled in script. No `<form>` element: the e2e suite fails any page that carries one, and the site CSP sets `form-action 'none'`. Both stay.

A citation's `score` is on a different scale on each rung, as the handoff's responses show. The widget never compares scores across rungs or renders them on one scale.

The site must not offer trace links. They are not public: traces go to Langfuse Cloud, which answers `401` without credentials, and ordinary traces are kept at 50% sampling, so a returned `trace_id` can name a trace that was not kept.

## 5a. If this site has no server runtime

Nothing changes. With `AUTH = none` there is no credential to inject, so a static site calls the deployed endpoint directly from the browser, exactly as a site with a server runtime does. Confirm from the handoff that this site's origin is in the service's CORS list and that its rate limit and daily cap are stated.

Do not add a backend to a static site, and do not conclude from a static export that the demo cannot ship. If the handoff states any credential at all, the demo does not ship without a server runtime; say so and stop.

## 5b. Rendering model output

The service returns model output unaltered, so that the answer it serves is the one the eval scores. The defence against anything embedded in it is here, not there. The page:

- inserts `answer`, each citation's `snippet` and `page_title`, and each rung's answer as text, never through `innerHTML` and never through a Markdown renderer;
- makes links only from a citation's `url`, which the service builds from a page title, and auto-links nothing in model output;
- loads no image or other resource named in model output;
- uses the `[cN]` markers only to attach citations;
- sets a Content-Security-Policy limiting `img-src` and `connect-src` to this site and the API, so a rendering mistake still fetches nothing elsewhere.

With the demo, the site-wide policy in `vercel.json` gains the API origin in `connect-src` and nothing else. `connect-src` therefore keeps the site's existing Vercel analytics origins, the one deviation from the bullet above. `vercel.json` headers take a per-path `source`, so the page gets its own rule with `img-src 'self' https://baseweight-service.fly.dev`. That rule repeats the rest of the site policy, so it holds whether the host sends both headers or only the page's.

## 6. Attribution

The corpus is Wikipedia under CC BY-SA. Render the attribution string from §3 wherever this site places such notices. Published results contain question ids, gold ids and scores only, never corpus text.

## 7. Line endings

If this repo lacks a `.gitattributes` normalising line endings, report it as a risk but do not add one. Renormalising an existing repo rewrites every file and buries this feature's diff.
