# Copy style: the voice, banned patterns, and placement rules

This file governs every word a visitor can read: page copy, titles, meta/OG descriptions,
JSON-LD, button labels, form microcopy, and copy strings inside inline `<script>` blocks
(the fit-check result copy, the head-to-head task blurbs). It exists because marketing-speak
and AI-generated-sounding prose ("slop") measurably damage credibility with the buyers this
site targets, and because these patterns creep back in one plausible-sounding line at a
time. Business-model substance comes from `MVB.md`; if a drafted line breaks a rule here,
rewrite the wording, never the decision. The privacy page is exempt as legal text.

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
  input (a quiz step label) or a FAQ the reader would ask.
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
Names come from the `MVB.md` revenue streams or a plain verb of the work (Build, Operate;
sprint, retainer); the name alone must tell the buyer what happens.

Test: does the name say what we do, or how to feel about us? Rename the latter.

Names also import the market's frame. "Pilot" arrives carrying enterprise-AI pilot
failure; "benchmark" arrives carrying vendor leaderboards nobody trusts; "score" arrives
carrying grading. Test a name by what a stranger already believes the word means this
year, not by the dictionary; when the market has soured a word, rename ours (Pilot became
the Build's opening head-to-head, Benchmark became the head-to-head, Score your task
became Scope your task).

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
  quiz questions, customers, verticals.
- Name the category, never the census.
- No "so far", "for now", "currently": either it is true durably or it does not go in.
- Volatile facts live in data (`results.json`-driven UI, placeholder tabs with a status
  field) or in a single hardcoded snapshot with a provenance comment (the homepage proof
  strip). Never scattered through prose.
- Enforced: the linter fails on count-plus-inventory-noun patterns and time anchors.

## End states (never a single final state)

Copy never collapses the engagement into one ending. Wherever the after-the-build state is
described, both paths appear first-class: handover (the buyer's team runs the artifact on
their infrastructure) and managed (we operate it and keep the test current). Constant
across both, statable as fact: the buyer keeps the weights, and their data stays in their
environment. The recipe and the evals stay with us (the `MVB.md` portability clause), so
copy never promises the buyer keeps or runs the test itself, only that the test exists, is
re-run for them, and its scored results are theirs.

## Placement: measure-first is a sequence fact, not a message

Measure-first appears in the how-it-works section (its heading included) and in FAQ answers
to direct questions, nowhere else; the proof strip and the benchmark pages are the numbers'
home, and other surfaces point to them. Heroes, identity headlines, CTA banners, sticky
bars, and H2s outside the how-it-works section carry the automated outcome or the action
("Scope your task"), never a measurement promise ("we measure first", "see if it wins",
"tested on your data"). Re-promising measurement per section is the named creep pattern: it
re-productizes measurement one plausible line at a time. The head-to-head is always
described as the Build's opening phase, never as a freestanding step before the engagement;
copy that reads as a free pre-check (measure, then approve price) re-creates the removed
Pilot.

## Qualification never happens in page copy

No best-fit/weaker-fit lists, readiness or investment criteria, or stage-gating CTA
qualifiers ("Already know it fits?"). Sections describe the buyer's situation so they
recognize themselves (recognition before solution); the quiz routing and the call do the
qualifying. CTA lines carry the action plus at most a channel-preference alternative
("Prefer to talk?"); reassurance microcopy (free, time estimates, email-optional) lives on
the tool's own page, never on buttons pointing to it. The fit check returns a next step
plus what the answers change about a Build, never a grade of the visitor.

## Fix the generator, not the sentence

When a page keeps drifting back to a banned pattern through repeated rewrites, the words
are not the problem; the thing they describe is. A paid-measurement product forces
measurement-as-product copy; a grading quiz forces grades; results hidden behind a
disclosure force trust-me copy; a soured name forces defensive framing. Rewriting the
sentence treats the symptom for one revision; the durable fix is structural: change the
offer, the output, the layout, or the name, and the copy problem stops regenerating.
Precedents: the standalone Pilot (removed; the head-to-head became the Build's opening
phase), quiz verdicts (became next steps plus Build drivers), the collapsed results panel
(opened as page sections), "Benchmark" and "Score your task" (renamed).

## Page and audience rules

- Primary CTA is "Scope your task" → `/scope`; secondary is book a call
  (cal.com/baseweight/intro).
- Recognition before solution: lead with the buyer's problem in their words; they must feel
  understood before being sold to (the buyer read lives in `MVB.md`).
- Two registers, one story: buyer surfaces (`index`, `scope`, `about`, the plain band
  atop `head-to-head`) lead with outcomes and a mirror of the buyer; rigorous detail stays on
  `head-to-head`/`methodology` for the technical reader. On buyer pages say "the big AI
  platforms" / "a rented AI"; avoid practitioner jargon as lead terms (frontier, 8B, LoRA,
  open weights, fine-tuned). Buyer pages say "post-train"; the head-to-head and methodology
  pages use "fine-tuned"/"LoRA"; that register split is deliberate.
- Ownership is NOT a messaging angle. It appears only as deliverable fact ("weights handed
  over, no per-call fees, runs in your walls"), never as headline, value card, or identity
  pitch. Keep the fit check's posted field names/values (`q7_own`, own/rent/notmine,
  blocker value `ownership`); only visible wording changed.
- Never imply Baseweight builds models from scratch: the model work is adapting/tuning an
  existing open-source model to one workflow; use "tune" / "adapt" / "specialize" /
  "post-train" for the model, never "build". Applies to outreach copy too.
- The head-to-head is reason-to-believe plus credibility, never a demand hook; translate it
  into the buyer's terms, never lead cold with "here are the hashes".
- Never "answer" / "right answer" / "correct answer" in buyer-facing copy (it shrinks the
  perceived task space): say result, outcome, a clear rule, tell right from wrong.
  Buyer-facing results are "mistakes avoided", wired to `results.json`; F1/points stay on
  the technical pages. "eval" → "the re-runnable test" on buyer pages.
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
