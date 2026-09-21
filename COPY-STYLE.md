# Copy style: the voice, banned patterns, and placement rules

This file governs every word a visitor can read: page copy, titles, meta/OG descriptions,
JSON-LD, button labels, form microcopy, and copy strings inside inline `<script>` blocks
(the head-to-head task blurbs). It exists because marketing-speak
and AI-generated-sounding prose ("slop") measurably damage credibility with the buyers this
site targets, and because these patterns creep back in one plausible-sounding line at a
time. Offer substance comes from the homepage (`index.html`); if a drafted line breaks a
rule here, rewrite the wording, never the decision. The privacy page is exempt as legal text.

**Enforcement is automated.** `e2e/copy-lint.spec.ts` scans the visible text, meta content,
and inline JS string literals of every marketing page for the patterns below and fails the
suite on any hit; `e2e/copy-budget.spec.ts` holds every page to a word budget. If you add
copy that trips the linter, rewrite the copy; only extend the allowlist for a genuine
term-of-art (and say why in the allowlist entry). If you find a new slop pattern, add it to
the linter and this file in the same change.

## The voice

Write like an engineer documenting a product they trust: every sentence survives "says
who?" with a number, a mechanism, or a checkable fact.

- State what is true. A number beats an adjective; a mechanism beats a promise.
- One idea per sentence. Plain verbs: is, costs, runs, measures, returns.
- The reader's constraint, task, and money are the subject; we appear only as the party
  doing the measurable work.
- If a sentence would fit on any vendor's site, it says nothing. Delete or sharpen it.
- Lists carry load-bearing items only; cut a third item that exists for rhythm.

## Parsimony

Apply the principle of parsimony: use extreme minimal words for maximal effectiveness.
Avoid constant asides, hedging, unnecessary repetition, overexplaining, and unnecessary
(or even harmful) details. In practice:

- Every clause pays rent. An aside that qualifies a claim ("when cost is the point", "now
  or soon") usually means the claim needed no qualifier or the sentence needed no claim.
- Say a thing once, in its one home (see Placement); the second statement of anything is
  the first candidate for a cut.
- Explain mechanics only where the reader acts on them; narrating how a page or tool works
  ("the result shows on screen, email optional") is overexplaining.
- Some detail is harmful, not just heavy: a number, term, or edge case that invites a
  question the page can't answer belongs on the call or in the SOW, not in copy.
- The word budgets (below) are the enforcement floor; the standard is stricter than the
  budget.

## The root failure behind most banned patterns

Selling our stance instead of the buyer's outcome. Judgment tokens, posture-nouns, exit
mechanics, visitor grading, measurement re-promises, honesty theater, and asserted trust
words are one disease: the copy turns toward us (our pronouncement, our posture, our terms,
our process, our virtue) and away from the automated task the buyer is buying. Check which
way a line faces before writing it; when a banned pattern fires, the fix that lasts is
re-facing the sentence toward the buyer's outcome, never synonym-swapping the banned word.

## Banned: contrast and negation rhetoric ("this, not that")

The single most important rule. Never define the offer, or us, by what it is not. Negative
framing plants the doubt it denies and reads as posturing.

| Banned | Fix |
|---|---|
| "X, not Y" slogans | State X with its evidence. |
| "It's not just X, it's Y" / "isn't just" / "more than just" | Say Y plainly. |
| "not because X, but because Y" | Say "because Y". |
| "X over Y" value slogans | Describe the behavior. |
| Anti-positioning ("unlike other shops", "every AI shop...") | Describe our mechanism; never mention the category's sins. |
| Negative promises ("no spam", "no pitch", "no lock-in", "no strings") | State the positive equivalent: "One reply, written by me." "You keep the weights." |
| Chiasmus / snap reversals | Two plain sentences, or one. |
| Negation triads | List what the buyer can do. |

Allowed, because they are information rather than rhetoric: result names ("not yet"),
factual constraint statements in the buyer's own voice ("We can't send our data to an
outside API").

## Banned: self-praise buzzwords

seamless, effortless, frictionless, robust, cutting-edge, state-of-the-art, world-class,
best-in-class, next-level, game-changing, revolutionary, transformative, holistic, turnkey,
synergy, leverage (as a verb), unlock, unleash, supercharge, elevate, empower, delightful,
magical, "AI-powered" as a selling point. Fix: the concrete property with its number.

## Banned: AI-slop tells

- Em dashes. Use commas, colons, periods, or parentheses. En dashes for ranges are fine.
- Rule-of-three flourishes (three distinct-information items are fine).
- Aphorism openers and reveals: "Here's the thing", "Let's be honest", "That doesn't
  mean...", "Say goodbye to", "That's where X comes in".
- Vocabulary tells: delve, tapestry, testament, pivotal, meticulous, vibrant, boasts,
  fostering, showcasing, underscores, "in today's fast-paced world".
- "-ing" analysis tails bolted onto sentences.
- Elegant variation: repeat the plain term.
- Rhetorical-question headers. Questions are allowed only where the question is the literal
  input (a form field label) or a question the reader would actually ask.
- Staccato fragment chains as headlines.

## Banned: persona flexes

- Honesty theater: "honestly", "we'll tell you straight", "plainly", "no-nonsense".
- False intimacy: "my personal read", "comes straight to me".
- Competitor digs.
- Meta-narration of our own virtues or process.

Show the incentive instead: the paid work happens whether the model wins or loses. The
honest-no surfaces once, as the factual answer to a visitor's question, never as a virtue
statement or a selling point.

## Banned: judgment tokens sold as the deliverable

verdict, go/no-go, ruling, readout, findings, "a clear yes or no". These name our
pronouncement about the work, and a pronouncement carries no number, mechanism, or checkable
fact; selling one turns the measurement back into the product, when measurement de-risks the
build and the automated task is the product. Name what the buyer can run, re-run, or spend
against: the numbers, the margin, the re-runnable test, the model, the running cost.

Test: reduce the sentence to the noun being sold; if the buyer can't run it, re-run it, or
spend against it, rewrite.

## Banned: posture-nouns as names

An offer, step, or deliverable is never named for the feeling it should produce or the
stance we take: assurance, confidence, trust, care, excellence, peace of mind, and kin.
Names come from a plain verb of the work plus its shape (Eval Harness Sprint, Eval
Retainer, Post-Training); the name alone must tell the buyer what happens.

Test: does the name say what we do, or how to feel about us? Rename the latter.

Names also import the market's frame. "Pilot" arrives carrying enterprise-AI pilot
failure; "benchmark" arrives carrying vendor leaderboards nobody trusts; "score" arrives
carrying grading. Test a name by what a stranger already believes the word means this
year, not by the dictionary; when the market has soured a word, rename ours (Benchmark
became the head-to-head; the standalone Pilot was removed rather than renamed).

Coined process nouns also stay home. A name like "the head-to-head" earns its meaning
where the surface defines it (the offer table, the asset's own page); exported into
running prose or compounded ("head-to-head test") it becomes branded jargon carrying
emphasis it never earned, and the reader hears the company talking to itself. On any
surface that has not defined the term, describe the mechanism with plain verbs ("we
measure it against whatever does the task today"). The same goes for doctrine vocabulary
("re-runnable"): plain words in prose; coined terms only where introduced.

## Banned: exit mechanics as reassurance

Stop clauses, refunds, make-goods, phase pricing, or cancel terms spelled out in page copy.
They plant the failure branch before the buyer wants the outcome (the same mechanism that
bans negative promises like "no lock-in"), they are contract terms doing a marketing job,
and a named stoppable unit ("the measured phase") re-centers measurement as the product.
De-risking appears as the positive sequence fact (the Build opens with the head-to-head);
the terms live in the SOW and the sales call; at most one FAQ answer, replying to the
buyer's own question, states that a losing result ends the engagement with the artifacts
theirs. End-state choice is exempt: handover or managed, and take-it-in-house-anytime, are
the offer, never an exit.

Test: does the sentence say what happens when it works, or how to leave when it fails? Cut
the second unless the visitor asked.

## Banned: trust words asserted instead of earned

The proof lexeme (proof, prove, proven, proving) and "guarantee" are banned in all visitor
copy including titles, meta/OG, and JSON-LD; "evidence" and trust-words are capped at once
per page (linted). Say the artifact instead (the re-runnable test, the numbers, the error
rates, the hashes, the model) or the honest verb (measure, test, score, show).

## Banned: drama idioms and vague scale

"earns its keep", "make or break", "brutal at scale", "cheap insurance", "a fraction of the
cost", "dramatically", "real money", "actually" as an intensifier. Fix: the number ("28 to
138 times cheaper per correct result"), the plain comparative, or delete.

## Headlines (H1/H2, titles, OG titles)

H1: one idea, a single sentence, at most 12 words, subject first. H2: at most 14 words.
Sentence case, never Title Case. Plain words the buyer already uses; the headline must make
sense with everything around it stripped away. The H1 states the offer or the finding; the
sub carries mechanism and qualifiers. Enforced by the linter. Grounding: NN/g heading
guidelines (concise + scannable + objective measured a 124% usability gain), the
five-second test, and A/B evidence that clear beats clever (330% to 847% in published
tests).

## Future-proof copy (no volatile anchors)

- Never state counts of things that change as the business runs: benchmark tasks, models,
  offers, customers, verticals.
- Name the category, never the census.
- No "so far", "for now", "currently": either it is true durably or it does not go in.
- Volatile facts live in data (`results.json`-driven UI, placeholder tabs with a status
  field) or in a single hardcoded snapshot with a provenance comment (the homepage proof
  strip). Never scattered through prose.
- Enforced: the linter fails on count-plus-inventory-noun patterns and time anchors.

## End states (never a single final state)

Copy never collapses the engagement into one ending. Wherever the after-the-build state is
described, both paths appear first-class: handover (the buyer's team runs the artifact on
their infrastructure) and managed (we operate it and keep the suite current). Constant
across both, statable as fact: the buyer keeps the weights and the eval harness, and their
data stays in their environment.

## Placement: measurement is sold as an offer, described once

Measurement is a priced offer (the Eval Harness Sprint and the Eval Retainer), so it is
named in the offer carousel and in the "what we do" list, and nowhere else. `/benchmark` is
the numbers' home; other surfaces point to it. `/about` is the one page that argues the
thesis ("Why we measure first"), because a reason given once in its own place is not the
re-promise this rule is about. Heroes,
CTA banners, sticky bars, and H2s outside those places carry the work or the action ("Book a
call"), never a measurement promise repeated as a differentiator ("we measure first", "see
if it wins", "tested on your data"). Re-promising measurement per section is the named creep
pattern: it turns a line item into a posture one plausible sentence at a time. Never offer
free measurement as a pre-check before the paid work; that re-creates the removed Pilot.

## Qualification never happens in page copy

No best-fit/weaker-fit lists, readiness or investment criteria, or stage-gating CTA
qualifiers ("Already know it fits?"). The "who I work with" cards describe the buyer's
situation so they recognize themselves (recognition before solution); the call does the
qualifying. CTA lines carry the action and nothing else. Reassurance microcopy (free, time
estimates, email-optional) never rides on buttons or cards. Convenience claims ("about two
minutes") are falsifiable promises: state one only if it reliably holds.

## Retired vocabulary

"Forward-deployed" was dropped from every surface on 2026-09-20 and does not come back.
The linter holds it, because retired names survive longest in meta and OG content where a
page-level assertion cannot see them. Retire a name here and in `BANNED` together.

## Headline length

H1 is one sentence of at most 12 words, H2 at most 14. A heading over the limit gets
rewritten; the limit is not raised and there is no exemption list.

## Fix the generator, not the sentence

When a page keeps drifting back to a banned pattern through repeated rewrites, the words
are not the problem; the thing they describe is. A free measurement gate on paid work
forces measurement-as-product copy; a grading quiz forces grades; results hidden behind a
disclosure force trust-me copy; a soured name forces defensive framing. Rewriting the
sentence treats the symptom for one revision; the durable fix is structural: change the
offer, the output, the layout, or the name, and the copy problem stops regenerating.
Precedents: the standalone Pilot (removed), the fit-check quiz (removed; grading copy
regenerated for as long as a grading quiz existed), the collapsed results panel (opened as
page sections), "Benchmark" (renamed). Measurement sold as a fixed-price deliverable with a
named artifact (the harness) does not regenerate measurement-as-posture copy; measurement
sold as a free gate on other work does.

## Page and audience rules

- The only CTA is "Book a call" → cal.com/baseweight/intro, on every page and in every
  offer card. No form, no lead magnet, no secondary action.
- Recognition before solution: lead with the buyer's problem in their words; they must feel
  understood before being sold to.
- Two registers, one story: buyer surfaces (`index`, `about`, the plain band
  atop `head-to-head`) lead with outcomes and a mirror of the buyer; rigorous detail stays on
  `head-to-head`/`methodology` for the technical reader. On buyer pages say "the big AI
  platforms" / "a rented AI"; avoid practitioner jargon as lead terms (frontier, 8B, LoRA,
  open weights, fine-tuned). Buyer pages say "post-train"; the head-to-head and methodology
  pages use "fine-tuned"/"LoRA"; that register split is deliberate.
- Ownership is NOT a messaging angle. It appears only as deliverable fact ("the weights are
  yours", "runs on your servers"), never as headline, value card, or identity pitch.
- Never imply Baseweight builds models from scratch: the model work is adapting/tuning an
  existing open-source model to one workflow; use "tune" / "adapt" / "specialize" /
  "post-train" for the model, never "build". Applies to outreach copy too.
- The head-to-head is reason-to-believe plus credibility, never a demand hook; translate it
  into the buyer's terms, never lead cold with "here are the hashes".
- Never "answer" / "right answer" / "correct answer" in buyer-facing copy (it shrinks the
  perceived task space): say result, outcome, a clear rule, tell right from wrong.
  Buyer-facing results are "mistakes avoided", wired to `results.json`; F1/points stay on
  the technical pages. "Eval" is offer vocabulary (Eval Harness Sprint, Eval Retainer) and
  reads plainly to the engineering buyers the page now addresses; keep it for the named
  offers and for what they produce, not as a synonym for the head-to-head.
- A question's label must BE the question, with no separate explainer; name the object and
  the scope in the label itself.
- No social proof until real; never invent clients, logos, or testimonials. Use a clearly
  labelled illustrative example plus a design-partner offer. Founder credentials are
  practitioner proof, not resume.
- Public copy talks to the visitor's task and never narrates the playbook: no internal
  strategy, GTM, or voice-meta language; no meta-promises about how we operate; state a
  differentiator once where it earns the spot, never re-promise it per section.
- Aesthetic register: Vercel/Linear, never Salesforce. No floating orbs, gradient-mesh
  backgrounds, or stock imagery.

## Copy budgets (anti-bloat)

Every page has a visible-word budget, enforced by `e2e/copy-budget.spec.ts`. The budgets
are the recorded size of each page's copy plus small headroom; a change that pushes a page
over its budget fails the suite. The correct response is to cut something: a new sentence
must displace a weaker one, a new section must do a named job no existing section does.
Raise a budget only for a deliberate scope decision, in the same change, with a one-line
justification in the budget file. Copy that grows section by section is the bloat this rule
exists to prevent; the one-home principle above (each message has exactly one canonical
home per page) is the editorial half of the same rule.
