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

// The one sentence above the demo, which it describes.
const LEAD = "One question, answered several ways side by side.";
// The one sentence while the demo is held back: what the page is, true in
// either state, so the meta and social descriptions carry it too.
const PAGE_LEAD = "AI search over Wikipedia, and how we measure it.";
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

// What the reading path leaves out, all in the closed notes under the results:
// the method, then the demo's notes, the first two the page's own and the next
// two retrieval-demo.js's.
const METHOD = [
  "Retrieval is scored against the source pages the dataset records for each question, so its ground truth " +
    "comes from the data. Answers are scored by a language model acting as judge.",
  "The judged scores are advisory: they cover a small hand-written set, " +
    "where the confidence interval is wide enough that a gate would fire on noise.",
  "Confidence intervals come from a paired bootstrap clustered by source page, " +
    "because several questions can share one source page.",
];
const DEMO_NOTES = [
  "The index holds a capped subset of English Wikipedia, frozen at one past dump. " +
    "Anything newer, this week’s news included, is outside it.",
  "One question is an anecdote. The results above measure the service over its test set.",
  "Read-only. Comparisons are rate-limited, and the demo has a daily budget.",
  "Your question and IP address go to our service, which passes the question to its providers.",
];

// A reader deciding whether to care reads the top and stops. One sentence
// leads, the demo sits directly under it, then the results, the build and the
// call, which ends the page. Everything else waits in one closed control under
// the results. The ids pin the sequence, so a section moved, added or dropped
// fails here.
const SECTIONS = ["demo", "results", "how-its-built"];

test("one sentence, the demo, the results with the closed notes, the build, then the call", async ({ page }) => {
  // A valid snapshot shows every part, so each slot is measured, not assumed.
  await serveSnapshot(page, 200, FIXTURE);
  await page.goto(PAGE);
  const ids = await page.locator("article.methodology-content > section").evaluateAll((s) => s.map((e) => e.id));
  expect(ids).toEqual(SECTIONS);
  // Unhidden as it will be when it ships.
  await page.locator("#demo").evaluate((el) => el.removeAttribute("hidden"));
  await expect(page.locator(".page-hero .lead-demo")).toBeInViewport({ ratio: 1 });
  await expect(page.locator("#reproduce")).toBeVisible();
  await expectSectionOrder(page, [".page-hero .lead-demo", ...SECTIONS.map((id) => `#${id}`), ".cta-block"]);
  await expectSectionOrder(page, ["#resultsMount", "#limitations", "#reproduce", "#notes"]);
  await expect(page.locator("#results > :last-child")).toHaveId("notes");
  await expect(page.locator("main > section:last-child .container > :last-child")).toHaveClass("cta-block");
  await page.locator("#notes > summary").click();
  await expectSectionOrder(page, ["#notes > summary", "#notes > p", "#demoNotes"]);
});

// Between the demo and the tables, the results heading and nothing else.
test("between the demo and the tables sits the heading alone", async ({ page }) => {
  await serveSnapshot(page, 200, FIXTURE);
  await page.goto(PAGE);
  await page.locator("#demo").evaluate((el) => el.removeAttribute("hidden"));
  await expect(page.locator("#results .table-wrap").first()).toBeVisible();
  const between = await page.evaluate(() => {
    const top = document.getElementById("demo")!.getBoundingClientRect().bottom;
    const end = document.querySelector("#results .table-wrap")!.getBoundingClientRect().top;
    return [...document.querySelectorAll("main *")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        const texted = [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
        return texted && r.height > 1 && r.top >= top && r.bottom <= end;
      })
      .map((e) => e.textContent!.trim());
  });
  expect(between).toEqual(["Results"]);
});

// The notes are one closed control under the results. What the snapshot
// supplies beside the tables, its limitations and pins, shows without it, and
// opening it shows every other qualification in full.
test("the notes start closed, the snapshot's limitations and pins show without them, and opening them shows every qualification", async ({ page }) => {
  await serveSnapshot(page, 200, FIXTURE);
  await page.goto(PAGE);
  await page.locator("#demo").evaluate((el) => el.removeAttribute("hidden"));
  await expect(page.locator("main details:not(#demo *)")).toHaveCount(1);
  await expect(page.locator('main a[href="#notes"]')).toHaveCount(0);
  const notes = page.locator("#notes");
  await expect(notes).not.toHaveAttribute("open");
  await expect(page.locator("#limitations li")).toHaveText(JSON.parse(FIXTURE).limitations);
  await expect(page.locator("#limitations li").first()).toBeVisible();
  await expect(page.locator("#reproduce dd")).toHaveCount(6);
  await expect(page.locator("#reproduce dd").first()).toBeVisible();
  for (const line of [...METHOD, ...DEMO_NOTES, ATTRIBUTION]) {
    await expect(notes.locator("p", { hasText: line })).toBeHidden();
  }

  const summary = notes.locator(":scope > summary");
  await expect(summary).toHaveText("How it’s measured, and its limits");
  await summary.click();
  await expect(notes.locator(":scope > p")).toHaveText(METHOD);
  await expect(notes.locator(":scope > p").first()).toBeVisible();
  for (const line of [...DEMO_NOTES, ATTRIBUTION]) {
    await expect(notes.locator("#demoNotes p", { hasText: line })).toBeVisible();
  }
});

// The demo is the page: above it, only the sentence. The h1 stays for screen
// readers and search, visually hidden.
test("only one sentence, and no visible heading, sits above the demo", async ({ page }) => {
  await serveSnapshot(page, 404);
  await page.goto(PAGE);
  await page.locator("#demo").evaluate((el) => el.removeAttribute("hidden"));
  const above = await page.evaluate(() => {
    const top = document.getElementById("demo")!.getBoundingClientRect().top;
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && r.bottom <= top;
    };
    return {
      headings: [...document.querySelectorAll("main :is(h1, h2, h3, h4)")].filter(shown).map((e) => e.textContent),
      text: [...document.querySelectorAll("main :is(p, div, span)")]
        .filter((e) => shown(e) && !e.children.length)
        .map((e) => e.textContent),
    };
  });
  expect(above).toEqual({ headings: [], text: [LEAD] });
  expect(LEAD.match(/[.!?]/g)).toHaveLength(1);
  await expect(page.getByRole("heading", { level: 1, name: "Retrieval" })).toHaveCount(1);
  await expect(page.locator("#demo h2")).toHaveCount(0);
});

// Held back, the demo leaves the page its own sentence above the results, and
// nothing else; shown, the demo's sentence takes its place.
test("in either state one sentence says what the page is, and the descriptions carry the one true in both", async ({ page }) => {
  await serveSnapshot(page, 404);
  await page.goto(PAGE);
  const shown = () =>
    page.evaluate(() => {
      const top = document.getElementById("results")!.getBoundingClientRect().top;
      return [...document.querySelectorAll("main :is(p, div, span, h1, h2, h3)")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 1 && r.height > 1 && r.bottom <= top && !e.children.length;
        })
        .map((e) => e.textContent);
    });
  expect(await shown()).toEqual([PAGE_LEAD]);
  await expect(page.locator(".page-hero .lead-page")).toBeInViewport({ ratio: 1 });
  expect(PAGE_LEAD.match(/[.!?]/g)).toHaveLength(1);
  await page.locator("#demo").evaluate((el) => el.removeAttribute("hidden"));
  await expect(page.locator(".page-hero .lead-page")).toBeHidden();
  await expect(page.locator(".page-hero .lead-demo")).toHaveText(LEAD);
  for (const name of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
    await expect(page.locator(name)).toHaveAttribute("content", PAGE_LEAD);
  }
});

test("no heading carries a section number", async ({ page }) => {
  await serveSnapshot(page, 200, FIXTURE);
  await page.goto(PAGE);
  await page.locator("#demo").evaluate((el) => el.removeAttribute("hidden"));
  const numbered = await page.locator("main :is(h1, h2, h3, h4)").evaluateAll((hs) =>
    hs
      .filter((h) => !["none", "normal"].includes(getComputedStyle(h, "::before").content) || /^\s*\d/.test(h.textContent!))
      .map((h) => h.textContent)
  );
  expect(numbered).toEqual([]);
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

// The sentence above the demo describes it, so it is held back with it.
test("the demo section is held hidden, and the sentence and notes that speak of it with it", async ({ page }) => {
  await serveSnapshot(page, 404);
  await page.goto(PAGE);
  await expect(page.locator("#demo")).toBeHidden();
  await expect(page.locator(".page-hero .lead-demo")).toBeHidden();
  await page.locator("#notes > summary").click();
  await expect(page.locator("#notes > p").first()).toBeVisible();
  await expect(page.locator("#demoNotes")).toBeHidden();
  // retrieval-demo.js, mounted by the page, holds the question box.
  await expect(page.locator("#demoMount input#demoQuestion")).toHaveCount(1);
  // The section holds the demo and the attribution, and nothing else.
  await expect(page.locator("#demo > *")).toHaveCount(2);
  await expect(page.locator("#demoMount + #demoAttribution")).toHaveText(ATTRIBUTION);
  // Every copy sits with the demo or its notes, so none shows before the demo does.
  await expect(page.locator(".attribution:not(#demo *, #demoNotes *)")).toHaveCount(0);
  await expect(page.locator("#demoNotes .attribution")).toHaveText(ATTRIBUTION);
  for (const line of DEMO_NOTES) await expect(page.locator("#demoNotes")).toContainText(line);
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
