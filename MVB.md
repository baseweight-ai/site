# Minimal Viable Business

> The MVB canvas is the sole source for the business model: segments, problem, solution,
> revenue, pricing, moats, channels, GTM. Its wording is the authoritative statement of the
> model (write from it), but nothing in it is a settled headline, tagline, or product name;
> published wording follows `COPY-STYLE.md`.

## Customer Segments

### Ideal

1. has a single workflow that is:
   1. high volume
   2. unstructured-language task where rules and traditional ML underperform
   3. narrow enough that a fine-tuned small open model matches or beats frontier
2. is regulated (cannot send to a third party)

### Entry Target

- Requires workflow fit (1); regulated (2) optional until trust is built.
- Three lanes by rising moat, falling access: Lane 1 funds, Lane 2 is the first wedge, Lane 3
  the durable end-state. Delivery differs by lane: Lane 1 ships as services (labor margin);
  the single-tenant product and its inference economics only switch on at Lane 2–3 volume.

**Lane 1: no moat, fastest access (cash on-ramp).** Commodity services, frontier-doable but
equal quality with open source (allowing lower cost or more customization).

- Online marketplaces (~ Insurance: risk classification)
  - Buyer: trust and safety teams
  - Workflow: content moderation classification
- Finance & operations (~ Fintech: financial documents)
  - Buyer: finance ops and logistics ops
  - Workflow: accounts-payable and logistics document extraction
- Proptech (~ Legal: lease/contract abstraction)
  - Buyer: brokerages and property managers
  - Workflow: listing generation and lease abstraction
- SaaS & e-commerce
  - Buyer: support and CX leaders
  - Workflow: ticket triage and reply drafting, voice-of-customer tagging and summarization
- Sales & marketing orgs
  - Buyer: RevOps and marketing ops
  - Workflow: call-note summarization and CRM field extraction, inbound lead qualification
    and routing
- Staffing & HR
  - Buyer: talent-acquisition teams and staffing agencies
  - Workflow: resume screening and candidate/JD matching
- Enterprise IT
  - Buyer: IT service-management teams
  - Workflow: helpdesk ticket deflection and knowledge-base answers
- Retail
  - Buyer: e-commerce merchandising teams
  - Workflow: product catalog normalization and description generation

**Lane 2: data-flywheel moat (unregulated, medium access).** Proprietary normalization data
compounds, unavailable via public API.

- Auto-parts aftermarket (~ Insurance: auto claims, fitment)
  - Buyer: parts distributors and retailers, catalog teams
  - Workflow: vehicle fitment resolution and normalization
- Customs / freight forwarding (~ Fintech: trade finance, compliance)
  - Buyer: customs brokers, freight forwarders, trade-compliance teams
  - Workflow: HS/HTS classification, trade-document extraction
- Metals service centers (~ Life sciences: certification/traceability)
  - Buyer: service centers, catalog and ops teams (esp. post-acquisition)
  - Workflow: mill-test-report extraction, catalog reconciliation
- Electronic-component distribution
  - Buyer: distributors, catalog and data-ops teams
  - Workflow: datasheet spec extraction, part cross-referencing
- Electrical distribution
  - Buyer: distributors, PIM and e-commerce teams
  - Workflow: multi-supplier catalog normalization, un-syndicated tail enrichment
- MRO / industrial distribution
  - Buyer: distributors, inside-sales and quoting teams
  - Workflow: RFQ parsing to quote lines, part substitution matching

**Lane 3: egress/compliance moat (regulated).** Sell to digital-native sub-segments, not
incumbents, keeping the moat while cutting procurement to weeks.

- Insurance
  - Buyer: MGAs, insurtechs, TPAs, E&S/specialty carriers
  - Workflow: claims triage, FNOL intake summarization, subrogation-document review,
    medical-record summarization
- Fintech
  - Buyer: neobanks, lenders, crypto exchanges, payment startups
  - Workflow: KYC/AML document processing, adverse-media screening triage,
    chargeback/dispute narrative review, loan-application extraction
- Healthcare
  - Buyer: telehealth, digital-health startups, revenue-cycle-management and medical-billing
    vendors, DSOs
  - Workflow: clinical-note summarization, medical coding assistance, patient-message triage
- Legal
  - Buyer: boutique and mid-size firms, ALSPs, corporate legal-ops, litigation-support vendors
  - Workflow: contract clause extraction and review, discovery responsive/privilege
    classification, lease and NDA abstraction
- Life sciences
  - Buyer: CROs and biotechs
  - Workflow: pharmacovigilance case intake triage, protocol and regulatory-document
    summarization

## Problem

- Enterprises want open models' benefits (cost, customization, data control, sovereignty)
  but are blocked by the burden of ownership (infra, talent, security, liability)

### Existing Alternatives

- Make (DIY open models): managed inference or self-host, includes integration, data, eval,
  guardrails, ops. Platforms like Arcee, Snorkel, Predibase ease it.
- Outsource (SI/consultancy): offloads the build, but bespoke and non-compounding, and you
  inherit maintenance.
- Net: both leave the customer shouldering the ownership burden.

## Solution

- Own one workflow, on an SLA
- Build and operate the whole vertical stack (ingestion, post-training, RAG, guardrails,
  security, human-review, audit log)
- Model: fine-tuned, quantized, small, agnostic, on Apache/MIT weights (Qwen, Mistral,
  Granite, gpt-oss)
- Infra: single-tenant in-VPC/on-prem with batched inference
- Portable: only the recipe and evals stay with us

## Revenue Streams

- Product:
  - Pricing: outcome-based (per resolved unit)
  - Guarantee: SLA on accuracy/turnaround (credits on miss)
- Services:
  - Sprint: fixed-scope 4–8 weeks (deployed, evaluated, guardrailed workflow + runbook)
  - Retainer: monthly ops (fractional AI team)

## Unfair Advantage

1. Compounding flywheel: per-vertical fine-tunes, evals, templates, know-how, unreachable
   via public API
2. Reference moat: logos and audit record shorten procurement, block entrants
3. Incumbent trap: API vendors can't serve egress-forbidden buyers without breaking their
   model
4. Background gives credibility, relationships give insider access: a weak starter while
   real moats build

## Unique Value Proposition (UVP)

Automate a critical workflow with custom AI, behind your own walls. No AI team to hire, no
software to buy. You pay for results.

## Cost Structure

- Fixed: lean post-training and delivery team, compliance and certifications (SOC2, HIPAA
  per vertical), base tooling
- Variable: fine-tuning and inference compute (low: small, quantized, batched),
  human-in-the-loop review, onboarding-sprint labor
- Acquisition: founder-led sales, design-partner and reference cultivation
- Economics: outcome pricing on low inference cost (target 75-85% gross margin); services
  fund early opex

## Channels

- Warm intros through background and vertical relationships (early)
- Founder-led outbound to digital-native sub-segments (MGAs, neobanks, telehealth, ALSPs)
- Design partners become reference logos that drive in-vertical referrals
- Vertical communities, industry bodies, and conferences
- Land via services sprint, expand to product; productize repeating patterns into the
  vertical-software play
