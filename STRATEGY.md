# Baseweight — strategy (current working baseline)

> The current, agreed strategy — the yardstick for copy, design, and offers. It is a
> **decision record, not law**: challenge it freely in review, and when a decision changes,
> update it here so it stays the single source of truth. Structural/build facts live in `CLAUDE.md`; the competitive read and the awareness-gap analysis live in `COMPETITIVE-ANALYSIS.md`.

## Who it's for

**Hard qualification — the only filter on who can buy:**
1. Wants, or would benefit from, a custom open-source AI solution they own, **and**
2. Representative data exists or is capturable, **and**
3. Is willing to pay for it.

**Ideal-buyer persona (shapes messaging + beachhead — not a filter):**
- AI isn't core to the product/service they sell.
- Their process has narrow, measurable tasks that are (or want to be) AI-powered.
- A frontier API isn't viable or preferred — for compliance, cost, quality, or mere preference.
- The cost of the task being wrong is high.
- No in-house ability to define-correct / diagnose / fix / verify, and no reason to build it.
- **Solution-unaware:** feels the problem but does not know an owned open-source model can beat the big platforms on a narrow task — the claim is *news* to them (only consensus among ML practitioners). Messaging must reveal the category, then prove it.

**Other audiences to account for (not the buyer, but they gate or amplify):**
- **The buyer's technical gatekeeper** — a skeptical ML/AI advisor who can veto on credibility.
  Win = no red flags, no overclaim, earns their sign-off. **Secondary — may not exist, or may only advise the buyer; give them a credibility track (benchmark/methodology), but do not let their language lead the buyer’s narrative.**
- **Peers / potential partners, hires, mentors** — the ML/AI crowd who see the public benchmark.
  Win = earns respect, worth engaging with.

## The problem (their words)
1. AI gets it wrong and we can't fix it.
2. We're not allowed to use the big AI platforms everyone else uses.
3. AI is too expensive to run at our scale.
4. We tried to fix or build an AI, and can't tell if it worked.

## The solution
Supply the judgment they lack and deliver a **custom AI solution they own, with proof it can be
trusted** — replacing or enabling a result they couldn't get (compliantly / affordably / accurately)
from a frontier API. Offer ladder:
- **Scan** — cheap, ICP-gated read on a data sample: is it worth proving? *($1,500, a ~1-day read, credited toward the Pilot.)*
- **Pilot** — the paid proof on their data: a go/no-go verdict + the reproducible eval they own
  (+ a proof artifact; TCO for cost-led cases). *($6–9k, a ~1-week fixed-scope box.)*
- **Build** — build the solution, prove it hits the bar, hand off everything (weights, eval,
  configs, recipes). *(Value-priced from ~$25k, scoped from the Pilot.)*
- **Assurance** — keep proving it as models and data change. *($2–10k/mo, tiered.)*

> Prices are pre-revenue working hypotheses (set 2026-05-31), timebox-anchored to bound solo
> delivery cost (Scan ~1 day, Pilot ~1 week); revisit after ~3 engagements once real delivery
> time and WTP are known. The cost-vs-API wedge is eroding (API prices fell ~80% YoY) — anchor
> Build value on cost-of-error × volume, not on being cheaper than the API.
>
> **Site presentation (2026-06-01):** the homepage merges pricing + the design-partner ask into one
> "Founding partners" block — Scan $1,500 and Pilot $6–9k shown as *founding rates*; Build is
> "scoped — founding-partner terms" and Assurance "by arrangement" (the ~$25k / $2–10k figures stay
> internal estimates, not published). No anchor/strike-through pricing.

## Strategy

### 1. Lead with the buyer’s struggle, then the proof — in their language
The business buyer is **solution-unaware**: lead with the struggling moment (the big platforms
can’t do their one task), *reveal* that an owned model can, then prove it. The durable,
hard-to-copy differentiators are **independence, technique-neutrality, and the honest go/no-go**
(“we’ll tell you to keep your API”) — promote these to the spine; no platform or SI can copy
them without breaking their own business model. “A small owned model beats the API tier you'd actually deploy, and you
own it” is now table-stakes among practitioners — keep *match/beat* and *you own it* as
**support, not the headline**. The public benchmark’s job is **reason-to-believe a new
possibility** for the buyer (and credibility for any gatekeeper), translated into their terms —
not a cold demand hook.

### 2. Lead with all the wedges, not just cost-vs-API
Frontier fails for **compliance, cost, or quality** — and some buyers have no AI yet (greenfield).
For compliance/greenfield there's no API to "replace"; the value is "do this at all, trustworthy
and owned," and TCO is secondary. Foreground all the reasons; give the benchmark a
compliance/ownership angle, not only the cost calculator.

### 3. Offer ladder = money model = staged progression
Scan + Pilot are the funnel and the leveraged entry. Sequence so nothing's over-built before
demand is proven:
- **Stage 1 — convert attention (pre-broadcast), solo:** reposition the site to the ICP; Scan as
  the wedge + email capture on; Pilot as the paid entry.
- **Stage 2 — leverage (after demand):** productize the Pilot into a repeatable fixed-price
  product; compound a cross-engagement pattern library (the IP moat).
- **Stage 3 — recurring + funded production:** staff playbooks (juniors + expert sign-off);
  sponsored/commissioned independent benchmarks; subscription/coverage; pivots (sell the sign-off
  to semi-capable buyers; sell artefact kits to build-capable buyers).

### 4. Channel / hook (resolve before broadcasting)
A reproducible "open model beats the hosted API tier, here are the hashes" post draws ML engineers — who
fail the buy-not-build filter. Translate the benchmark into the business buyer's terms and target
vertical/industry channels (compliance, ops, product leaders), with the benchmark as the proof
link, not the hook. Lead with the ICP's problem (can't / too costly / too wrong / can't tell if it
worked).

### 5. Guardrails
- **Scan economics:** cheap (not free), ICP-gated, productized — don't let it become unpaid labor.
- **Independence:** the benchmark's credibility is the whole asset. Before any sponsorship, publish
  the policy — sponsor funds the work, never the conclusion; results published regardless; code +
  methodology public.
- **Don't over-claim:** "open wins on these tasks" ≠ "open always wins." The Pilot ("we test it on
  *your* data and tell you honestly if it doesn't") is the defensible framing. The benchmark beats
  the **cost-efficient API tier teams actually deploy** (e.g. GPT-5.4 Mini), not the flagship — say
  "the API tier you'd deploy," never "the frontier."
- **Don't over-build:** earlier stages before later ones; wait for the demand signal.

## Technical rigour (the credibility floor)
The proof is the brand; it must survive a skeptical practitioner.
- Every public-benchmark number is reproducible from open code + weights; nothing cherry-picked.
- Internal figures come from `data/benchmark/results.json` — authoritative; never web-corrected.
- State scope honestly (task count, test sizes, what does/doesn't generalize); name caveats before
  a critic does.
- Don't frame as novel or special what isn't; don't drift stale vs. current practice.
- `methodology.html` is for a technical audience — keep it rigorous, not dumbed down for the ICP.
