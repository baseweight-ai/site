import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { CAL_URL, SITE_ROOT, expectSectionOrder } from "./copy-text";

// Real benchmark output. The site shows two tasks (cuad, banking77); the fixture
// also carries fpb rows, which every page intentionally ignores.
const FIXTURE_JSON = fs.readFileSync(
  path.join(__dirname, "fixtures/benchmark-results.json"),
  "utf-8"
);

// Parsed once from the page's TASKS declaration, so adding a task changes no
// magic numbers here.
const PAGE_HTML = fs.readFileSync(path.join(SITE_ROOT, "benchmark.html"), "utf-8");
const TASK_SHAPES = [...PAGE_HTML.matchAll(/shape: '([^']+)'/g)].map((m) => m[1]);
const TASK_VERTICALS = [...PAGE_HTML.matchAll(/vertical: '([^']+)'/g)].map((m) => m[1]);

// Intercept the data fetch so tests run offline with deterministic data.
test.beforeEach(async ({ page }) => {
  await page.route("**/data/benchmark/results.json", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: FIXTURE_JSON,
    });
  });
});

// ── Page load ─────────────────────────────────────────────────────────────────

test("benchmark page loads with correct title", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page).toHaveTitle("Benchmark: how we measure | Baseweight");
});

// The page sells the method, not a result: the headline says so, and the body
// names what was published rather than who won.
test("the hero names what was compared", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.locator("h1")).toHaveText("Open models, fine-tuned, against a frontier API.");
  await expect(page.locator(".page-hero .subtitle")).toHaveText(
    "Narrow, high-volume tasks, across zero-shot, few-shot and fine-tuned conditions."
  );
  await expect(page.locator(".page-hero .section-label")).toHaveText("Benchmark");
});

test("navigation links are visible", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.getByRole("link", { name: /Baseweight/i }).first()).toBeVisible();
});

// ── Task tabs ─────────────────────────────────────────────────────────────────

// Every tab opens onto published numbers. Work in progress gets no tab, so a
// status chip anywhere here means a placeholder crept back.
test("every tab is a published task, with no status chips", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.locator('[role="tab"]')).toHaveCount(TASK_SHAPES.length);
  await expect(page.locator(".task-tab-soon")).toHaveCount(0);
  await expect(page.getByText(/in build|planned|coming soon/i)).toHaveCount(0);
});

// The portfolio is a spanning set: every task pairs a distinct shape with a
// distinct vertical, so no two tabs cover the same ground. Static check against
// the TASKS declaration so a duplicate is caught at authoring time.
test("task portfolio has no duplicate shapes or verticals", () => {
  expect(TASK_SHAPES.length).toBeGreaterThan(0);
  expect(TASK_VERTICALS.length).toEqual(TASK_SHAPES.length);
  expect(new Set(TASK_SHAPES).size).toEqual(TASK_SHAPES.length);
  expect(new Set(TASK_VERTICALS).size).toEqual(TASK_VERTICALS.length);
});

test("clause extraction tab is active on load", async ({ page }) => {
  await page.goto("/benchmark.html");
  const active = page.locator('[role="tab"][aria-selected="true"]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveText(/Contract review/i);
});

test("clicking a task tab switches the active tab", async ({ page }) => {
  await page.goto("/benchmark.html");
  await page.getByRole("tab", { name: /Support triage/i }).click();
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(/Support triage/i);
});

// ── Per-task explanation + consolidated layout ──────────────────────────────────

test("per-task explanation renders and updates on tab switch", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.locator("#taskBlurb")).not.toBeEmpty();
  await expect(page.locator("#taskBlurb")).toContainText(/contract/i);
  await page.getByRole("tab", { name: /Support triage/i }).click();
  await expect(page.locator("#taskBlurb")).toContainText(/rout/i);
});

// Cut on 2026-09-20: the stat cards restated rows the table already carries,
// and the cost calculator was a second argument on a page whose credibility is
// restraint. Neither comes back without a decision.
test("no stat callouts and no cost calculator", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.locator("#benchHeadline, .bh-cards, .bench-keyresult")).toHaveCount(0);
  await expect(page.locator("#costSection, .tco-calculator, #tcoBody, #gpuRate")).toHaveCount(0);
  await expect(page.getByText(/what it costs to run/i)).toHaveCount(0);
});

test("the page runs hero, tasks, results, artifacts, CTA in that order", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expectSectionOrder(page, ["h1", "#taskTabs", "#leaderboardTable", "#reproArtifacts", ".cta-block"]);
});

// ── Run date ────────────────────────────────────────────────────────────────
// The hosted API's cost tier moves between runs, so the date the comparison was
// measured belongs above the numbers, not only in the artifacts at the bottom.

test("the run date is stated near the top, with the model it ran against", async ({ page }) => {
  await page.goto("/benchmark.html");
  const stamp = page.locator("#benchStamp");
  await expect(stamp).toBeVisible();
  await expect(stamp).toContainText(/Run \d{1,2} \w+ \d{4}/);
  await expect(stamp).toContainText("GPT-5.4 Mini");
  // Above the results, not buried with them.
  const stampBox = (await stamp.boundingBox())!;
  const tabsBox = (await page.locator("#taskTabs").boundingBox())!;
  expect(stampBox.y).toBeLessThan(tabsBox.y);
});

// The run date lives in the hero stamp only; the legend names the tier.
test("the leaderboard legend names the hosted-API tier", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.locator(".table-legend")).toContainText("Hosted API, cost tier");
  await expect(page.locator("#apiAsOf")).toHaveCount(0);
});

// The closing CTA is the booking link; every CTA on the site routes to cal.com.
test("closing CTA books a call", async ({ page }) => {
  await page.goto("/benchmark.html");
  const cta = page.locator(".cta-block");
  await expect(cta.getByRole("link", { name: /Book a call/i })).toHaveAttribute("href", CAL_URL);
});

// ── Leaderboard (Support Routing / banking77 — has all conditions) ──────────────

test.describe("Support triage leaderboard (banking77 — has all conditions)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/benchmark.html");
    await page.getByRole("tab", { name: /Support triage/i }).click();
  });

  test("renders a row per model/condition", async ({ page }) => {
    await expect(page.locator("#leaderboardBody tr.lb-row")).toHaveCount(5);
  });

  test("shows both the open and hosted-API model", async ({ page }) => {
    const body = page.locator("#leaderboardBody");
    await expect(body).toContainText("Qwen3-8B");
    await expect(body).toContainText("GPT-5.4 Mini");
  });

  test("shows human-readable condition labels", async ({ page }) => {
    const body = page.locator("#leaderboardBody");
    await expect(body).toContainText("LoRA");
    await expect(body).toContainText("Zero-shot");
    await expect(body).toContainText("5-shot");
  });

  test("metric column header matches task metric label", async ({ page }) => {
    await expect(page.locator("#metricColLabel")).toContainText("Weighted F1");
  });

  test("rows are sorted descending by metric by default", async ({ page }) => {
    const rows = page.locator("#leaderboardBody tr.lb-row");
    const firstMetric = await rows.first().locator("td").nth(2).textContent();
    const secondMetric = await rows.nth(1).locator("td").nth(2).textContent();
    expect(parseFloat(firstMetric!)).toBeGreaterThanOrEqual(parseFloat(secondMetric!));
  });

});

// ── Clause Extraction (cuad — token_f1, default tab) ────────────────────────────

// The legend names the categories; the chart is the explanation. Definitions
// were cut on 2026-09-20, and the reproduce section opens on the artifacts.
test("the error legend is labels only, and reproduce opens on the artifacts", async ({ page }) => {
  await page.goto("/benchmark.html");
  const items = page.locator(".error-legend-item");
  await expect(items.first()).toBeVisible();
  for (const text of await items.allInnerTexts()) {
    expect(text.trim().split(/\s+/).length, text).toBeLessThanOrEqual(3);
  }
  await expect(page.locator(".repro-lead")).toHaveCount(0);
  await expect(page.locator(".lb-hint")).toHaveCount(0);
});

// One sentence each: what the task is, not why it is hard.
test("task blurbs are a single sentence", async ({ page }) => {
  await page.goto("/benchmark.html");
  for (const name of [/Contract review/i, /Support triage/i]) {
    await page.getByRole("tab", { name }).click();
    const text = (await page.locator("#taskBlurb").innerText()).trim();
    expect((text.match(/\.(\s|$)/g) || []).length, text).toBe(1);
  }
});

test("contract review leads with AUPR and lists every condition", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.locator("#metricColLabel")).toContainText("AUPR");
  await expect(page.locator("#leaderboardBody tr.lb-row")).toHaveCount(3);
});

// ── Data fetch failure ──────────────────────────────────────────────────────────

test("page renders without crashing when data fetch fails", async ({ page }) => {
  // Registered after beforeEach; Playwright's LIFO order means it takes precedence.
  await page.route("**/data/benchmark/results.json", (route) => {
    route.fulfill({ status: 500, body: "Internal Server Error" });
  });

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/benchmark.html");
  await expect(page.locator("nav")).toBeVisible();
  expect(errors.filter((e) => !e.includes("Failed to load benchmark data"))).toHaveLength(0);
});
