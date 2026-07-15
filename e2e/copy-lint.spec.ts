/**
 * Copy lint: enforces COPY-STYLE.md over everything a visitor can read.
 *
 * Scans two surfaces per page, statically (no browser):
 *   1. Visible text: the HTML with comments, <script>, and <style> removed.
 *      This covers headings, body copy, titles, and meta/OG/JSON-LD content.
 *   2. Inline JS string literals: copy rendered from scripts (fit-check
 *      result copy, benchmark task blurbs, tooltips). Comments and code are
 *      not scanned, only the quoted strings.
 *
 * A hit fails the suite. The correct response is to rewrite the copy; extend
 * ALLOWLIST only for a genuine term-of-art, with a reason. New slop patterns
 * go into BANNED *and* COPY-STYLE.md in the same change.
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { SITE_ROOT, sitePages, stripBlocks, stringLiterals } from "./copy-text";

// The page list is derived from disk (copy-text.ts) so a new page is linted on
// arrival. privacy.html is excluded here only: legal text legitimately needs
// negations ("we do not sell your data").
const LINT_EXEMPT = new Set(["privacy.html"]);
const PAGES = sitePages().filter((p) => !LINT_EXEMPT.has(p));

// Copy injected at runtime is copy too: components.js carries the nav labels
// and footer strings every page renders.
const SCRIPT_FILES = ["components.js"];

const BANNED: { name: string; re: RegExp }[] = [
  // ── Contrast / negation rhetoric ("this, not that") ────────────────────────
  // "not yet" is a verdict name; "not sure" is a quiz option; both are exempt.
  { name: "comma-not contrast (X, not Y)", re: /,\s+not\s+(?!yet\b|sure\b)/i },
  { name: "negation parallelism", re: /\b(isn'?t just|not just|more than just|it'?s not about|not because)\b/i },
  { name: "self-definition by absence", re: /\b(we don'?t|we won'?t|we'?re not|we never)\b/i },
  { name: "anti-positioning dig", re: /\b(unlike (other|most)|not another|every ai (shop|vendor|consultancy)|nobody (else|who))\b/i },
  { name: "negative promise", re: /\bno (spam|pitch|fluff|bs|strings|jargon|sales pitch|lock-?in|email|commitment|obligation|ml (team|hires?))\b/i },
  { name: "possessive flourish", re: /\byours to (keep|own)\b/i },
  // ── Self-praise buzzwords ──────────────────────────────────────────────────
  { name: "buzzword", re: /\b(seamless|effortless|frictionless|robust|cutting[- ]edge|state[- ]of[- ]the[- ]art|world[- ]class|best[- ]in[- ]class|next[- ]level|game[- ]?chang\w*|revolutioni[sz]\w*|transformative|holistic|turnkey|synerg\w*|supercharge\w*|unleash\w*|empower\w*|delightful|magical)\b/i },
  { name: "buzz-verb", re: /\b(unlock|elevate|leverage)\b/i },
  // ── AI-slop tells ──────────────────────────────────────────────────────────
  { name: "em dash", re: /—|&mdash;/ },
  { name: "AI vocabulary", re: /\b(delve|tapestry|testament|meticulous\w*|boasts?|vibrant|pivotal|fostering|showcas\w*|underscor\w*|in today'?s|fast-paced)\b/i },
  { name: "aphorism scaffold", re: /\b(here'?s the thing|let'?s be honest|the best part|say goodbye|say hello|look no further|that doesn'?t mean|sound familiar|that'?s where \w+ comes in|welcome to the)\b/i },
  // ── Persona flexes ─────────────────────────────────────────────────────────
  { name: "honesty theater", re: /\b(honest\w*|plainly|straight answer|straight talk|tell (you|it) straight|no-nonsense|real talk)\b/i },
  // ── Trust words are earned, not asserted (COPY-STYLE.md "Trust words") ─────
  // Repeated trust vocabulary reads as insistence, and a sample-scale benchmark
  // measures rather than proves. Show the artifact instead: the re-runnable
  // test, the numbers, the hashes, the model.
  { name: "trust word: proof lexeme", re: /\b(proofs?|prove[sdn]?|proving)\b/i },
  { name: "trust word: guarantee", re: /\bguarantee\w*\b/i },
  // ── Judgment tokens sold as the deliverable (COPY-STYLE.md) ─────────────────
  // Our pronouncement is never the product; name what the buyer can run,
  // re-run, or spend against. ("rulings" as in customs rulings stays legal.)
  { name: "judgment token", re: /\b(verdicts?|go\/no-?go|ruling)\b/i },
  // ── Removed offers and posture-noun names (COPY-STYLE.md) ───────────────────
  // Scan, the standalone Pilot, and Assurance are dead offers/names; offers are
  // Build and Operate, named for the work.
  { name: "removed offer name", re: /\b(pilots?|scans?|assurance)\b/i },
  // ── Exit mechanics as reassurance (COPY-STYLE.md) ───────────────────────────
  // Contract terms live in the SOW and on the call, never in page copy.
  { name: "exit mechanics", re: /\b(stop clause|refunds?|make-?goods?|money[- ]back|cancel (at )?any ?time|measured phase)\b/i },
  // ── Visitor grading / qualification (COPY-STYLE.md) ─────────────────────────
  // Results are next steps, never grades; qualification happens in the quiz
  // routing and on the call, never in page copy.
  { name: "visitor grading", re: /\b(you'?re a candidate|best fit|weaker fit|good fit|already know it fits|score (your|my) task)\b/i },
  // ── Task-output vocabulary ──────────────────────────────────────────────────
  // "answer" shrinks the perceived task space; say result or outcome.
  { name: "answer vocabulary", re: /\b(right|correct) answers?\b/i },
  { name: "false intimacy", re: /\b(personal read|my read|my real read|straight to me)\b/i },
  { name: "virtue narration", re: /\bwe'?d rather\b/i },
  // ── Drama idioms and vague scale ───────────────────────────────────────────
  { name: "drama idiom", re: /\b(earns? its keep|make[- ]or[- ]break|brutal|cheap insurance|quietly underperform\w*|real money|real numbers)\b/i },
  { name: "vague scale", re: /\b(a fraction of the|dramatically)\b/i },
  { name: "filler intensifier", re: /\bactually\b/i },
  // ── Volatile anchors (future-proof copy) ───────────────────────────────────
  // Counting inventory that grows as the business runs dates the page. Name the
  // category, never the census. "one" is exempt (the one-task positioning).
  // Digits before "models/examples/questions" are technical parameters (training
  // and eval set sizes in method text), so the digit branch covers fewer nouns.
  { name: "volatile count anchor", re: /\b(?:(?:two|three|four|five|six|seven|eight|nine|ten|both|couple of)\s+(?:public\s+|live\s+|more\s+|new\s+|open\s+|benchmark(?:ed)?\s+)*(?:tasks?|benchmarks?|questions?|models?|examples?|verticals?)|\d+\s+(?:public\s+|live\s+|more\s+|new\s+|open\s+)*(?:tasks?|benchmarks?|verticals?))\b/i },
  { name: "volatile time anchor", re: /\b(so far|for now|at the moment|right now|currently|as of (?:today|writing|now))\b/i },
];

// ── Headline rules (COPY-STYLE.md "Headlines") ───────────────────────────────
// H1: one idea, a single sentence, at most 12 words. H2: at most 14 words.
const H1_MAX_WORDS = 12;
const H2_MAX_WORDS = 14;

function headingText(inner: string): string {
  return inner
    .replace(/<[^>]+>/g, " ")
    .replace(/&rsquo;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

function headlineViolations(html: string): string[] {
  const hits: string[] = [];
  for (const [tag, max] of [["h1", H1_MAX_WORDS], ["h2", H2_MAX_WORDS]] as const) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const text = headingText(m[1]);
      if (!text) continue; // JS-filled headings (e.g. #fsTitle) are empty statically
      const words = text.split(/\s+/).length;
      if (words > max) hits.push(`[headline too long] <${tag}> has ${words} words (max ${max}): "${text}"`);
      if (tag === "h1" && (text.match(/[.!?]/g) || []).length > 1)
        hits.push(`[multi-sentence h1] "${text}"`);
    }
  }
  return hits;
}

// Exact substrings that are permitted despite matching a pattern. Keep rare;
// every entry needs a reason.
const ALLOWLIST: { page: string; snippet: string; reason: string }[] = [
  // (empty: add entries only for genuine terms-of-art, with the justification
  //  here; protocol strings belong out of copy vocabulary, not on this list)
];

// Precompiled once: findViolations runs every pattern over every scanned text.
const BANNED_G = BANNED.map(({ name, re }) => ({
  name,
  re: new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"),
}));

// Frequency caps: words that are fine once but read as a tic when repeated.
const FREQUENCY_CAPS: { name: string; re: RegExp; max: number }[] = [
  { name: "evidence", re: /\bevidence\b/gi, max: 1 },
  { name: "trust/trusted/trustworthy", re: /\btrust\w*\b/gi, max: 1 },
];

function allowed(page: string, context: string): boolean {
  return ALLOWLIST.some((a) => a.page === page && context.includes(a.snippet));
}

function findViolations(page: string, texts: { label: string; text: string }[]): string[] {
  const hits: string[] = [];
  for (const { label, text } of texts) {
    for (const { name, re } of BANNED_G) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const start = Math.max(0, m.index - 60);
        const context = text.slice(start, m.index + m[0].length + 60).trim();
        if (!allowed(page, context)) hits.push(`[${name}] ${label}: …${context}…`);
      }
    }
  }
  return hits;
}

for (const page of PAGES) {
  test(`${page} copy passes COPY-STYLE.md lint`, () => {
    const html = fs.readFileSync(path.join(SITE_ROOT, page), "utf-8");
    const { visible, scripts, metas } = stripBlocks(html);
    const texts = [
      { label: "visible text", text: visible },
      ...metas.map((m) => ({ label: "meta content", text: m })),
      ...stringLiterals(scripts).map((lit) => ({ label: "js string", text: lit })),
    ];
    const violations = [...findViolations(page, texts), ...headlineViolations(html)];
    for (const cap of FREQUENCY_CAPS) {
      const count = texts.reduce((n, t) => n + (t.text.match(cap.re) || []).length, 0);
      if (count > cap.max)
        violations.push(`[frequency cap] "${cap.name}" appears ${count}x (max ${cap.max} per page)`);
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
}

// Injected copy: nav labels and footer strings live in shared scripts, not in
// any page's HTML, so lint their string literals too.
for (const file of SCRIPT_FILES) {
  test(`${file} injected copy passes COPY-STYLE.md lint`, () => {
    const code = fs.readFileSync(path.join(SITE_ROOT, file), "utf-8");
    const texts = stringLiterals([code]).map((lit) => ({ label: "js string", text: lit }));
    const violations = findViolations(file, texts);
    expect(violations, violations.join("\n")).toEqual([]);
  });
}
