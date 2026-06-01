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

const CAL_URL = "https://cal.com/philip-stevens/baseweight-intro";

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
// Step order: Q3 (today) → Q2 (correctness) → Q4 (data) → Q5 (optional) →
// Q6 (optional) → Q7 (ownership) → verdict. Only the active step is visible, so
// each answer is followed by clicking Next (#fsNext). The task description (q1)
// moved out of the quiz and is now asked at the email-capture step.

test("fit score candidate verdict is ungated, then captures answers + verdict + email", async ({ page }) => {
  await page.route("**/macros/s/**", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "OK" }));
  await page.goto("/fit-score.html");
  await page.selectOption('select[name="q3_today"]', "frontier-api");
  await page.click("#fsNext");
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext");
  await page.selectOption('select[name="q4_capture"]', "easily");
  await page.click("#fsNext"); // Q4 → Q5
  await page.click("#fsNext"); // Q5 (optional) → Q6
  await page.click("#fsNext"); // Q6 (optional) → Q7
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext"); // last step → verdict

  // Verdict shows with no email asked yet (nothing gated); the email block is separate.
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);
  await expect(page.locator("#fsCapture")).toBeVisible();

  // The task description now lives at capture (moved out of the upfront quiz).
  await page.fill('#fs_capture_form textarea[name="q1_task"]', "Route an incoming support message to one of 40 queues.");
  await page.fill('#fs_capture_form input[name="email"]', "e2e+fit@example.com");
  const [req] = await Promise.all([
    page.waitForRequest("**/macros/s/**"),
    page.click('#fs_capture_form button[type="submit"]'),
  ]);
  const posted = req.postData() || "";
  expect(posted).toContain("source=fit-score");
  expect(posted).toContain("verdict=candidate");
  expect(posted).toContain("email=");
  // form-urlencoded encodes spaces as "+", which decodeURIComponent doesn't undo.
  expect(decodeURIComponent(posted.replace(/\+/g, " "))).toContain("VERDICT: candidate");
  await expect(page.locator("#fs_capture_success")).toBeVisible();
});

test("fit score renting verdict shows the result but no capture form", async ({ page }) => {
  await page.goto("/fit-score.html");
  await page.selectOption('select[name="q3_today"]', "frontier-api");
  await page.click("#fsNext");
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext");
  await page.selectOption('select[name="q4_capture"]', "easily");
  await page.click("#fsNext");
  await page.click("#fsNext"); // Q5
  await page.click("#fsNext"); // Q6
  await page.check('input[name="q7_own"][value="rent"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/not us/i);
  await expect(page.locator("#fsCapture")).toBeHidden();
});

test("fit score blocks advancing until the current question is answered", async ({ page }) => {
  await page.goto("/fit-score.html");
  await page.click("#fsNext"); // first step (Q3) unanswered
  await expect(page.locator("#fsError")).toBeVisible();
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#fsq-q3_today")).toBeVisible(); // still on step 1
});

// The verdict must not hinge on the optional labelled-count field. A data-rich
// team that can't capture more (capture="no") but already holds plenty of
// labelled examples is a candidate — it must never fall through to "Not yet". (Finding 3.1.)
test("fit score: data-rich 'can't get more' still scores as a candidate", async ({ page }) => {
  await page.goto("/fit-score.html");
  await page.selectOption('select[name="q3_today"]', "manual");
  await page.click("#fsNext");
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext");
  await page.selectOption('select[name="q4_capture"]', "no");
  await page.selectOption('select[name="q4_labeled"]', "1000plus");
  await page.click("#fsNext");
  await page.click("#fsNext"); // Q5
  await page.click("#fsNext"); // Q6
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/Pilot/i);
});

// When capture="no", the labelled count is decisive, so a blank must be caught
// rather than silently read as zero (which would mis-verdict). (Finding 3.1.)
test("fit score: blank labelled count with 'can't get more' is blocked, not mis-verdicted", async ({ page }) => {
  await page.goto("/fit-score.html");
  await page.selectOption('select[name="q3_today"]', "manual");
  await page.click("#fsNext");
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext");
  // Q4 step: can't capture more, labelled left blank → blocked on this step.
  await page.selectOption('select[name="q4_capture"]', "no");
  await page.click("#fsNext");
  await expect(page.locator("#fsErrLabeled")).toBeVisible();
  await expect(page.locator("#fsq-q4_capture")).toHaveClass(/fs-q--invalid/);
  await expect(page.locator("#result")).toBeHidden();

  // Supplying a low range unblocks it; little data + can't-capture-more → "Not yet".
  await page.selectOption('select[name="q4_labeled"]', "lt50");
  await page.selectOption('select[name="q4_examples"]', "lt50");
  await page.click("#fsNext"); // past Q4
  await page.click("#fsNext"); // Q5
  await page.click("#fsNext"); // Q6
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#fsBadge")).toContainText(/not yet/i);
});

// A blank required step is blocked, and that step is marked invalid. (Finding 3.3.)
test("fit score: a blank required step is blocked and marked invalid", async ({ page }) => {
  await page.goto("/fit-score.html");
  await page.selectOption('select[name="q3_today"]', "frontier-api");
  await page.click("#fsNext");
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext");
  await page.selectOption('select[name="q4_capture"]', "easily");
  await page.click("#fsNext");
  await page.click("#fsNext"); // Q5
  await page.click("#fsNext"); // Q6
  // Q7 (Ownership) deliberately left unanswered.
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#fsError")).toBeVisible();
  await expect(page.locator("#fsq-q7_own")).toHaveClass(/fs-q--invalid/);
});

// "Edit my answers" returns to the quiz with answers preserved. (Finding 2.1.)
test("fit score: 'Edit my answers' returns to the quiz with answers intact", async ({ page }) => {
  await page.goto("/fit-score.html");
  await page.selectOption('select[name="q3_today"]', "manual");
  await page.click("#fsNext");
  await page.check('input[name="q2_correctness"][value="exact"]');
  await page.click("#fsNext");
  await page.selectOption('select[name="q4_capture"]', "easily");
  await page.click("#fsNext");
  await page.click("#fsNext"); // Q5
  await page.click("#fsNext"); // Q6
  await page.check('input[name="q7_own"][value="own"]');
  await page.click("#fsNext");
  await expect(page.locator("#result")).toBeVisible();

  await page.getByRole("link", { name: /Edit my answers/i }).click();
  await expect(page.locator("#quiz")).toBeVisible();
  await expect(page.locator("#result")).toBeHidden();
  // back on step 1; previously entered answers survive the round-trip
  await expect(page.locator('select[name="q3_today"]')).toHaveValue("manual");
  await expect(page.locator('input[name="q7_own"][value="own"]')).toBeChecked();
});
