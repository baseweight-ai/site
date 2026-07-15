# Head-to-head: asset doctrine and build plan

The public head-to-head (at `/head-to-head`) is a sales/marketing asset: reason-to-believe for the buyer,
credibility for the technical reader. Its credibility is the whole asset: every public
number is reproducible from open code and weights, nothing cherry-picked, caveats named
before a critic does. The baseline is the cost-efficient API tier teams actually deploy
(5-shot), never the flagship. A public-data result is never their-data proof; the paid
engagement measures their data.

## Portfolio doctrine

Tasks form a spanning set: each pairs a distinct task shape with a distinct vertical so any
likely buyer recognises their own work in one tab; coverage over depth. Generation tasks
stay out (no objective ground truth). A new task must add a new shape or a new vertical.
Upcoming tasks appear as placeholder tabs with an honest status chip; a task goes live by
deleting its `upcoming` block once results land in `results.json`; statuses move only with
the pipeline. Mechanics: `TASKS` entries carry `shape` and optional
`upcoming: {status, note}`; e2e asserts shape/vertical uniqueness and derives tab counts
from the `TASKS` declaration. The full results (leaderboard, error analysis, reproduce)
are first-class page sections inside `#fullResults`, never collapsed: the results are the
page's content, and the panel hides only when an upcoming tab is selected.

## Next task: HS-code classification (customs / trade; MVB Lane 2)

Goal: a specialist Qwen3-8B LoRA vs the cost-tier API, classifying product descriptions to
their HS code at a realistically large label space, reproducible with the same code and
hashes as the live tasks. Chosen first because buyers discount small label spaces ("1-of-77
tells me nothing about 1-of-thousands"); a reproducible domain result at a realistic class
count converts the target segment. Buildable entirely on public data. Effort: ~1 to 1.5
weeks solo.

- **Task:** input = a messy free-text product description (plus structured fields where
  present); output = the HS6 subheading (~5,600 classes), with HS2 (96) and HS4 (1,228)
  rollups for partial credit; the model may return `escalate` instead of a code, which is
  the domain's real operating model (auto-classify the confident lines, route the rest to a
  licensed broker).
- **Data:** CBP CROSS rulings (public domain, authoritative: description + binding
  classification). Parse to `(description → HTS10)`, truncate to HS6, validate every label
  against the USITC HTS (also the label universe and hierarchy). Split by ruling (no
  leakage), stratified; ~1,500 test to match the live tasks. Parsing legal prose into clean
  pairs is the long pole: budget ~2-3 days. Vet any Kaggle supplement for license and label
  quality; deprioritize trade-flow datasets.
- **Label space:** headline HS6 restricted to codes with at least K train examples (start
  K=5); report the effective class count honestly ("1 of ~4,000 HS6 codes present in the
  data"). Fallback: headline HS4 and report HS6 as stretch. Never headline at
  small-cardinality scale.
- **Prompt:** one template for all conditions; the system prompt instructs returning a
  single HS6 code (or `escalate` when the description lacks the detail to classify
  confidently) plus a confidence between 0 and 1, as JSON. 5-shot prepends exemplars
  (fixed-seed, identical across models). LoRA trains on gold codes (omit `escalate` from
  targets); escalation is applied at inference by thresholding confidence, which yields the
  coverage-accuracy curve. Log raw generations.
- **Metrics:** macro-F1 at HS6 primary (long tail; accuracy alone flatters a majority
  guesser) plus accuracy; hierarchical HS2/HS4/HS6; an escalation-adjusted operating point
  (accuracy on the retained set at rate r, plus error rate on the auto-classified subset);
  `task_baselines` (random chance, majority class, min detectable effect, n_test,
  n_classes).
- **Conditions:** Qwen3-8B + LoRA (same base and method as the live tasks); API zero-shot
  and 5-shot with the 5-shot comparison foregrounded (fine-tuned-vs-zero-shot reads as a
  strawman); an embedding-kNN retrieval baseline (the cheap strong baseline a competent team
  would try; beating it is what convinces an ML-literate skeptic); a fine-tuned-API baseline
  as stretch, or name it as future work.
- **Wiring:** add the task to `results.json` exactly as the live tasks appear (scope,
  per-task comparisons, aggregates, cost summary, `task_baselines`, manifest with
  verification hashes); add the `TASKS` entry with a blurb naming the real difficulty
  (classify to HS6, ~5,600 possibilities, escalate contested lines); add `macro_f1` to
  `METRIC_LABELS` if not reusing an existing key; publish the reproduce bundle (adapter,
  eval data or pointer + hashes, raw prediction logs) to `baseweight-ai/benchmark`. A
  customs buyer's engineer will open the repo and check.
- **Site re-sync:** update the proof-strip snapshot per the provenance rule (`CLAUDE.md`);
  swap the interim "same shape as a customs line" relabels for the real result; keep the
  hero subtitle inside the future-proof rule (no counts, no time anchors).
- **Honesty:** record the honest outcome even if the owned model loses at full HS6; "wins at
  HS4, escalates ambiguous HS6 lines to a human" is a strong result. Name the caveats up
  front: HS6 vs the 10-digit HTS, genuinely contested lines, split construction.
- **Risks:** long-tail imbalance (macro-F1, stratified split, publish the distribution);
  hold the line at HS6 for v1 (HS10 later).

Second task after this one: product attribute extraction / large-taxonomy categorization
(the largest Lane 2 segments: MRO/industrial distribution and retail catalog). Candidate
public data: MAVE, a product-taxonomy set, or CORD/SROIE for the invoice/PO field-extraction
shape.
