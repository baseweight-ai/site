# Baseweight — Competitive Analysis (May 2026)

> Companion to `STRATEGY.md`. Input to the positioning-messaging pass. A decision
> record, not law — challenge it, and update it when the read changes.

## Provenance
Built from `STRATEGY.md` (the yardstick), the live copy on `index` / `pilot` /
`fit-score` / `about`, and ~15 web searches grounding the competitive set in current
(May 2026) reality. The April-2026 "Lean Canvas v5" framing (AI quality layer,
diagnostic→retainer) is superseded and was not used.

## Decisions locked with the founder (2026-05-31)
These are settled; the positioning pass inherits them.
1. **Hero leads with independent, technique-neutral _proof + judgment_.** Compliance /
   cost / quality rotate as the *situational* reason. No single wedge anchors the brand —
   all four erode.
2. **Primary addressee = the business buyer.** The technical gatekeeper is secondary,
   may not exist, and when present is often only *advising* the buyer. Do not optimise the
   main funnel for them; give them a *track* (benchmark/methodology), not the narrative.
3. **The benchmark's job = credibility + category proof, not a demand hook.** Translate it
   into the buyer's terms; never lead cold with "here are the hashes."
4. **"AI you own" is demoted from hero but kept.** Ownership is commoditising among the
   technical crowd but is still *news* to the ICP — it serves as category-introduction
   language, not as the differentiator.

---

## Headline finding: the awareness gap is the real battleground
The single biggest error to avoid is treating the market as one audience. There are two,
with **opposite levels of awareness**, and Baseweight straddles them awkwardly.

| | Practitioner / supply layer | **Business-buyer ICP (the wallet)** |
|---|---|---|
| Who | ML engineers, the gatekeeper, HN/DEV.to/Medium readers | Non-AI-native orgs; ops/product/compliance/eng-leadership buyers |
| Awareness (Schwartz) | **Product-aware** | **Problem-aware, solution-UNAWARE** |
| Belief about owned models | "Small fine-tuned open model beats frontier on a narrow task, 10–100× cheaper" = **2026 consensus, table-stakes** | "Frontier labs are the only serious AI; if GPT can't do it, it can't be done — and we can't use it, so we're stuck / we wait" |
| Baseweight's proof to them | A shrug ("everyone knows this") | **News** — a possibility they didn't know existed |
| Who they think competes | distil labs vs Lamini vs Fireworks vs DIY | "Our SI / our software vendor / wait for the next model" |

**The proof is consensus among practitioners and a revelation to buyers.** This resolves the
tension in the first draft of this analysis ("demote the benchmark" vs "lead with proof"):
both hold once the audiences are split. For the buyer, the benchmark *leads* — as credible
revelation, not novelty.

**Strategic consequence:** Baseweight's primary growth constraint is **awareness / category
creation**, not vendor differentiation. Most of the ICP isn't choosing a competitor over
Baseweight — they don't know the category exists. That is a positioning + education problem
before it is a competitive one.

---

## The competitive set — re-weighted for the business buyer
Per April Dunford: name the alternatives the *buyer* actually reaches for, and remember the
biggest is *no decision*. ⭐ = where deals are actually won and lost for this ICP.

### Lane A — the buyer's real alternatives (primary battleground)
| Alternative | What the buyer actually does | Why they pick it | The weakness in its strength (our opening) |
|---|---|---|---|
| **Status quo via unawareness** ⭐ | Keep paying the frontier API; "wait for the next model / for our vendor to add it"; squeeze prompts + RAG | Doesn't know an owned model is possible; frontier feels like the only serious option | The pain recurs every invoice and every model swap; for compliance cases there's *no* permitted frontier path at all — they're stuck by a belief, not a fact |
| **The SI / consultancy they already trust** ⭐ | Call Accenture / Deloitte / IBM / Capgemini / regional integrator; or wait for an incumbent SaaS vendor's "AI feature" | Owns the relationship, speaks the buyer's language, "nobody got fired for…" | Recommends its house stack and bills the programme regardless; no independent, reproducible proof it wins; no public benchmark; outcome is a dependency, not an owned, verified asset |
| **Analog / keep it manual** ⭐ (greenfield) | People / BPO / rules keep doing the task | It's "free," trusted, already audited | Cost, scale, consistency — but it's the real no-decision anchor when there's no AI yet |
| **Give up / shelved POC** | Tried AI once, it "felt off," quietly parked | Couldn't tell if it worked; no way to prove value | Exactly the measurement gap the Pilot closes — "you couldn't prove it, so you stopped" |

> *SIs/incumbents here are reasoning about how non-AI-native enterprises buy, not a searched
> fact — validate in discovery calls. If true, they are the dominant named competitor for
> this ICP and the first draft under-weighted them badly.*

### Lane B — the practitioner / gatekeeper lane (secondary)
These compete for the *gatekeeper's imagination* ("why not just use a platform / hire
someone?") far more than for the buyer's wallet. Most fail the ICP filter because they need
an in-house ML team — which the ICP is *defined* as lacking.

| Alternative | Current state (May 2026) | The weakness in its strength |
|---|---|---|
| **DIY / hire** (Unsloth, Axolotl + an ML hire) | Cheaper/easier than ever; "500 examples on one A100 in hours" | The ICP lacks exactly this; hides the judgment + verification gap; one departure and it's unmaintainable |
| **Self-serve fine-tune platforms** — distil labs ("replace LLMs with custom SLMs"), Lamini (on-prem/air-gapped, Memory Tuning), Fireworks/Together (bring-your-own-weights), Predibase (**→ acquired by Rubrik, Jun 2025**) | Funded, productised, self-serve; OpenPipe **→ acquired by CoreWeave, Sep 2025** (pivoted to RL/agents) | Need an ML driver; each has a *house technique to sell*; revenue depends on you staying on their stack; hand back a model, not an independent verdict |
| **Eval / observability SaaS** — Braintrust (now self-hosted/hybrid, "own your evals"), Langfuse, Arize/Phoenix, Galileo, W&B Weave | "Own your evals" is now a Braintrust feature (data plane in your VPC) | A *tool you must operate continuously* — assumes an ML team; measures, doesn't build or decide; ≠ a verdict + calibrated eval handed to a non-ML team |
| **Frontier-in-VPC & self-hostable vendor models** — Azure OpenAI / Bedrock / Vertex / MS Foundry; Cohere Model Vault (Apache-2.0 Command A+, air-gappable); Mistral on-prem/Studio | Compliance/ownership increasingly *table-stakes* at the infra layer | Solves *where the data sits*, not whether a *general* model is right on *your* task, cheapest at scale, or proven |

**Read across the two lanes:** the things that are "commoditising" (owned models, in-VPC,
own-your-evals) are commoditising **in Lane B**, where Baseweight doesn't sell. In Lane A the
category itself is still unknown. Don't import Lane B's "everyone knows this" pessimism into
Lane A messaging.

---

## The true threat (business-model lens)
1. **No-decision-by-unawareness is #1.** Not "we lost to a competitor" but "they never knew
   it was possible / believe the frontier is the ceiling." An education failure, not a
   competitive loss — and the largest single bucket.
2. **The trusted SI / incumbent vendor is #2.** For a non-AI-native enterprise, the default
   is to call who they already trust. Baseweight loses on relationship and "safety," not on
   merit. Counter with independence + proof + a cheap, low-risk entry.
3. **Wedge erosion is the slow threat.** Frontier price cuts erode *cost*; frontier-in-VPC +
   Cohere/Mistral on-prem erode *compliance*; ever-better small models make *quality* a
   coin-flip many will try themselves. Any single-wedge brand dates fast (→ Decision 1).
4. **Lane B (platforms/DIY) bites mainly through the gatekeeper**, who is secondary. Real,
   but not the primary battleground.

Helmer's structural read: the *technology* is commoditising while *distribution* consolidates
into funded platforms and neoclouds (CoreWeave⊃OpenPipe⊃W&B; Rubrik⊃Predibase). Baseweight
**cannot win on features or distribution.** Its durable powers are **counter-positioning**
(below) now, and a **cornered resource** (independent-benchmark brand + cross-engagement
pattern library) *later* — prospective, not present at small N.

---

## Asymmetries — what's genuinely hard to copy
Two are **counter-positioning**: stances incumbents can't copy without harming their own model.

1. **Independence + the honest "no" (counter-positioning).** A paid go/no-go that can say
   *"keep your API."* Platforms and SIs are structurally incented to say *yes, build it* and
   to keep you on their stack/programme. They can't match this without bleeding revenue. This
   is the single most defensible asset and is under-weighted on today's homepage.
2. **Technique-neutrality (counter-positioning).** "Every AI shop has a tool it's selling you;
   we don't." Credible *only because there's no product to push* — requires forgoing a
   product, so hard to fake. (The About page already nails this; promote it up-funnel.)
3. **Proof-as-outcome for a non-ML buyer.** Eval SaaS sells proof-as-a-tool (you operate it);
   platforms/SIs hand back a loss curve or a slide. Baseweight hands a *verdict + a calibrated
   eval* to a team that explicitly can't build one. The done-for-you judgment-and-verification
   gap is the live wedge.
4. **The commercial shape of the Pilot.** A cheap ($3–5k), fixed-scope, vendor-neutral
   "should you even build this?" has no product analog — platforms want you self-serving, SIs
   want the programme. Its nearest rival is a senior contractor's paid spike: slower, less
   independent, no public proof behind it.
5. **(Prospective) independent-benchmark brand + pattern library** — real moats *later*, not now.

---

## Where Baseweight is exposed (name it before a critic does)
- **Awareness creation is expensive and slow**, and it's now the gating constraint. Solo
  capacity vs. a category-education job is the core tension.
- **The moat is prospective.** Today it's one practitioner's credibility + a public benchmark.
- **Relationship disadvantage vs SIs/incumbents** with the exact buyers who are least
  AI-native. The cheap Pilot is the answer to "why risk an unknown" — lean on it.
- **Ownership / in-VPC / own-your-evals are losing differentiating power** (Lane B). Keep as
  qualifiers, not headline.
- **Channel risk (STRATEGY §4):** a benchmark-led message overshoots the buyer and resonates
  only with gatekeepers who can't buy — *and* now draws a shrug from practitioners. The
  benchmark must be pointed *to*, not broadcast *from*.

---

## The benchmark's job, reconciled
- **For the buyer (primary):** *reason-to-believe a new possibility.* It makes a claim they
  didn't know was achievable credible. Reframe in vertical/task terms they recognise
  (support routing, contract-clause extraction → "your equivalent of this").
- **For the gatekeeper (secondary):** credibility / no-red-flags sign-off and founder proof.
- **Not:** a cold demand hook or a novelty headline.

---

## Positioning handoff — angles to test (raw material for the pass)
**Spine:** move the center of gravity from *"own a model that beats the frontier"* (Lane-B
commodity) to *"the independent proof that tells you whether an owned model wins on your task —
and the owned result + eval if it does."* Then **introduce the category** the buyer doesn't
know about, and **prove** it.

Per-alternative angles:
- **vs. status-quo/unaware:** *"You think the frontier is the ceiling and you're locked out of
  it. There's a third option you may not know exists: a model you own that beats it on your
  one task — and we'll prove it before you commit."*
- **vs. the trusted SI / incumbent vendor:** *"Your SI recommends what it sells and bills the
  build either way. We prove what wins on your data first — and we'll tell you to do nothing if
  that's the honest answer."*
- **vs. wait-for-the-next-model:** *"The next frontier model doesn't change your unit economics
  or your compliance posture. An owned model that already wins on your task does."*
- **vs. DIY/hire (gatekeeper):** *"Fine-tuning is a weekend. Knowing it's actually right on your
  data — and keeping it right — is the job. That's what you don't have in-house."*
- **vs. platforms (Lane B):** *"Platforms hand you a model and a bill. We hand you a verdict
  that can say no — and we've no technique to sell you."*
- **vs. eval SaaS:** *"An eval tool assumes you have an ML team to run it. We hand you the
  verdict and the calibrated eval — built, not rented."*
- **vs. frontier-in-VPC / Cohere / Mistral:** *"In-your-VPC solves where the data sits. It
  doesn't make a general model right on your task, cheapest at your scale, or yours."*

**Stop / demote:** the raw "small model beats frontier, cheaper" *as a headline* (Lane-B
table-stakes); "you own it / no lock-in" as the lead differentiator (→ qualifier).

**Traps (Elena Verna — don't copy competitors):** don't chase distil labs' self-serve
"vibe-tuning" motion or platform feature-parity (Baseweight's point is the opposite:
done-for-you judgment for non-ML teams). Don't let "agentic AI / RL post-training" language
creep in — it pulls toward the gatekeeper audience that can't buy.

---

## Remaining open questions for the pass
1. **How much of the homepage is category education vs. selling?** An unaware buyer needs the
   "this is even possible" rung *before* the offer. How heavy should that lift be on the home
   page vs. a dedicated explainer?
2. **What vertical/task language makes the benchmark legible to a buyer?** Which 1–2 verticals
   do we frame the proof around first?
3. **What is the lowest-friction "reveal" format** — a one-line reframe, a short "did you know"
   strip, an interactive equivalent of the Fit check that *teaches* while it qualifies?
4. **Validate the SI/incumbent threat** in discovery: is that genuinely who the buyer would
   otherwise call?

---

## Sources (key external claims)
- [2026 is the year of fine-tuned small models](https://seldo.com/posts/2026-is-the-year-of-fine-tuned-small-models/)
- [Fine-tuned small models beat RAG: the 2026 economics](https://dev.to/dr_hernani_costa/fine-tuned-small-models-beat-rag-the-2026-economics-171h)
- [CoreWeave to acquire OpenPipe (Sep 2025)](https://www.coreweave.com/news/coreweave-to-acquire-openpipe-leader-in-reinforcement-learning)
- [Rubrik acquires Predibase (Jun 2025)](https://techcrunch.com/2025/06/25/rubrik-acquires-predibase-to-accelerate-adoption-of-ai-agents/)
- [Cohere deployment options / Model Vault](https://cohere.com/deployment-options) · [Command A+ (May 2026)](https://codersera.com/blog/cohere-command-a-plus-launch-guide-2026/)
- [Braintrust self-hosted evals 2026](https://www.braintrust.dev/articles/best-self-hosted-ai-evals-tools-2026)
- [distil labs](https://www.distillabs.ai/) · [Lamini product / on-prem](https://www.lamini.ai/product) · [Together AI fine-tuning](https://www.together.ai/fine-tuning)
- [Open-weights as enterprise infrastructure 2026](https://www.theregister.com/2026/04/12/ai_open_weights_models/)
