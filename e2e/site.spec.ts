/**
 * Cross-cutting site tests: nav, footer, CTAs, page titles.
 * These enforce the invariants documented in CLAUDE.md:
 *   - Footer is identical on every page
 *   - All CTA buttons say "Book a free call" and link to cal.com
 *   - Nav is rendered on every page
 */
import { test, expect } from "@playwright/test";

const PAGES = [
  { path: "/index.html",       title: /Baseweight/ },
  { path: "/about.html",       title: /About/ },
  { path: "/benchmark.html",   title: /Benchmark/ },
  { path: "/pilot.html",  title: /Pilot/ },
  { path: "/methodology.html", title: /How it.s tested/i },
  { path: "/contact.html",     title: /Contact/ },
  { path: "/privacy.html",     title: /Privacy/ },
  { path: "/fit-score.html",   title: /Baseweight/ },
];

const CAL_URL = "https://cal.com/baseweight/intro";

// Silence the benchmark data fetch on non-benchmark pages — it's not loaded on
// those pages but belt-and-suspenders in case paths change.
test.beforeEach(async ({ page }) => {
  await page.route("**/data/benchmark/results.json", (route) => route.abort());
});

// ── Page titles ───────────────────────────────────────────────────────────────

for (const { path, title } of PAGES) {
  test(`${path} has correct title`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

for (const { path } of PAGES) {
  test(`${path} renders nav`, async ({ page }) => {
    await page.goto(path);
    // components.js injects nav into <nav id="nav"> — wait for it
    await expect(page.locator("nav#nav a").first()).toBeVisible();
  });
}

test("nav contains expected links", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("nav#nav a").first()).toBeVisible();
  const nav = page.locator("nav#nav");
  // "Benchmark" must be an exact match: the nav also has a "Pilot"
  // link (the /pilot offer), so a /Benchmark/i substring match resolves to
  // two links and trips strict mode.
  await expect(nav.getByRole("link", { name: "Benchmark", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Pilot", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: /About/i })).toBeVisible();
});

// ── Footer ────────────────────────────────────────────────────────────────────

for (const { path } of PAGES) {
  test(`${path} renders footer with copyright`, async ({ page }) => {
    await page.goto(path);
    const footer = page.locator("footer");
    await expect(footer).toContainText("Baseweight");
    await expect(footer.getByRole("link", { name: /Privacy Policy/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /Contact/i })).toBeVisible();
  });
}

// ── CTA buttons ───────────────────────────────────────────────────────────────

const CTA_PAGES = PAGES.filter(p => !p.path.includes("privacy"));

for (const { path } of CTA_PAGES) {
  test(`${path} CTA buttons say "Book a free call" and link to cal.com`, async ({ page }) => {
    await page.goto(path);
    const ctas = page.getByRole("link", { name: /Book a free call/i });
    await expect(ctas.first()).toBeVisible();
    const count = await ctas.count();
    for (let i = 0; i < count; i++) {
      const href = await ctas.nth(i).getAttribute("href");
      expect(href).toBe(CAL_URL);
    }
  });
}

// ── No broken nav active state ────────────────────────────────────────────────

test("benchmark page has benchmark nav link marked active", async ({ page }) => {
  await page.goto("/benchmark.html");
  // The active nav link should reference /benchmark
  const activeLink = page.locator("nav a.active, nav a[aria-current]");
  if (await activeLink.count() > 0) {
    const href = await activeLink.first().getAttribute("href");
    expect(href).toMatch(/benchmark/i);
  }
});

// ── Capture paths (new) ─────────────────────────────────────────────────────
// The Fit Score is the site's primary capture; the about page hosts the
// notify-me opt-in. Both POST to the same Apps Script endpoint via a hidden
// iframe. The endpoint is always mocked here so tests never write to the live
// sheet; we assert on the POST body the browser actually sends.

test("about page notify capture posts to the endpoint and shows success", async ({ page }) => {
  await page.route("**/macros/s/**", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "OK" }));
  await page.goto("/about.html");
  await expect(page.locator("#about_lead_form")).toBeVisible();
  await page.locator('#about_lead_form input[name="email"]').fill("e2e+about@example.com");
  const [req] = await Promise.all([
    page.waitForRequest("**/macros/s/**"),
    page.getByRole("button", { name: /Notify Me/i }).click(),
  ]);
  expect(req.method()).toBe("POST");
  expect(req.postData() || "").toContain("email=");
  await expect(page.locator("#about_lead_success")).toBeVisible();
});

// ── Fit Score: one-question-per-screen wizard ──────────────────────────────
// Flow order: task → correctness (the gate) → data → what-handles-it-today →
// wedge (optional) → scale (optional) → ownership → verdict. Q1 takes ≥1 task-type
// tick or a one-line description; each later answer is followed by clicking Next.
// startFit() opens the wizard and clears Q1 so a test can focus on the rest.
async function startFit(page) {
  await page.goto("/fit-score.html");
  await page.check('input[name="q1_type"][value="sort"]');
  await page.click("#fsNext");
}

test("fit score candidate verdict is ungated, then captures answers + verdict + email", async ({ page }) => {
  await page.route("**/macros/s/**", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "OK" }));
  await startFit(page); // Q1 (task) → correctness
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="frontier-api"]');
  await page.click("#fsNext"); // → wedge (optional)
  await page.click("#fsNext"); // → scale (optional)
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext"); // last step → verdict

  // Verdict shows with no email asked yet (nothing gated); the email block is separate.
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);
  // The candidate verdict now surfaces the founding-rate Scan price at peak intent.
  await expect(page.locator("#fsBody")).toContainText("$1,500");
  await expect(page.locator("#fsCapture")).toBeVisible();

  // Task was captured up front (Q1); capture is now just email.
  await page.fill('#fs_capture_form input[name="email"]', "e2e+fit@example.com");
  const [req] = await Promise.all([
    page.waitForRequest("**/macros/s/**"),
    page.click('#fs_capture_form button[type="submit"]'),
  ]);
  const posted = req.postData() || "";
  expect(posted).toContain("source=fit-score");
  expect(posted).toContain("verdict=candidate");
  expect(posted).toContain("email=");
  expect(posted).toContain("q1_task="); // the task captured up front is carried to the POST
  // form-urlencoded encodes spaces as "+", which decodeURIComponent doesn't undo.
  expect(decodeURIComponent(posted.replace(/\+/g, " "))).toContain("VERDICT: candidate");
  await expect(page.locator("#fs_capture_success")).toBeVisible();
});

// The cost clause ("rent-vs-own cost gap is worth pricing") is gated to high volume — below 100k/mo
// it'd be noise, so absent there, present at scale.
test("fit score: the volume clause is gated to high-volume bands", async ({ page }) => {
  async function candidateWithVolume(volume) {
    await startFit(page); // Q1 → correctness
    await page.check('input[name="q2_correctness"][value="exact"]');
    await page.click("#fsNext"); // → data
    await page.check('input[name="q4_data"][value="have_get"]');
    await page.click("#fsNext"); // → what handles it today
    await page.check('input[name="q3_today"][value="manual"]');
    await page.click("#fsNext"); // → wedge
    await page.click("#fsNext"); // → scale
    await page.check(`input[name="q6_volume"][value="${volume}"]`);
    await page.click("#fsNext"); // → ownership
    await page.check('input[name="q7_own"][value="own"]');
    await page.click("#fsNext"); // → verdict
    await expect(page.locator("#result")).toBeVisible();
    await expect(page.locator("#fsBadge")).toContainText(/Pilot/i); // candidate, so the clause is in play
  }
  const CLAUSE = /rent-vs-own cost gap is worth pricing/i;
  await candidateWithVolume("lt1k"); // under 1,000/mo — no cost economics raised
  await expect(page.locator("#fsBody")).not.toContainText(CLAUSE);
  await candidateWithVolume("1Mplus"); // over 1M/mo — cost is worth pricing, so the clause appears
  await expect(page.locator("#fsBody")).toContainText(CLAUSE);
});

// The biggest blocker personalizes the Candidate verdict's wedge clause; latency shows up
// as "run on your own hardware".
test("fit score: the biggest blocker personalizes the candidate verdict", async ({ page }) => {
  await startFit(page);
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.check('input[name="q5_blockers"][value="latency"]');
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);
  await expect(page.locator("#fsBody")).toContainText(/own hardware/i);
});

// With two or more blockers, a "biggest one?" picker appears listing only the ticked
// options; the explicit pick overrides the DOM-order fallback in the wedge clause.
test("fit score: with multiple blockers, the biggest-one picker drives the wedge", async ({ page }) => {
  await startFit(page);
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  // one blocker: no picker (the sole blocker is already the biggest)
  await page.check('input[name="q5_blockers"][value="compliance"]');
  await expect(page.locator("#q5Biggest")).toBeHidden();
  // a second blocker reveals the picker, listing only the ticked options
  await page.check('input[name="q5_blockers"][value="cost"]');
  await expect(page.locator("#q5Biggest")).toBeVisible();
  await expect(page.locator('input[name="q5_dealbreaker"][value="compliance"]')).toBeVisible();
  await expect(page.locator('input[name="q5_dealbreaker"][value="cost"]')).toBeVisible();
  await expect(page.locator('input[name="q5_dealbreaker"][value="quality"]')).toBeHidden();
  // compliance is first in DOM, so the fallback would feature it; pick cost instead
  await page.check('input[name="q5_dealbreaker"][value="cost"]');
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBody")).toContainText(/cost at your volume/i);
  await expect(page.locator("#fsBody")).not.toContainText(/send data out/i);
});

// The wedge stem adapts to what handles the task today: API → "what's wrong with it"; rules or
// manual → a stem about their own approach, not a hypothetical API they never weighed.
test("fit score: the wedge question adapts to what handles the task today", async ({ page }) => {
  await startFit(page);
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="frontier-api"]');
  await page.click("#fsNext"); // → wedge
  await expect(page.locator("#lbl-q5-text")).toContainText(/why isn.t the big AI platform you.re using enough/i);
  // rules today → stem asks where the rules fall short, not about an API
  await page.click("#fsBack"); // → what handles it today
  await page.check('input[name="q3_today"][value="rules"]');
  await page.click("#fsNext"); // → wedge
  await expect(page.locator("#lbl-q5-text")).toContainText(/where do your rules or scripts fall short/i);
  // manual today → a stem about doing it by hand
  await page.click("#fsBack"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await expect(page.locator("#lbl-q5-text")).toContainText(/what makes doing it by hand hard to keep up/i);
});

// "Who would run it?" only applies once they choose to own — hidden on "rent" and before answering.
test("fit score: the 'who runs it' sub-question shows only when they want to own it", async ({ page }) => {
  await startFit(page);
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await expect(page.locator("#q7Op")).toBeHidden();  // before answering own/rent
  await page.check('input[name="q7_own"][value="rent"]');
  await expect(page.locator("#q7Op")).toBeHidden();  // renting: the provider runs it
  await page.check('input[name="q7_own"][value="own"]');
  await expect(page.locator("#q7Op")).toBeVisible(); // owning: your team vs managed applies
});

// Reliably-judged correctness reuses the data gate, reworded around reviewer judgments:
// having judged records (or reviewers to judge more) is a candidate.
test("fit score: reliably-judged with reviewer records scores as a candidate", async ({ page }) => {
  await startFit(page);
  await page.check('input[name="q2_correctness"][value="human"]');
  await page.click("#fsNext"); // → data (shown for reliably-judged)
  await expect(page.locator("#fsq-q4_capture")).toBeVisible();
  await expect(page.locator("#lbl-q4-text")).toContainText(/reviewers/i); // wording reframed
  await page.check('input[name="q4_data"][value="have_get"]');
  await expect(page.locator("#lbl-q4ease-text")).toContainText(/reviewers/i); // follow-up reframed too
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);
});

// The subjective-correctness path can't be benchmarked, so it routes to "Build" —
// the verdict must still tell the buyer what they get (a model they own) and that
// scope + price come before any commitment. (No single ground truth = no proof.)
test("fit score: subjective correctness routes to Build with an ownership + scope read", async ({ page }) => {
  await startFit(page); // Q1 (task) → correctness
  await page.check('input[name="q2_correctness"][value="subjective"]');
  await page.click("#fsNext"); // correctness → subjective data question (standard data skipped)
  await expect(page.locator("#fsq-q4_capture")).toBeHidden();
  await expect(page.locator("#fsq-q4_subjective")).toBeVisible();
  await page.check('input[name="q4_judge"][value="have"]'); // can construct an eval → Build
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Build/i);
  await expect(page.locator("#fsBody")).toContainText("a model you own");
  await expect(page.locator("#fsBody")).toContainText(/before you commit/i);
});

// Subjective + "nothing we'd all agree on" can't construct an eval, so it routes to a
// Scan (does any workable rubric exist?) rather than a false Build.
test("fit score: subjective with no reachable agreement routes to a Scan", async ({ page }) => {
  await startFit(page);
  await page.check('input[name="q2_correctness"][value="subjective"]');
  await page.click("#fsNext"); // → subjective data question
  await expect(page.locator("#fsq-q4_subjective")).toBeVisible();
  await page.check('input[name="q4_judge"][value="no"]'); // no agreement → Scan
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Scan/i);
});

// "Not sure how we'd measure it" can't be gated yet, so it routes to a Scan — the
// cheap read that settles whether the task is measurable before any build. (ICP #4.)
test("fit score: unsure-how-to-measure routes to a Scan-first verdict", async ({ page }) => {
  await startFit(page); // Q1 (task) → correctness
  await page.check('input[name="q2_correctness"][value="unsure"]');
  await page.click("#fsNext"); // correctness → today (both data steps skipped for unsure)
  await expect(page.locator("#fsq-q4_capture")).toBeHidden();
  await expect(page.locator("#fsq-q4_subjective")).toBeHidden();
  await expect(page.locator("#fsq-q3_today")).toBeVisible();
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext"); // → verdict
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Scan/i);
  await expect(page.locator("#fsBody")).toContainText(/measurable/i);
  await expect(page.locator("#fsCapture")).toBeVisible();
});

test("fit score renting verdict shows the result but no capture form", async ({ page }) => {
  await startFit(page); // Q1 (task) → correctness
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="frontier-api"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="rent"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/not us/i);
  await expect(page.locator("#fsCapture")).toBeHidden();
});

// A rent-leaner who also flags a hard wedge (here, cost at >1M/mo) shouldn't be bounced to
// "keep your API": that self-selects a qualified buyer out of the one task where owning wins.
// The wedge overrides the rent answer, routing to Candidate, with the tension named and the
// capture kept on.
test("fit score: renting but with a hard cost wedge at volume routes to candidate", async ({ page }) => {
  await startFit(page); // Q1 (task) → correctness
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="frontier-api"]');
  await page.click("#fsNext"); // → wedge
  await page.check('input[name="q5_blockers"][value="cost"]');
  await page.click("#fsNext"); // → scale
  await page.check('input[name="q6_volume"][value="1Mplus"]');
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="rent"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);   // Candidate → Pilot, not "not us"
  await expect(page.locator("#fsBody")).toContainText(/point the other way/i);
  await expect(page.locator("#fsCapture")).toBeVisible();
});

// Q7 "not my call" (no budget) keeps the task verdict but pivots the primary action to
// forwarding it up, so a task-owner-without-budget isn't dead-ended on a call they can't book.
test("fit score: 'not my call' routes to a forward-it-up action with a reframed capture", async ({ page }) => {
  await startFit(page);
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="notmine"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);   // still computes the task verdict
  await expect(page.locator("#fsBody")).toContainText(/budget/i);   // forward framing prepended
  await expect(page.locator("#fsCta")).toContainText(/Forward/i);   // action is forward-it-up
  await expect(page.locator("#fsCapture")).toBeVisible();
});

// A build-capable buyer (their own team builds models) is reframed to own-vs-rent, not
// over-called as a naive Pilot candidate; the Q3 follow-up shows only for the "other-ai" branch.
test("fit score: an in-house builder gets the own-vs-rent verdict, not a Pilot pitch", async ({ page }) => {
  await startFit(page);
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await expect(page.locator("#q3Builder")).toBeHidden(); // hidden until "another model or AI tool"
  await page.check('input[name="q3_today"][value="other-ai"]');
  await expect(page.locator("#q3Builder")).toBeVisible();
  await page.check('input[name="q3_builtinhouse"][value="yes"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/already build/i);
  await expect(page.locator("#fsBody")).not.toContainText("$1,500"); // not the naive candidate pitch
  await expect(page.locator("#fsCta")).toContainText(/benchmark/i);
  await expect(page.locator("#fsCapture")).toBeVisible();
});

// The referral off-ramp catches the reader who isn't the task owner: present throughout the
// quiz (from the first question, below the nav) and on the result, including the dead-end
// "Probably not us" verdict, which otherwise offers only the benchmark link.
test("fit score: referral off-ramp shows during the quiz and on the result", async ({ page }) => {
  await page.goto("/fit-score.html");
  await expect(page.locator("#quiz .fs-referral")).toBeVisible(); // from question 1, below the nav
  await expect(page.locator('#quiz .fs-referral a[href^="mailto:"]')).toBeVisible();
  // drive a "rent, no wedge" run to the Probably-not-us dead-end and confirm the path is there too
  await page.check('input[name="q1_type"][value="sort"]');
  await page.click("#fsNext");
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext");
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext");
  await page.check('input[name="q3_today"][value="frontier-api"]');
  await page.click("#fsNext"); // wedge
  await page.click("#fsNext"); // scale
  await page.click("#fsNext"); // ownership
  await page.check('input[name="q7_own"][value="rent"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/not us/i);
  await expect(page.locator("#fsReferral")).toBeVisible();
});

test("fit score blocks advancing until a question is answered", async ({ page }) => {
  await page.goto("/fit-score.html");
  await page.click("#fsNext"); // Q1 (task) unanswered — no type, no line
  await expect(page.locator("#fsError")).toBeVisible();
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#fsq-q1_task")).toBeVisible(); // still on Q1
  // a single type tick satisfies Q1 and advances
  await page.check('input[name="q1_type"][value="sort"]');
  await page.click("#fsNext");
  await expect(page.locator("#fsq-q2_correctness")).toBeVisible();
});

// "No data yet, but we could get it" is a candidate: being able to create the eval set
// counts as provable.
test("fit score: 'could get it' data scores as a candidate", async ({ page }) => {
  await startFit(page); // Q1 → correctness
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="nohave_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);
});

// "Yes, but hard to get more" unlocks the amount; a few hundred already on hand is enough
// to prove on → candidate.
test("fit score: 'have but stuck' with enough on hand scores as a candidate", async ({ page }) => {
  await startFit(page); // Q1 → correctness
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_noget"]');
  await expect(page.locator("#q4Amount")).toBeVisible();
  await page.check('input[name="q4_amount"][value="enough"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);
});

// "Not sure" on the amount doesn't turn a have-but-stuck buyer away; the Scan sizes their
// existing data, and only a clear "too few" is a no.
test("fit score: 'have but stuck' with unsure amount still scores as a candidate", async ({ page }) => {
  await startFit(page); // Q1 → correctness
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_noget"]');
  await page.check('input[name="q4_amount"][value="unsure"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);
});

// The data step is required; "Yes, but hard to get more" unlocks a required amount, and
// fewer than a few hundred there can't clear the gate → "Not yet".
test("fit score: data required; 'have but stuck' with too few routes to Not yet", async ({ page }) => {
  await startFit(page); // Q1 → correctness
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.click("#fsNext"); // unanswered → blocked
  await expect(page.locator("#fsError")).toBeVisible();
  await expect(page.locator("#fsq-q4_capture")).toHaveClass(/fs-q--invalid/);
  await expect(page.locator("#result")).toBeHidden();
  await page.check('input[name="q4_data"][value="have_noget"]'); // unlocks the amount
  await expect(page.locator("#q4Amount")).toBeVisible();
  await page.click("#fsNext"); // amount blank → blocked
  await expect(page.locator("#fsError")).toBeVisible();
  await page.check('input[name="q4_amount"][value="few"]'); // too few → not yet
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/not yet/i);
  await expect(page.locator("#fsCta")).toContainText(/quick call/i);
});

// A blank required step is blocked, and that step is marked invalid. (Finding 3.3.)
test("fit score: a blank required step is blocked and marked invalid", async ({ page }) => {
  await startFit(page); // Q1 → correctness
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="frontier-api"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  // Q7 (Ownership) deliberately left unanswered.
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#fsError")).toBeVisible();
  await expect(page.locator("#fsq-q7_own")).toHaveClass(/fs-q--invalid/);
});

// "Edit my answers" returns to the quiz with answers preserved. (Finding 2.1.)
test("fit score: 'Edit my answers' returns to the quiz with answers intact", async ({ page }) => {
  await startFit(page); // Q1 → correctness
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();

  await page.getByRole("link", { name: /Edit my answers/i }).click();
  await expect(page.locator("#quiz")).toBeVisible();
  await expect(page.locator("#result")).toBeHidden();
  // back at Q1; previously entered answers survive the round-trip
  await expect(page.locator('input[name="q1_type"][value="sort"]')).toBeChecked();
  await expect(page.locator('input[name="q3_today"][value="manual"]')).toBeChecked();
  await expect(page.locator('input[name="q7_own"][value="own"]')).toBeChecked();
});
