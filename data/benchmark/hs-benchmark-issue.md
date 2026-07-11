# Issue: Add benchmark task — HS-code classification (customs / trade)

Labels: `benchmark-task`, `priority-high`
Companion: `hs-benchmark-spec.md` (motivation, results.json wiring, site re-sync, acceptance). This issue is the concrete build: **data, prompt, metric, label space, baselines.**

One-line goal: a third public task on the leaderboard, a specialist Qwen3-8B LoRA vs the cost-tier API, classifying product descriptions to their HS code at a realistically large label space, reproducible with the same code + hashes as banking77 and cuad.

---

## 1. Data candidates

**Primary (task + gold labels): CBP CROSS rulings** — `rulings.cbp.gov` (Customs Rulings Online Search System).
- US government work, public domain. Each classification ruling contains a product description (often detailed, sometimes messy) and the binding classified HTS number. This is the task, verbatim, and authoritative.
- Extract `(description, HTS10)` per ruling; truncate the label to **HS6** for the international-standard headline (retain HTS10 for a stretch view).
- Volume: tens of thousands of classification rulings historically, enough for a train + ~1,500 test split.
- Access: confirm the bulk-export / API path vs scraping the search UI (verify current terms before committing). **This parsing (legal prose -> clean `(desc, HS6)` pairs) is the long pole, budget ~2-3 days.**

**Label universe + official code descriptions: USITC HTS** — `hts.usitc.gov`, downloadable JSON/CSV, public domain.
- Use to (a) validate every extracted label is a real, current code, (b) source official code descriptions (candidate label text for prompts / retrieval), (c) get the HS2/HS4/HS6 hierarchy for rollups.

**International standard: WCO HS nomenclature (HS6).**
- HS6 is internationally harmonized; the HTS already embeds it, so the truncated HTS labels are valid HS6. (Full WCO nomenclature DB may be license-gated; not needed, the HTS gives HS6.)

**Candidates to VET (do not assume license / quality):** Kaggle sets (search "HS code classification", "HTS product classification"), academic product-to-HS categorization datasets. Only use with a permissive license and after label spot-checks against the HTS. **Deprioritize** US Census USA Trade Online (commodity trade flows, not clean description->code pairs).

Why this is fine to build now: CROSS + HTS are public and authoritative, so **no customer data is required.** The benchmark earns the call; the paid Pilot proves their data.

---

## 2. Label space

HS structure (HS 2022 edition; counts approximate, edition-dependent):
- 21 sections, **96 chapters (HS2)** (numbered 1-97, Ch. 77 reserved), **1,228 headings (HS4)**, **5,612 subheadings (HS6)**, US HTS extends to 8/10 digits (**~19,000 lines**).

Decision:
- **Headline at HS6.** Restrict to HS6 codes with **>= K train examples** (start K=5) so every class is learnable and measurable; report the **effective class count** and test coverage. Expect an effective space of a few thousand HS6 classes, two orders of magnitude past banking77's 77, which is the whole point (personas explicitly discounted 1-of-77).
- Report **HS2 and HS4** as hierarchical rollups (partial credit; chapter/heading correctness is meaningful to a customs pro).
- **Fallback:** if HS6 coverage is too thin to train/measure, headline **HS4** and report HS6 as stretch. Never headline at banking77-scale cardinality.
- State the effective count honestly on the site (e.g. "1 of ~4,000 HS6 codes present in the data"), not the theoretical 5,612.

---

## 3. Prompt

Same input for all conditions (only the exemplars / weights change). Proposed template (tune during dev):

**System:**
```
You are a customs classification assistant. Given a product description, return the single
most likely Harmonized System (HS) 6-digit subheading that classifies the good. Use only the
6-digit international HS level. If the description lacks the detail needed to classify
confidently, do not guess: return "escalate". Respond as JSON only:
{"hs6": "NNNNNN" | "escalate", "confidence": 0.0-1.0}
```

**User (zero-shot):**
```
Product: {description}
```

**5-shot:** prepend 5 `Product: ... -> {"hs6": "...", "confidence": 1.0}` exemplars drawn from train. Match the exemplar-selection method the existing tasks use (fixed-seed random unless the harness does nearest-by-embedding); keep it identical across models for fairness.

**LoRA fine-tune target:** the JSON with the gold `hs6` (train on gold codes; omit `escalate` from targets).

**Escalation is applied at inference, not trained:** threshold the model's confidence (verbalized `confidence`, or max-softmax / sequence logprob if available) to produce the abstain decision. Sweeping the threshold gives the coverage-accuracy curve (metric 4 below). This mirrors deployment ("auto-classify the confident lines, route the rest to a broker") and the site's augment framing.

Output parsing: extract the 6-digit code (regex `\b\d{6}\b` within the JSON), normalize (strip separators), map to `escalate` on parse-failure-or-abstain. Log raw generations for reproducibility.

---

## 4. Metric

On the held-out test set:
- **Accuracy@HS6** = fraction with predicted HS6 == gold HS6. Report both overall and on the auto-classified (non-escalated) subset.
- **Macro-F1@HS6** = mean of per-class F1 over the effective classes (macro, because the class distribution is long-tailed; accuracy alone flatters a majority guesser). Primary quality metric.
- **Hierarchical accuracy:** Acc@HS2 (first 2 digits match), Acc@HS4 (first 4), Acc@HS6 (all 6). Partial credit across the tree.
- **Escalation-adjusted (coverage-accuracy curve):** for escalation rate `r`, accuracy on the retained `(1-r)`. Headline one operating point (e.g. the `r` where auto-error <= a stated target) and report **error rate on the auto-classified subset** (the cost-of-being-wrong number a customs COO actually weighs).
- **task_baselines.<id>** (schema-required): `random_chance` = 1/effective_n_classes; `majority_class_accuracy` = frequency of the most common test class; `min_detectable_effect_pp` from `n_test`; plus `n_test`, `n_classes`.

Report macro-F1 as the leaderboard metric (add `macro_f1` to `METRIC_LABELS` if not reusing `weighted_f1`).

---

## 5. Baselines / conditions

Match the existing harness (Qwen3-8B base, LoRA, cost-tier API), and add the two starred rows for credibility against the "you only beat zero-shot" critique:
1. **API zero-shot** — the same cost-tier hosted model the other two tasks baseline against ("the API tier you'd deploy," not the frontier).
2. **API 5-shot** — same model, 5 exemplars. **Foreground this comparison** (the build-capable persona called fine-tuned-vs-zero-shot a strawman; the harness already runs 5-shot).
3. **Qwen3-8B + LoRA (owned)** — match the LoRA config used for banking77/cuad (see `manifest.adapters`); this is the headline "owned model."
4. **Majority-class + random** — context only, feeds `task_baselines`.
5. **(add) Embedding-kNN retrieval** — embed the description, retrieve nearest train example(s), vote the label. A cheap, strong baseline a competent team would actually try; beating it (not just zero-shot) is what makes the win credible to an ML-literate skeptic.
6. **(stretch) Fine-tuned-API baseline** — if affordable; otherwise name it as future work so the comparison's honesty is explicit.

Cost: log per-condition `avg_cost_per_query_by_condition` (API token spend for the API rows; amortized GPU for LoRA + kNN) so the TCO calculator and the "28-138x" framing extend to this task on real numbers.

---

## Build checklist

- [ ] Extract + validate `(description, HS6)` from CROSS against the HTS; build a by-ruling, stratified train/test split; record the class distribution.
- [ ] Run conditions 1-6; sweep the escalation threshold; compute metrics in section 4.
- [ ] Emit adapter + raw prediction logs + verification hashes; publish the reproduce bundle to `baseweight-ai/benchmark`.
- [ ] Wire into `results.json` and `benchmark.html` per `hs-benchmark-spec.md` (scope, comparisons.per_task, task_baselines, manifest, cost_summary, TASKS array, blurb).
- [ ] Re-sync the homepage proof snapshot; swap the interim "same shape as ... a customs line" relabels for the real HS6 result; update the benchmark hero task count and the DATA PROVENANCE comment.

## Acceptance (see spec for full list)

- HS6 task live on `/benchmark`, effective label space >= ~1,000 (target a few thousand), same reproduce artifacts + hashes as the other two tasks.
- Reports macro-F1 + hierarchical + escalation-adjusted + the statistical baselines.
- **Honest outcome recorded even if the owned model does not win at full HS6:** headline HS4 or the escalation-adjusted number and say which. "Wins at HS4, escalates the ambiguous HS6 lines to a human" is a strong, on-brand result, the paid go/no-go honesty is the brand.
- Baseline stated as the deployable cost tier, not the frontier; all numbers reproducible from open artifacts; caveats (HS6 vs HTS10, contested lines, split construction) named up front.
