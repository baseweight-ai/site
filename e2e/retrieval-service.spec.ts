/**
 * The Retrieval page and its results snapshot (INTEGRATION-BRIEF.md §4).
 * This spec holds the committed snapshot to the schema, and a malformed or
 * truncated file fails the suite. The vercel.json build command runs the same
 * parser, so that file fails the deploy too. The fixture tests pin what the
 * schema rejects.
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { SITE_ROOT, expectSectionOrder } from "./copy-text";
import { parseSnapshot } from "./retrieval-service-schema";

// Copied by hand from the service repo once a measured run exists (brief §4).
const SNAPSHOT = path.join(SITE_ROOT, "data/retrieval-service/results.json");

// Valid and synthetic throughout. e2e/ is publicly served, so the fixture's
// own limitations entry says that nothing in it was measured.
const FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures/retrieval-service-results.json"),
  "utf-8"
);
const ASR = JSON.parse(FIXTURE).metrics.findIndex((m) => m.name === "injection_asr");

// The fixture with one change applied, as text again.
function fixtureWith(change: (doc: any) => void): string {
  const doc = JSON.parse(FIXTURE);
  change(doc);
  return JSON.stringify(doc);
}

test("the committed snapshot matches the schema", () => {
  test.skip(!fs.existsSync(SNAPSHOT), "no snapshot committed yet");
  expect(() => parseSnapshot(fs.readFileSync(SNAPSHOT, "utf-8"))).not.toThrow();
});

test("a valid fixture parses", () => {
  expect(() => parseSnapshot(FIXTURE)).not.toThrow();
});

// Required on every metric row (brief §4).
for (const field of ["n", "ci_low", "ci_high", "gated"]) {
  test(`a metric row missing ${field} fails`, () => {
    const json = fixtureWith((doc) => {
      delete doc.metrics[1][field];
    });
    expect(() => parseSnapshot(json)).toThrow(`metrics[1].${field}: missing`);
  });
}

test("an empty limitations list fails", () => {
  const json = fixtureWith((doc) => {
    doc.limitations = [];
  });
  expect(() => parseSnapshot(json)).toThrow("limitations: expected at least one entry");
});

// The likely strays: §2's display names, and the latencies from `operational`.
test("an unknown metric name fails", () => {
  for (const name of ["recall@20", "nDCG@10", "p50_latency_ms", "p95_latency_ms"]) {
    const json = fixtureWith((doc) => {
      doc.metrics[0].name = name;
    });
    expect(() => parseSnapshot(json)).toThrow(`metrics[0].name: unknown metric "${name}"`);
  }
});

// Typed as the service's design writes them.
test("judge.swap_order is a boolean and judge.prompt_version a string", () => {
  const swap = fixtureWith((doc) => {
    doc.judge.swap_order = "true";
  });
  expect(() => parseSnapshot(swap)).toThrow("judge.swap_order: expected true or false");
  const version = fixtureWith((doc) => {
    doc.judge.prompt_version = 3;
  });
  expect(() => parseSnapshot(version)).toThrow("judge.prompt_version: expected a non-empty string");
});

// Whether a row gates depends on its tier and configuration as well as its
// name: recall_at_20 gates on the deployed configuration, not on a lesser rung.
test("gated is read from each row, never inferred from its name", () => {
  const json = fixtureWith((doc) => {
    doc.metrics.push({ ...doc.metrics[1], name: "recall_at_20", gated: false });
  });
  const rows = parseSnapshot(json).metrics.filter((m) => m.name === "recall_at_20");
  expect(rows.map((m) => [m.config, m.gated])).toEqual([
    ["deployed", true],
    ["baseline", false],
  ]);
});

// The fixture's injection_asr row is null, as from a run without the
// adversarial tier. The service has not settled that row's shape, so n may be
// 0 or null, or the row may be absent. The null itself stays null.
test("a null injection_asr passes with n 0 or null, or with no row", () => {
  expect(parseSnapshot(FIXTURE).metrics[ASR].value).toBeNull();
  const nNull = fixtureWith((doc) => {
    doc.metrics[ASR].n = null;
  });
  expect(() => parseSnapshot(nNull)).not.toThrow();
  const noRow = fixtureWith((doc) => {
    doc.metrics.splice(ASR, 1);
  });
  expect(() => parseSnapshot(noRow)).not.toThrow();
});

// A positive n, a bound or a delta beside the null would each read as a
// measurement: a delta is a change in a measured value.
test("a null injection_asr fails beside a positive n, a bound or a delta", () => {
  const counted = fixtureWith((doc) => {
    doc.metrics[ASR].n = 10;
  });
  expect(() => parseSnapshot(counted)).toThrow(`metrics[${ASR}].n: expected 0 or null`);
  const bounded = fixtureWith((doc) => {
    doc.metrics[ASR].ci_low = 0;
  });
  expect(() => parseSnapshot(bounded)).toThrow(`metrics[${ASR}].ci_low: expected null`);
  const delta = fixtureWith((doc) => {
    doc.metrics[ASR].delta_vs_baseline = 0;
  });
  expect(() => parseSnapshot(delta)).toThrow(`metrics[${ASR}].delta_vs_baseline: expected null`);
});

test("no other metric may be null", () => {
  const json = fixtureWith((doc) => {
    doc.metrics[0].value = null;
  });
  expect(() => parseSnapshot(json)).toThrow("metrics[0].value: expected a number");
});

// ── Page ──────────────────────────────────────────────────────────────────────
// Each test serves the snapshot itself, so none depends on whether one is
// committed.

const PAGE = "/retrieval-service.html";

function serveSnapshot(page: Page, status: number, body = "") {
  return page.route("**/data/retrieval-service/results.json", (route) =>
    route.fulfill({ status, contentType: "application/json", body })
  );
}

// Shown beside the demo before anyone types, so held with it until it ships.
const CORPUS_BOUNDARY =
  "The index holds a capped subset of English Wikipedia, frozen at one past dump. " +
  "Anything newer, this week’s news included, is outside it.";
const ANECDOTE =
  "One question is an anecdote. The results below measure the service over its test set.";
// The deployed GET /v1/meta attribution, verbatim (brief §3). The page shows no
// corpus text until the demo renders a passage, so it ships with the demo.
const ATTRIBUTION =
  "Modified passages from Wikipedia articles, under CC BY-SA 3.0: " +
  "https://creativecommons.org/licenses/by-sa/3.0/";

// The img role hides the diagram's labels from screen readers, so its title
// carries the whole pipeline.
const PIPELINE =
  "Ingest, chunk, embed, Postgres with pgvector and BM25, hybrid retrieve, rerank, " +
  "generate with citations, verify. Every stage sends OpenTelemetry spans to a tracing backend.";

// A reader deciding whether to care reads the top and stops; one checking the
// work scrolls. So the claim leads the first screen, the demo goes directly
// under it, and the diagram, the method and the results follow, in that order.
test("the page runs claim, demo, diagram, method, results in that order", async ({ page }) => {
  await serveSnapshot(page, 404);
  await page.goto(PAGE);
  await expect(page.locator(".page-hero .lead")).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".methodology-content > :first-child")).toHaveId("demo");
  // Unhidden as it will be when it ships, so its slot is measured, not assumed.
  await page.locator("#demo").evaluate((el) => el.removeAttribute("hidden"));
  await expectSectionOrder(page, [
    ".page-hero .lead",
    "#demo",
    "#how-its-built",
    "#how-its-measured",
    "#results",
  ]);
});

test("every limitations entry renders verbatim and in full", async ({ page }) => {
  // The fixture's own entry, then two that a summary, a cap or an innerHTML
  // insert would each change.
  const json = fixtureWith((doc) => {
    doc.limitations.push("A second entry, kept in order.", "Markup stays text: <b>bold</b> & <i>em</i>.");
  });
  await serveSnapshot(page, 200, json);
  await page.goto(PAGE);
  await expect(page.locator("#limitations li")).toHaveText(JSON.parse(json).limitations);
});

test("with no snapshot, results show the pending state and no figures", async ({ page }) => {
  await serveSnapshot(page, 404);
  const read = page.waitForResponse("**/data/retrieval-service/results.json");
  await page.goto(PAGE);
  await read;
  await expect(page.locator("#results")).toContainText("Measurement pending.");
  await expect(page.locator("#resultsMount")).toHaveText("Measurement pending.");
  await expect(page.locator("#limitations")).toBeHidden();
  await expect(page.locator("#reproduce")).toBeHidden();
  // The pipeline diagram names BM25; nothing else on the page may show a digit.
  const rest = (await page.locator("main").innerText()).replace(/BM25/g, "");
  expect(rest).not.toMatch(/\d/);
});

test("the pipeline diagram carries its text alternative", async ({ page }) => {
  await serveSnapshot(page, 404);
  await page.goto(PAGE);
  await expect(page.getByRole("img", { name: PIPELINE, exact: true })).toBeVisible();
});

test("the demo section is held hidden, with its corpus note, the attribution and an empty mount", async ({ page }) => {
  await serveSnapshot(page, 404);
  await page.goto(PAGE);
  const note = page.locator("#demo .demo-note");
  await expect(page.locator("#demo")).toBeHidden();
  await expect(note).toContainText(CORPUS_BOUNDARY);
  await expect(note).toContainText(ANECDOTE);
  // The only copy on the page, so it shows with the demo and not before.
  await expect(page.locator(".attribution")).toHaveCount(1);
  await expect(page.locator("#demo #demoAttribution")).toHaveText(ATTRIBUTION);
  await expect(page.locator("#demoMount")).toBeEmpty();
});

test("a snapshot that cannot be read says so", async ({ page }) => {
  await serveSnapshot(page, 200, FIXTURE.slice(0, 200));
  await page.goto(PAGE);
  await expect(page.locator("#limitations")).toContainText("The limitations could not be loaded.");
  await expect(page.locator("#limitations li")).toHaveCount(0);
  await expect(page.locator("#reproduce")).toBeHidden();
});

test("the pinned revisions render from the snapshot", async ({ page }) => {
  const pins = ["pin-dataset", "pin-revision", "pin-generator", "pin-embedder", "pin-reranker", "pin-judge"];
  const json = fixtureWith((doc) => {
    [doc.dataset.repo, doc.dataset.revision, doc.system.generator, doc.system.embedder, doc.system.reranker, doc.judge.model] = pins;
  });
  await serveSnapshot(page, 200, json);
  await page.goto(PAGE);
  await expect(page.locator("#reproduce dd")).toHaveText(pins);
});
