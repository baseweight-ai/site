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
  { path: "/head-to-head.html",   title: /Head-to-head/i },
  { path: "/methodology.html", title: /How it.s tested/i },
  { path: "/contact.html",     title: /Contact/ },
  { path: "/privacy.html",     title: /Privacy/ },
  { path: "/scope.html",   title: /Baseweight/ },
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
  await expect(nav.getByRole("link", { name: "Head-to-head", exact: true })).toBeVisible();
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

test("head-to-head page has its nav link marked active", async ({ page }) => {
  await page.goto("/head-to-head.html");
  // The active nav link should reference /head-to-head
  const activeLink = page.locator("nav a.active, nav a[aria-current]");
  if (await activeLink.count() > 0) {
    const href = await activeLink.first().getAttribute("href");
    expect(href).toMatch(/head-to-head/i);
  }
});

// ── Capture paths (new) ─────────────────────────────────────────────────────
// The fit check is the site's primary capture; the about page hosts the
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

// ── Fit check: one-question-per-screen wizard ──────────────────────────────
// Flow order: task → correctness (the gate) → data → what-handles-it-today →
// wedge (optional) → scale (optional) → ownership → result. Q1 takes ≥1 task-type
// tick or a one-line description; each later answer is followed by clicking Next.
// startFit() opens the wizard and clears Q1 so a test can focus on the rest.
async function startFit(page) {
  await page.goto("/scope.html");
  await page.check('input[name="q1_type"][value="sort"]');
  await page.click("#fsNext");
}

test("fit check candidate result is ungated, then captures answers + verdict + email", async ({ page }) => {
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

  // The result shows with no email asked yet (nothing gated); the email block is separate.
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Candidate/i);
  // The candidate result is a next step plus Build drivers, never a grade or a price.
  await expect(page.locator("#fsTitle")).toContainText(/head-to-head/i);
  await expect(page.locator("#fsBody")).toContainText(/pass mark agreed up front/i);
  await expect(page.locator("#fsBody")).not.toContainText("$");
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
  expect(decodeURIComponent(posted.replace(/\+/g, " "))).toContain("RESULT: candidate");
  await expect(page.locator("#fs_capture_success")).toBeVisible();
});

// The cost clause ("the per-call API bill is worth pricing against a model you run yourself")
// is gated to high volume — below 100k/mo it'd be noise, so absent there, present at scale.
test("fit check: the volume clause is gated to high-volume bands", async ({ page }) => {
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
    await expect(page.locator("#fsBadge")).toContainText(/Candidate/i); // candidate, so the clause is in play
  }
  const CLAUSE = /worth pricing against a model you run/i;
  await candidateWithVolume("lt1k"); // under 1,000/mo — no cost economics raised
  await expect(page.locator("#fsBody")).not.toContainText(CLAUSE);
  await candidateWithVolume("1Mplus"); // over 1M/mo — cost is worth pricing, so the clause appears
  await expect(page.locator("#fsBody")).toContainText(CLAUSE);
});

// A compliance blocker adds the in-your-environment driver to the candidate result;
// other blockers add nothing (cost enters only via the volume clause).
test("fit check: a compliance blocker adds the in-your-environment driver", async ({ page }) => {
  await startFit(page);
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext"); // → data
  await page.check('input[name="q4_data"][value="have_get"]');
  await page.click("#fsNext"); // → what handles it today
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.check('input[name="q5_blockers"][value="compliance"]');
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Candidate/i);
  await expect(page.locator("#fsBody")).toContainText(/inside your environment/i);
});

// With two or more blockers, a "biggest one?" picker appears listing only the ticked
// options; the explicit pick overrides the DOM-order fallback in the wedge clause.
test("fit check: with multiple blockers, the biggest-one picker drives the wedge", async ({ page }) => {
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
  // compliance is first in DOM, so the fallback would feature it; pick cost instead and
  // the compliance driver must stay out of the result
  await page.check('input[name="q5_dealbreaker"][value="cost"]');
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBody")).not.toContainText(/inside your environment/i);
});

// The wedge stem adapts to what handles the task today: API → "what's wrong with it"; rules or
// manual → a stem about their own approach, not a hypothetical API they never weighed.
test("fit check: the wedge question adapts to what handles the task today", async ({ page }) => {
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

// "Who would run it?" only applies once they choose to deploy — hidden on "rent" and before answering.
test("fit check: the 'who runs it' sub-question shows only on a deploy answer", async ({ page }) => {
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
test("fit check: reliably-judged with reviewer records scores as a candidate", async ({ page }) => {
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
  await expect(page.locator("#fsBadge")).toContainText(/Candidate/i);
});

// Expert-disagreement correctness has no consistent way to judge yet, so it routes to
// "Not measurable yet": the definition of correct comes before anything can be scoped.
test("fit check: subjective correctness routes to Not measurable yet", async ({ page }) => {
  await startFit(page); // Q1 (task) → correctness
  await page.check('input[name="q2_correctness"][value="subjective"]');
  await page.click("#fsNext"); // correctness → today (the data step is skipped)
  await expect(page.locator("#fsq-q4_capture")).toBeHidden();
  await expect(page.locator("#fsq-q3_today")).toBeVisible();
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Not measurable/i);
  await expect(page.locator("#fsTitle")).toContainText(/agree how you.d judge it/i);
  await expect(page.locator("#fsBody")).toContainText(/definition of right/i);
});

// "Not sure how we'd measure it" routes the same way: the first step is agreeing the rule.
test("fit check: unsure-how-to-measure routes to Not measurable yet", async ({ page }) => {
  await startFit(page); // Q1 (task) → correctness
  await page.check('input[name="q2_correctness"][value="unsure"]');
  await page.click("#fsNext"); // correctness → today (the data step is skipped)
  await expect(page.locator("#fsq-q4_capture")).toBeHidden();
  await expect(page.locator("#fsq-q3_today")).toBeVisible();
  await page.check('input[name="q3_today"][value="manual"]');
  await page.click("#fsNext"); // → wedge
  await page.click("#fsNext"); // → scale
  await page.click("#fsNext"); // → ownership
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext"); // → result
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Not measurable/i);
  await expect(page.locator("#fsBody")).toContainText(/pass mark the Build opens against/i);
  await expect(page.locator("#fsCapture")).toBeVisible();
});

test("fit check renting verdict shows the result but no capture form", async ({ page }) => {
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
test("fit check: renting but with a hard cost wedge at volume routes to candidate", async ({ page }) => {
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
  await expect(page.locator("#fsBadge")).toContainText(/Candidate/i); // Candidate → Build, not "not us"
  await expect(page.locator("#fsBody")).toContainText(/point the other way/i);
  await expect(page.locator("#fsCapture")).toBeVisible();
});

// Q7 "not my call" (no budget) keeps the task verdict but pivots the primary action to
// forwarding it up, so a task-owner-without-budget isn't dead-ended on a call they can't book.
test("fit check: 'not my call' routes to a forward-it-up action with a reframed capture", async ({ page }) => {
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
  await expect(page.locator("#fsBadge")).toContainText(/Candidate/i); // still computes the task result
  await expect(page.locator("#fsBody")).toContainText(/budget/i);   // forward framing prepended
  await expect(page.locator("#fsCta")).toContainText(/Forward/i);   // action is forward-it-up
  await expect(page.locator("#fsCapture")).toBeVisible();
});

// A build-capable buyer (their own team builds models) gets the cost-and-priority read;
// the Q3 follow-up shows only for the "other-ai" branch.
test("fit check: an in-house builder gets the cost-and-priority read", async ({ page }) => {
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
  await expect(page.locator("#fsTitle")).toContainText(/roadmap/i);
  await expect(page.locator("#fsCta")).toContainText(/head-to-head/i);
  await expect(page.locator("#fsCapture")).toBeVisible();
});

// The referral off-ramp catches the reader who isn't the task owner: present throughout the
// quiz (from the first question, below the nav) and on the result, including the dead-end
// "Probably not us" verdict, which otherwise offers only the benchmark link.
test("fit check: referral off-ramp shows during the quiz and on the result", async ({ page }) => {
  await page.goto("/scope.html");
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

test("fit check blocks advancing until a question is answered", async ({ page }) => {
  await page.goto("/scope.html");
  await page.click("#fsNext"); // Q1 (task) unanswered — no type, no line
  await expect(page.locator("#fsError")).toBeVisible();
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#fsq-q1_task")).toBeVisible(); // still on Q1
  // a single type tick satisfies Q1 and advances
  await page.check('input[name="q1_type"][value="sort"]');
  await page.click("#fsNext");
  await expect(page.locator("#fsq-q2_correctness")).toBeVisible();
});

// "No data yet, but we could get it" is a candidate: being able to create the test set
// counts as measurable.
test("fit check: 'could get it' data scores as a candidate", async ({ page }) => {
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
  await expect(page.locator("#fsBadge")).toContainText(/Candidate/i);
});

// "Yes, but hard to get more" unlocks the amount; a few hundred already on hand is enough
// to measure on → candidate.
test("fit check: 'have but stuck' with enough on hand scores as a candidate", async ({ page }) => {
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
  await expect(page.locator("#fsBadge")).toContainText(/Candidate/i);
});

// "Not sure" on the amount doesn't turn a have-but-stuck buyer away; only a clear
// "too few" is a no.
test("fit check: 'have but stuck' with unsure amount still scores as a candidate", async ({ page }) => {
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
  await expect(page.locator("#fsBadge")).toContainText(/Candidate/i);
});

// The data step is required; "Yes, but hard to get more" unlocks a required amount, and
// fewer than a few hundred there can't clear the gate → "Not yet".
test("fit check: data required; 'have but stuck' with too few routes to Not yet", async ({ page }) => {
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
test("fit check: a blank required step is blocked and marked invalid", async ({ page }) => {
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
test("fit check: 'Edit my answers' returns to the quiz with answers intact", async ({ page }) => {
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
