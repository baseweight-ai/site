# Benchmark task spec: HS-code classification (customs / trade)

_Written 2026-07-10 for the `baseweight-ai/benchmark` repo (paste as an issue). Companion to the two live tasks (banking77 support triage, cuad contract review). Effort estimate: ~1 to 1.5 weeks solo._

## Why this task, why first

The site's conversion audit (six ICP persona walk-throughs, run twice) converged on one blocker copy cannot fix: **no proof on the buyer's own task.** The customs / logistics wedge is Tier 1 (8 live prospects), and the customs-broker persona was explicit twice: a **reproducible HS-classification benchmark at a realistic class count** would book the call the same day. He (and the industrial COO, and the build-capable CDAO) all discounted banking77 for the same reason: "1-of-77 tells me nothing about 1-of-thousands."

This task:
- Converts the highest-value wedge with a domain result instead of the interim "same shape as a customs line" relabel currently on the site (personas dismissed that relabel as an assertion, not proof).
- Extends the existing classification harness (banking77) rather than inventing new machinery: same base model, same conditions, same `results.json` schema, just a large, domain-relevant label space.
- Is buildable entirely on **public data** (no customer data), which is the whole point: the benchmark earns the call, the paid Pilot proves their data.

## Task definition

- **Input:** a product description (free text, realistically messy). Optionally append structured fields where present (material, use, composition).
- **Output:** the Harmonized System code at **HS6** (the internationally standardized 6-digit subheading, ~5,600 classes). Also score the **HS2** (chapter, 96) and **HS4** (heading, 1,228) rollups for hierarchical / partial credit.
- **Abstain / escalate option:** the model may return `escalate` for low-confidence items instead of a code. This is not a nicety, it is the domain's actual operating model and it maps to two things the personas care about: the cuad philosophy already on the benchmark ("a confidently invented clause is worse than a missed one" -> a confidently wrong HS code is a penalty, an escalate is not) and the site's augment framing ("handles the high-volume first pass, routes the ambiguous cases to your experts"). Report auto-classify accuracy at a given escalation rate.

## Dataset

- **Primary source: CBP CROSS rulings** (Customs Rulings Online Search System). Public domain (US government work), authoritative, and shaped exactly like the task: each ruling carries a product description and the binding classification decision. The customs persona named CROSS himself as the credible public source.
  - Parse rulings into `(description -> HTS10)` pairs, truncate the label to HS6 for the international-standard headline (keep HS10 for a stretch/national-tariff view).
  - Validate every label against the official **HTS nomenclature** (public) so codes are real and current.
- **Cross-check / supplement (optional):** public HTS nomenclature for the label universe; a vetted Kaggle product->HS set only if its license is permissive and labels check out.
- **Splits:** hold out **by ruling** (no description leakage across train/test); stratify to keep rare chapters represented; report the class distribution (HS is long-tailed, a few headings dominate).
- **Sizes:** target the existing tasks' scale, a few hundred to ~1,000+ train (harness `avg_n_train` is small by design) and ~1,500 test (matches banking77 / cuad `n_test`).
- **Licensing note:** confirm CROSS terms; US-government-work public-domain status is ideal for a reproducible public benchmark and should be stated in the methodology.

## Label space (the load-bearing decision)

- **Headline at HS6 (~5,600 classes).** This is the "1-of-thousands" that answers the banking77 critique head-on, two orders of magnitude beyond 77, and internationally standard (not US-only).
- Report **HS4 (1,228)** and **HS2 (96)** as hierarchical rollups (getting the chapter/heading right is meaningful to a customs pro even when the subheading is contested).
- Fallback: if HS6 is too sparse to train/measure reliably on the available rulings, **headline HS4** and report HS6 as the stretch tier. Do not headline anything at banking77-scale cardinality; the whole point is a large label space.

## Metrics

- **Primary:** macro-F1 and accuracy at HS6 (macro-F1 because of the long tail; accuracy alone would flatter a majority-class guesser).
- **Hierarchical:** HS2 / HS4 / HS6 accuracy (partial credit).
- **Escalation-adjusted:** accuracy on the auto-classified subset vs escalation rate (a coverage/precision curve). Headline one operating point, e.g. "at X% auto-classified, Y% correct, contested lines escalated."
- **Statistical baselines** (populate `task_baselines.<id>`): `random_chance` (1/n_classes), `majority_class_accuracy`, `min_detectable_effect_pp`, `n_test`, `n_classes`. At ~5,600 classes these make the difficulty legible and pre-empt "the model is just guessing the top class."

## Models and conditions (match the existing harness exactly)

- **Owned:** Qwen3-8B + LoRA (same base and method as banking77 / cuad).
- **API baselines:** hosted API **zero-shot** and **5-shot**. Foreground the **5-shot** comparison as the honest "API tier you'd deploy" (the build-capable persona flagged fine-tuned-vs-zero-shot as a strawman; the harness already runs 5-shot, so lead with it).
- **Stretch, for credibility:** a fine-tuned-API baseline if affordable, or explicitly note it as future work so the strawman critique is named before a critic raises it.

## Harness / `results.json` integration

Wire the new task (`hs_classification`, or `hts6`) into `data/benchmark/results.json` exactly as banking77/cuad appear:
- `scope.task_ids` (+ bump `scope.n_tasks`)
- `comparisons.lora_vs_5shot.per_task.<id>` and `comparisons.lora_vs_zero_shot.per_task.<id>`
- fold into the top-line aggregates: `tasks_won_by_oss`, `cost_per_correct_ratio`, `avg_accuracy_gain_pp`, and each `comparisons.*` block's `tasks_won` / `avg_` / `median_accuracy_gain_pp`
- `cost_summary` contributions (`total_training_cost`, `avg_training_cost`, `avg_training_time_min`, `avg_n_train`, `avg_cost_per_query_by_condition`)
- `task_baselines.<id>` (the statistical baselines above)
- `manifest.tasks.<id>` and `manifest.adapters["qwen3-8b/<id>"]` with verification hashes
- `hardware` / `pricing_provenance` already global, no change beyond noting the run

Benchmark page (`benchmark.html`):
- Add to the `TASKS` array: `{ id: 'hs_classification', name: 'Customs classification', vertical: 'Trade / Logistics', blurb: '...' }`. The blurb should name the real difficulty (classify a product to its HS6 code, ~5,600 possibilities, escalate the contested lines), not "same shape as."
- Add any new metric key to `METRIC_LABELS` (e.g. `macro_f1`) if not reusing `weighted_f1`/`accuracy`.
- The leaderboard, "where the errors go" chart, and "Reproduce any number" panel are data-driven and populate from `results.json` automatically.

Reproducibility bundle to GitHub (same contract as the other two tasks): released adapter, eval data (or a pointer + hashes), raw prediction logs, verification hashes. A customs COO **will** open the repo and check, so it has to survive scrutiny.

## Site copy re-sync (marketing repo, per its CLAUDE.md data-provenance rule)

- **Homepage proof strip** is a hardcoded snapshot derived from `results.json` (see the DATA PROVENANCE comment above the `#proof` section). Re-sync the tiles if the headline numbers shift, and **swap the interim relabel** ("The same test runs on yours: ... classifying a part or a customs line ...") for a real line, e.g. "classifying a product to the correct HS code, 1 of ~5,600." Same for the benchmark task-blurb "Same shape as routing a ... customs line" append, replace with the real result.
- **Benchmark hero subtitle:** "A couple of tasks so far, with more underway" -> the real count ("three tasks ...").
- Update the DATA PROVENANCE comment block to include the new task's raw rows and derivation.
- **e2e:** the benchmark page tests are structural (title, nav, footer, CTA -> cal.com) and do not assert task content, so no assertion changes are required; add a task-count assertion only if wanted.

## Honesty / scope guardrails (from STRATEGY.md)

- A public-data result is **not** their-data proof. Keep the bridge: "proven for real on your data in the Pilot."
- The baseline is "the API tier you'd actually deploy" (5-shot cost tier), not the frontier flagship. Say so.
- Everything reproducible from open artifacts, nothing cherry-picked. Name the caveats before a critic does: HS6 vs full 10-digit HTS; a real fraction of lines are genuinely contested (binding rulings exist for a reason); how the test split was built.
- Frame the outcome as "clears the routine lines accurately and escalates the contested ones to your licensed broker," not "replaces the broker." This is true, and it is the same augment message the site now leads with.

## Acceptance criteria (definition of done)

- [ ] HS6 classification task live on `/benchmark`, label space >= ~1,000 (target ~5,600), with the same reproduce artifacts + hashes as banking77 / cuad.
- [ ] Reports macro-F1 + hierarchical (HS2/HS4/HS6) accuracy + an escalation-adjusted operating point + the statistical baselines.
- [ ] Honest outcome recorded even if the owned model does **not** beat the 5-shot API at full HS6: headline HS4, or the escalation-adjusted number, and say which. An honest "wins at HS4, escalates ambiguous HS6 to a human" is still a strong, on-brand result (the paid go/no-go is the brand).
- [ ] `results.json` updated, benchmark page wired, homepage snapshot re-synced, interim "same shape as" relabels swapped for the real result.
- [ ] Reproducible bundle published to `baseweight-ai/benchmark`.

## Risks and mitigations

- **CROSS prose -> clean (description -> HS6) pairs is the long pole** (rulings are legal prose with the code embedded). Mitigation: start with a validated subset, check every label against the HTS, iterate. Budget ~2-3 days here.
- **Long-tail class imbalance.** Mitigation: macro-F1, stratified split, publish the distribution.
- **The owned model may not beat the 5-shot API at full HS6** (genuinely hard at 5,600 classes). Mitigation: report hierarchical + escalation-adjusted; be honest; an HS4 headline with HS6-escalation is still credible and on-brand. Do not overclaim to hit a number.
- **Scope creep to full 10-digit HTS.** Hold the line at HS6 for v1; HS10 is a later stretch.

## Then: the second task

Product attribute extraction / large-taxonomy categorization (covers the biggest wedge, industrial/MRO + catalog: the industrial COO's exact ask). Reuses this entire harness path. Candidate public data: MAVE (Amazon product attributes), a product-taxonomy set, or CORD/SROIE for the invoice/PO field-extraction shape. The generative/multilingual content task (fashion wedge) is a distant third: it needs a subjective-quality eval and that wedge is Tier 2.
