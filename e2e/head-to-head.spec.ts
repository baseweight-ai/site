import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// Real benchmark output. The site shows two tasks (cuad, banking77); the fixture
// also carries fpb rows, which every page intentionally ignores.
const FIXTURE_JSON = fs.readFileSync(
  path.join(__dirname, "fixtures/benchmark-results.json"),
  "utf-8"
);

// Parsed once from the page's TASKS declaration, so a task going live (its
// `upcoming` block deleted) changes no magic numbers here.
const PAGE_HTML = fs.readFileSync(path.join(__dirname, "..", "head-to-head.html"), "utf-8");
const TASK_SHAPES = [...PAGE_HTML.matchAll(/shape: '([^']+)'/g)].map((m) => m[1]);
const TASK_VERTICALS = [...PAGE_HTML.matchAll(/vertical: '([^']+)'/g)].map((m) => m[1]);
const UPCOMING_COUNT = [...PAGE_HTML.matchAll(/upcoming:\s*\{/g)].length;

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
  await page.goto("/head-to-head.html");
  await expect(page).toHaveTitle(/Head-to-head/i);
});

test("navigation links are visible", async ({ page }) => {
  await page.goto("/head-to-head.html");
  await expect(page.getByRole("link", { name: /Baseweight/i }).first()).toBeVisible();
});

// ── Task tabs ─────────────────────────────────────────────────────────────────

// Live tasks come from results.json; upcoming tasks render as placeholder tabs
// with a status chip. Expected counts derive from the TASKS declaration.
test("task tabs render for live and upcoming tasks", async ({ page }) => {
  await page.goto("/head-to-head.html");
  await expect(page.locator('[role="tab"]')).toHaveCount(TASK_SHAPES.length);
  await expect(page.locator(".task-tab-soon")).toHaveCount(UPCOMING_COUNT);
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
  await page.goto("/head-to-head.html");
  const active = page.locator('[role="tab"][aria-selected="true"]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveText(/Contract review/i);
});

test("clicking a task tab switches the active tab", async ({ page }) => {
  await page.goto("/head-to-head.html");
  await page.getByRole("tab", { name: /Support triage/i }).click();
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(/Support triage/i);
});

// ── Per-task explanation + consolidated layout ──────────────────────────────────

test("per-task explanation renders and updates on tab switch", async ({ page }) => {
  await page.goto("/head-to-head.html");
  await expect(page.locator("#taskBlurb")).not.toBeEmpty();
  await expect(page.locator("#taskBlurb")).toContainText(/contract/i);
  await page.getByRole("tab", { name: /Support triage/i }).click();
  await expect(page.locator("#taskBlurb")).toContainText(/rout/i);
});

test("buyer headline renders on the main page; the per-task subpage link is gone", async ({ page }) => {
  await page.goto("/head-to-head.html");
  await expect(page.locator("#benchHeadline")).toBeVisible();
  await expect(page.locator("#benchHeadline")).toContainText(/fewer|cheaper/i);
  await expect(page.locator("#taskDeepLink")).toHaveCount(0);
});

// ── Upcoming task tabs (placeholders) ────────────────────────────────────────
// An upcoming tab swaps the data sections for a status panel: honest status,
// what the task is, and the Build pointer. A live tab restores the data view.

test("an upcoming tab shows the placeholder panel instead of results", async ({ page }) => {
  await page.goto("/head-to-head.html");
  const hsTab = page.getByRole("tab", { name: /HS-code classification/i });
  await expect(hsTab).toContainText(/In build/i);
  await hsTab.click();
  await expect(page.locator("#taskBlurb")).toContainText(/HS subheading/i);
  const panel = page.locator("#upcomingPanel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/In build/i);
  await expect(panel).toContainText(/a Build opens with this same test/i);
  await expect(page.locator("#costSection")).toBeHidden();
  await expect(page.locator("#fullResults")).toBeHidden();
  await expect(page.locator("#benchHeadline")).toBeHidden();
});

test("returning to a live tab restores the data sections", async ({ page }) => {
  await page.goto("/head-to-head.html");
  await page.getByRole("tab", { name: /Part & product matching/i }).click();
  await expect(page.locator("#upcomingPanel")).toBeVisible();
  await page.getByRole("tab", { name: /Contract review/i }).click();
  await expect(page.locator("#upcomingPanel")).toBeHidden();
  await expect(page.locator("#costSection")).toBeVisible();
  await expect(page.locator("#benchHeadline")).toBeVisible();
  await expect(page.locator("#leaderboardBody tr.lb-row")).toHaveCount(3);
});

// The closing CTA bridges to the fit check (primary), with "Book a free call"
// demoted to the quiet secondary. The cal CTA keeps its canonical name + href.
test("closing CTA bridges to the fit check, with the call as secondary", async ({ page }) => {
  await page.goto("/head-to-head.html");
  const cta = page.locator(".cta-block");
  await expect(cta.getByRole("link", { name: /Scope your task/i })).toHaveAttribute("href", "/scope");
  await expect(cta.getByRole("link", { name: /Book a free call/i })).toHaveAttribute(
    "href",
    "https://cal.com/baseweight/intro"
  );
});

// ── Leaderboard (Support Routing / banking77 — has all conditions) ──────────────

test.describe("Support triage leaderboard (banking77 — has all conditions)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/head-to-head.html");
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

  test("TCO table renders one row per model", async ({ page }) => {
    await expect(page.locator("#tcoBody tr")).toHaveCount(2);
  });
});

// ── Clause Extraction (cuad — token_f1, default tab) ────────────────────────────

test("contract review leads with AUPR and lists every condition", async ({ page }) => {
  await page.goto("/head-to-head.html");
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

  await page.goto("/head-to-head.html");
  await expect(page.locator("nav")).toBeVisible();
  expect(errors.filter((e) => !e.includes("Failed to load benchmark data"))).toHaveLength(0);
});
