/**
 * Copy budgets: anti-bloat enforcement (COPY-STYLE.md "Copy budgets").
 *
 * Every page's visible word count must stay inside its budget. The budgets are
 * the page's recorded size plus ~10% headroom, so normal wording edits fit but
 * a new section or a re-promised differentiator does not. When this test
 * blocks an addition, the correct response is to CUT something: a new sentence
 * displaces a weaker one, a new section must do a named job no existing
 * section does (each message has exactly one home per page).
 *
 * Raise a budget only for a deliberate scope decision, in the same change,
 * with a one-line justification comment next to the number. A page missing
 * from BUDGETS fails the suite, so new pages get budgeted on arrival.
 *
 * Counted: the same visible text the copy lint scans (copy-text.ts).
 * JS-rendered copy (quiz results, head-to-head blurbs) is bounded separately
 * by the lint suite; this test bounds the static page.
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { SITE_ROOT, sitePages, visibleWords } from "./copy-text";

const BUDGETS: { page: string; words: number; note: string }[] = [
  { page: "index.html",        words: 1100, note: "2026-07-14 baseline 997: hero, proof strip, tasks, how-it-works, who-it's-for, founding partners, 8 FAQs, final CTA" },
  { page: "about.html",        words: 340,  note: "2026-07-14 baseline 301: identity, how-we-work cards, founder, head-to-head opt-in, CTA" },
  { page: "head-to-head.html", words: 290,  note: "2026-07-14 baseline 261 (static shell; results and blurbs render from data)" },
  { page: "scope.html",        words: 650,  note: "2026-07-14 baseline 582 (quiz questions; results render from JS)" },
  { page: "methodology.html",  words: 1060, note: "2026-07-14 baseline 956 (technical spec; precision over brevity, but still bounded)" },
  { page: "contact.html",      words: 30,   note: "2026-07-14 baseline 20: contact details only, per COPY-STYLE.md" },
  { page: "privacy.html",      words: 460,  note: "2026-07-14 baseline 417 (legal text; exempt from lint, still bounded)" },
];

test("every page has a copy budget", () => {
  const pages = sitePages();
  const budgeted = new Set(BUDGETS.map((b) => b.page));
  const missing = pages.filter((p) => !budgeted.has(p));
  expect(
    missing,
    `Pages without a copy budget (add them to BUDGETS with a baseline note): ${missing.join(", ")}`
  ).toEqual([]);
});

for (const { page, words } of BUDGETS) {
  test(`${page} stays inside its ${words}-word copy budget`, () => {
    const count = visibleWords(fs.readFileSync(path.join(SITE_ROOT, page), "utf-8"));
    expect(
      count,
      `${page} has ${count} visible words (budget ${words}). Cut before you add: a new ` +
        `sentence displaces a weaker one. Raise the budget only for a deliberate scope ` +
        `decision, with a justification note in BUDGETS.`
    ).toBeLessThanOrEqual(words);
  });
}
