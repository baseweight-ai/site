/**
 * The results component for /retrieval-service (retrieval-results.js): first
 * alone in a blank document, given a snapshot already held to the schema or
 * null when none is committed, then mounted on the page.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { SITE_ROOT, expectSectionOrder } from "./copy-text";
import { parseSnapshot, type ResultsSnapshot } from "./retrieval-service-schema";

const COMPONENT = path.join(SITE_ROOT, "retrieval-results.js");
const SNAPSHOT = path.join(SITE_ROOT, "data/retrieval-service/results.json");
const FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures/retrieval-service-results.json"),
  "utf-8"
);

type Row = ResultsSnapshot["metrics"][number];

const INTERVAL = /^-?\d+(\.\d+)? to -?\d+(\.\d+)?$/;
const headers = (ci: string) => [
  "Metric", "Setup", "Question set", "Subset", "n", "Score", ci, "Change from baseline", `Change ${ci}`,
];
// Each table's caption names its kind of score; the page's notes define both.
const CAPTIONS = {
  gated: "Gated",
  advisory: "Advisory",
};
// How to read the figures, in the page's notes.
const READING =
  "Each score shows n, the number of questions behind it, and a CI, the range the true score likely sits in.";

// The fixture with every figure distinct and unrounded, so a test can tell
// which cell each one landed in, plus a gated row listed after the advisory
// ones: the same metric gates on one configuration and not on another.
function snapshot(): ResultsSnapshot {
  const doc = JSON.parse(FIXTURE);
  doc.metrics.push({ ...doc.metrics[0], name: "ndcg_at_10" });
  doc.metrics.forEach((m: Row, i: number) => {
    if (m.value === null) return;
    Object.assign(m, {
      n: 101 + i,
      value: Number(`0.5${i}1234`),
      ci_low: Number(`0.4${i}1234`),
      ci_high: Number(`0.6${i}1234`),
    });
    if (m.delta_vs_baseline != null)
      Object.assign(m, {
        delta_vs_baseline: Number(`0.1${i}1234`),
        delta_ci_low: Number(`-0.0${i}1234`),
        delta_ci_high: Number(`0.2${i}1234`),
      });
  });
  return parseSnapshot(JSON.stringify(doc));
}

// Page order: the gated table, then the advisory one, each in snapshot order.
const gatedRows = (s: ResultsSnapshot) => s.metrics.filter((m) => m.gated);
const advisoryRows = (s: ResultsSnapshot) => s.metrics.filter((m) => !m.gated);
const inPageOrder = (s: ResultsSnapshot) => [...gatedRows(s), ...advisoryRows(s)];

async function load(page: Page): Promise<Locator> {
  await page.setContent('<main id="mount"></main>');
  await page.addScriptTag({ path: COMPONENT });
  return page.locator("#mount");
}

function render(page: Page, s: ResultsSnapshot | null) {
  return page.evaluate((s) => (window as any).renderResults(document.getElementById("mount"), s), s);
}

// Every body row, in page order, as column header → cell text. A cell that
// spans columns is keyed by the first of them.
function readRows(mount: Locator): Promise<Record<string, string>[]> {
  return mount.locator("table").evaluateAll((tables) =>
    (tables as HTMLTableElement[]).flatMap((t) => {
      const heads = [...t.tHead!.rows[0].cells].map((c) => c.textContent ?? "");
      return [...t.tBodies[0].rows].map((r) => {
        const row: Record<string, string> = {};
        let col = 0;
        for (const c of r.cells) {
          row[heads[col]] = c.textContent ?? "";
          col += c.colSpan;
        }
        return row;
      });
    })
  );
}

test("one row renders per metric", async ({ page }) => {
  const s = snapshot();
  const mount = await load(page);
  await render(page, s);
  const rows = await readRows(mount);
  expect(rows.map((r) => r.Metric)).toEqual(inPageOrder(s).map((m) => m.name));
});

test("n and both CI bounds appear on every measured row", async ({ page }) => {
  const s = snapshot();
  const mount = await load(page);
  await render(page, s);
  const rows = await readRows(mount);
  const pairs = inPageOrder(s).map((m, i) => [m, rows[i]] as const);
  const measured = pairs.filter(([m]) => m.value !== null);
  expect(measured.map(([, r]) => [r.n, r.CI])).toEqual(
    measured.map(([m]) => [String(m.n), `${m.ci_low} to ${m.ci_high}`])
  );
  // The fixture's null row has no n or bounds to show, so it says so instead.
  const unmeasured = pairs.filter(([m]) => m.value === null);
  expect(unmeasured.map(([, r]) => r)).toEqual(
    unmeasured.map(([m]) => ({
      Metric: m.name,
      Setup: m.config,
      "Question set": m.tier,
      Subset: m.slice,
      n: "Not measured",
    }))
  );
});

test("a baseline delta renders with its own CI, only where present", async ({ page }) => {
  const s = snapshot();
  const mount = await load(page);
  await render(page, s);
  const rows = await readRows(mount);
  const measured = inPageOrder(s)
    .map((m, i) => [m, rows[i]] as const)
    .filter(([m]) => m.value !== null);
  expect(measured.map(([, r]) => [r["Change from baseline"], r["Change CI"]])).toEqual(
    measured.map(([m]) =>
      m.delta_vs_baseline == null
        ? ["", ""]
        : [String(m.delta_vs_baseline), `${m.delta_ci_low} to ${m.delta_ci_high}`]
    )
  );
});

test("no bare point estimate renders anywhere", async ({ page }) => {
  const mount = await load(page);
  await render(page, snapshot());
  for (const r of await readRows(mount)) {
    if (r.Score) expect([r.n, r.CI]).toEqual([expect.stringMatching(/^\d+$/), expect.stringMatching(INTERVAL)]);
    if (r["Change from baseline"]) expect(r["Change CI"]).toMatch(INTERVAL);
  }
  // No figure sits outside a row.
  const chrome = await mount.locator("caption, thead").allTextContents();
  expect(chrome.join(" ")).not.toMatch(/\d/);

  // A figure without its n or interval stops the render and the mount keeps
  // what it showed. The schema passes a delta without bounds, so the
  // component holds that line itself.
  const breaks: ((m: any) => void)[] = [
    (m) => delete m.n,
    (m) => delete m.ci_high,
    (m) => Object.assign(m, { delta_ci_low: null, delta_ci_high: null }),
  ];
  for (const change of breaks) {
    await render(page, null);
    const s = snapshot();
    change(s.metrics[0]);
    await expect(render(page, s)).rejects.toThrow();
    await expect(mount).toHaveText("Measurement pending");
  }
});

test("gated and advisory rows are distinguishable to a screen reader", async ({ page }) => {
  const s = snapshot();
  await load(page);
  await render(page, s);
  // Each category is a table named by its visible caption: the distinction is
  // in the accessible name and on screen, never in colour alone.
  const gated = page.getByRole("table", { name: CAPTIONS.gated, exact: true });
  const advisory = page.getByRole("table", { name: CAPTIONS.advisory, exact: true });
  await expect(gated.getByRole("rowheader")).toHaveText(gatedRows(s).map((m) => m.name));
  await expect(advisory.getByRole("rowheader")).toHaveText(advisoryRows(s).map((m) => m.name));
  await expect(gated.locator("caption")).toBeVisible();
  await expect(advisory.locator("caption")).toBeVisible();
});

// The level is the file's top-level confidence_level, a fraction. Moving its
// decimal point keeps the percent exact, where multiplying by a hundred would
// show 0.954 as 95.39999999999999.
test("the CI headers show the file's confidence level, or plain CI without one", async ({ page }) => {
  const mount = await load(page);
  const cases = [
    [undefined, "CI"],
    [0.95, "95% CI"],
    [0.954, "95.4% CI"],
  ] as const;
  for (const [level, ci] of cases) {
    const s = snapshot();
    if (level !== undefined) Object.assign(s, { confidence_level: level });
    await render(page, s);
    await expect(mount.locator("thead th")).toHaveText([...headers(ci), ...headers(ci)]);
  }
});

// The tables and nothing else: no sentence and no control. How to read the
// figures is in the page's notes. The pending state is a label, not a sentence.
test("the mount holds the tables alone, and the pending state is a label", async ({ page }) => {
  const mount = await load(page);
  await render(page, snapshot());
  await expect(mount.locator(":scope > *")).toHaveCount(2);
  await expect(mount.locator(":scope > .table-wrap")).toHaveCount(2);
  await expect(mount.locator("p, details")).toHaveCount(0);
  await render(page, null);
  await expect(mount).toHaveText("Measurement pending");
  expect(await mount.innerText()).not.toMatch(/[.!?]/);
});

test("a confidence level that is not a number between 0 and 1 refuses the file", async ({ page }) => {
  const mount = await load(page);
  for (const level of [0, 1, 95, -0.95, "0.95", null]) {
    await render(page, null);
    await expect(render(page, Object.assign(snapshot(), { confidence_level: level }))).rejects.toThrow();
    await expect(mount).toHaveText("Measurement pending");
  }
});

test("with no snapshot it renders the pending state and no numeric content", async ({ page }) => {
  const mount = await load(page);
  await render(page, null);
  await expect(mount).toHaveText("Measurement pending");
  expect(await mount.innerText()).not.toMatch(/\d/);
  await expect(mount.locator("table")).toHaveCount(0);
});

test("the committed snapshot renders one row per metric", async ({ page }) => {
  test.skip(!fs.existsSync(SNAPSHOT), "no snapshot committed yet");
  const s = parseSnapshot(fs.readFileSync(SNAPSHOT, "utf-8"));
  const mount = await load(page);
  await render(page, s);
  await expect(mount.locator("tbody tr")).toHaveCount(s.metrics.length);
});

// ── On the page ───────────────────────────────────────────────────────────────

const PAGE = "/retrieval-service.html";
const FAILED = "The results could not be loaded.";
// The two kinds of score, defined in the page's closed notes, where the method
// gives the reason judged scores are advisory (brief §2).
const DEFINITIONS = {
  Gated: "A change that regresses the score cannot merge.",
  Advisory: "A change that regresses the score can still merge.",
};
const REASON =
  "The judged scores are advisory: they cover a small hand-written set, " +
  "where the confidence interval is wide enough that a gate would fire on noise.";

async function openWith(page: Page, status: number, body = "") {
  await page.route("**/data/retrieval-service/results.json", (route) =>
    route.fulfill({ status, contentType: "application/json", body })
  );
  const read = page.waitForResponse("**/data/retrieval-service/results.json");
  await page.goto(PAGE);
  await read;
}

// In every state: the heading and nothing else above the tables, no legend or
// control among them, and last in the section the one closed control holding
// the notes.
async function expectResultsFrame(page: Page) {
  await expect(page.locator("#results > h2")).toHaveText("Results");
  await expect(page.locator("#resultsMount :is(dl, details)")).toHaveCount(0);
  await expect(page.locator("#results details")).toHaveCount(1);
  const notes = page.locator("#results > :last-child");
  await expect(notes).toHaveId("notes");
  await expect(notes).not.toHaveAttribute("open");
  await expect(notes.locator(":scope > summary")).toBeVisible();
  await expectSectionOrder(page, ["#results > h2", "#resultsMount", "#notes > summary"]);
}

test("with no snapshot, results show the pending note and the closed notes", async ({ page }) => {
  await openWith(page, 404);
  await expectResultsFrame(page);
  await expect(page.locator("#resultsMount")).toHaveText("Measurement pending");
  await expect(page.locator("#results table")).toHaveCount(0);
  await expect(page.locator("#resultsFailed")).toBeHidden();
});

test("each kind of score is defined once on the page, in one sentence, in the notes", async ({ page }) => {
  await openWith(page, 404);
  const notes = page.locator("#notes .table-legend");
  await expect(notes.locator("dt")).toHaveText(Object.keys(DEFINITIONS));
  await expect(notes.locator("dd")).toHaveText(Object.values(DEFINITIONS));
  for (const definition of Object.values(DEFINITIONS)) {
    expect(definition).toMatch(/^[^.!?]+\.$/);
    await expect(page.getByText(definition, { exact: true })).toHaveCount(1);
  }
  // The captions name the two kinds with the legend's own terms.
  await openWith(page, 200, FIXTURE);
  await expect(page.locator("#results caption")).toHaveText(Object.keys(DEFINITIONS));
});

test("the notes give the reason judged scores are advisory, once", async ({ page }) => {
  await openWith(page, 404);
  await expect(page.locator("#notes")).toContainText(REASON);
  await expect(page.getByText(REASON, { exact: true })).toHaveCount(1);
});

// N and n mean different things, so the headers render in their own case.
test("the sample-size header reads n", async ({ page }) => {
  await openWith(page, 200, FIXTURE);
  const n = page.getByRole("columnheader", { name: "n", exact: true });
  await expect(n.first()).toHaveText("n", { useInnerText: true });
});

test("with a snapshot, each table's caption names its kind of score, and the notes say how to read the figures", async ({ page }) => {
  await openWith(page, 200, FIXTURE);
  await expectResultsFrame(page);
  const doc = JSON.parse(FIXTURE);
  for (const [caption, gated] of [[CAPTIONS.gated, true], [CAPTIONS.advisory, false]] as const) {
    const rows = page.getByRole("table", { name: caption, exact: true }).locator("tbody tr");
    await expect(rows).toHaveCount(doc.metrics.filter((m: Row) => m.gated === gated).length);
  }
  await expect(page.locator("#notes > p", { hasText: READING })).toHaveCount(1);
  await expect(page.locator("#resultsMount")).not.toContainText("Measurement pending");
  await expect(page.locator("#resultsFailed")).toBeHidden();
});

// The caption names the table, so a table wider than a phone scrolls under it
// while the caption stays whole on screen.
test("at phone width each caption stays inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWith(page, 200, FIXTURE);
  const edges = await page.locator("#results caption").evaluateAll((cs) => cs.map((c) => c.getBoundingClientRect().right));
  expect(edges).toHaveLength(2);
  for (const right of edges) expect(right).toBeLessThanOrEqual(390);
});

test("a snapshot that cannot be read shows the failure note, never a blank section", async ({ page }) => {
  await openWith(page, 200, FIXTURE.slice(0, 200));
  await expectResultsFrame(page);
  await expect(page.locator("#resultsFailed")).toBeVisible();
  await expect(page.locator("#resultsFailed")).toHaveText(FAILED);
  await expect(page.locator("#resultsMount")).toBeEmpty();
});

// A percent where the level's fraction is due: the page's own check passes,
// and the component refuses the file.
test("a snapshot the component refuses shows the failure note", async ({ page }) => {
  await openWith(page, 200, JSON.stringify({ ...JSON.parse(FIXTURE), confidence_level: 95 }));
  await expectResultsFrame(page);
  await expect(page.locator("#resultsFailed")).toBeVisible();
  await expect(page.locator("#resultsFailed")).toHaveText(FAILED);
  await expect(page.locator("#resultsMount")).toBeEmpty();
});
