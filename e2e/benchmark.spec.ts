import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// Read once; skip JSON.parse since route.fulfill accepts a string directly.
const FIXTURE_JSON = fs.readFileSync(
  path.join(__dirname, "fixtures/benchmark-results.json"),
  "utf-8"
);

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
  await expect(page).toHaveTitle(/Benchmark/);
});

test("navigation links are visible", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.getByRole("link", { name: /Baseweight/i }).first()).toBeVisible();
});

// ── Headline stats ────────────────────────────────────────────────────────────

test("total cost stat is populated from meta.total_cost", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.locator("#stat-total-cost")).toHaveText(/\$247/);
});

// ── Task tabs ─────────────────────────────────────────────────────────────────

test("task tabs render for all six tasks", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.locator('[role="tab"]')).toHaveCount(6);
});

test("first task tab is active on load", async ({ page }) => {
  await page.goto("/benchmark.html");
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
});

test("clicking a task tab switches the active tab", async ({ page }) => {
  await page.goto("/benchmark.html");
  await page.getByRole("tab", { name: /Fin\. Sentiment/i }).click();
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(/Fin\. Sentiment/i);
});

// ── Leaderboard (Fin. Sentiment / fpb) ───────────────────────────────────────

test.describe("Fin. Sentiment leaderboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/benchmark.html");
    await page.getByRole("tab", { name: /Fin\. Sentiment/i }).click();
  });

  test("renders rows after data loads", async ({ page }) => {
    await expect(page.locator("#leaderboardBody tr")).toHaveCount(2);
  });

  test("shows model name and metric value", async ({ page }) => {
    const body = page.locator("#leaderboardBody");
    await expect(body).toContainText("GPT-4.1");
    await expect(body).toContainText("0.873");
  });

  test("shows condition label not raw condition key", async ({ page }) => {
    const body = page.locator("#leaderboardBody");
    await expect(body).toContainText("Zero-shot");
    await expect(body).toContainText("LoRA-500");
    await expect(body).not.toContainText("zero-shot");
    await expect(body).not.toContainText("lora-500");
  });

  test("metric column header matches task metric label", async ({ page }) => {
    await expect(page.locator("#metricColLabel")).toContainText("Weighted F1");
  });

  test("rows are sorted descending by metric by default", async ({ page }) => {
    const rows = page.locator("#leaderboardBody tr");
    const firstMetric = await rows.first().locator("td").nth(2).textContent();
    const secondMetric = await rows.nth(1).locator("td").nth(2).textContent();
    expect(parseFloat(firstMetric!)).toBeGreaterThanOrEqual(parseFloat(secondMetric!));
  });

  test("TCO table renders rows", async ({ page }) => {
    await expect(page.locator("#tcoBody tr")).toHaveCount(2);
  });

  test("TCO volume input re-renders table", async ({ page }) => {
    await page.locator("#tcoVolume").fill("50000");
    await page.locator("#tcoVolume").dispatchEvent("input");
    await expect(page.locator("#tcoBody tr")).toHaveCount(2);
  });
});

// ── Empty task ────────────────────────────────────────────────────────────────

test("leaderboard is empty for task with no results", async ({ page }) => {
  await page.goto("/benchmark.html");
  await page.getByRole("tab", { name: /Support Routing/i }).click();
  await expect(page.locator("#leaderboardBody tr")).toHaveCount(0);
});

// ── Data fetch failure ────────────────────────────────────────────────────────

test("page renders without crashing when data fetch fails", async ({ page }) => {
  // This route is registered after beforeEach; Playwright's LIFO order means it takes precedence.
  await page.route("**/data/benchmark/results.json", (route) => {
    route.fulfill({ status: 500, body: "Internal Server Error" });
  });

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/benchmark.html");
  await expect(page.locator("nav")).toBeVisible();
  expect(errors.filter((e) => !e.includes("Failed to load benchmark data"))).toHaveLength(0);
});
