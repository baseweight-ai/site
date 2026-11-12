/**
 * The demo component for /retrieval-service (retrieval-demo.js), alone in a
 * blank document, against a mocked service whose payloads follow the deployed
 * openapi.json: what goes to the service and when, the wait, the rung columns
 * with their citations, and every state a failure leaves.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { SITE_ROOT, expectSectionOrder } from "./copy-text";

const COMPONENT = path.join(SITE_ROOT, "retrieval-demo.js");
const SERVICE = "https://baseweight-service.fly.dev";
// Synthetic, in the deployed openapi.json's shapes. e2e/ is publicly served,
// so the file carries no corpus text.
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures/retrieval-demo.json"), "utf-8");
// Rung.name in the deployed openapi.json, in the order the service answers.
const RUNGS = ["closed_book", "bm25", "hybrid", "full"];
// The demo's notes in full, in the page's notes. The script writes the first
// two there; the page's markup holds the rest, the attribution as it ships
// until /v1/meta answers.
const LIMITS_FULL = "Read-only. Comparisons are rate-limited, and the demo has a daily budget.";
const PRIVACY_FULL = "Your question and IP address go to our service, which passes the question to its providers.";
const CORPUS_FULL =
  "The index holds a capped subset of English Wikipedia, frozen at one past dump. " +
  "Anything newer, this week’s news included, is outside it.";
const ANECDOTE_FULL = "One question is an anecdote. The results above measure the service over its test set.";
const SHIPPED_ATTRIBUTION =
  "Modified passages from Wikipedia articles, under CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/";

type Payloads = { meta: any; health: any; compare: any };

// The deployed Rung carries `stages`; the fixture file does not, so each rung
// gets the stages the real comparison in HANDOFF.md listed on 2026-11-12: the
// served pipeline's eight in order, run or not.
const STAGES = ["rewrite", "embed", "dense", "bm25", "fuse", "rerank", "generate", "verify"];
const RUNS: Record<string, string[]> = {
  closed_book: ["generate"],
  bm25: ["bm25", "generate", "verify"],
  hybrid: ["embed", "dense", "bm25", "fuse", "generate", "verify"],
  full: STAGES,
};

// The fixture with one change applied.
function payloads(change?: (doc: Payloads) => void): Payloads {
  const doc = JSON.parse(FIXTURE);
  for (const rung of doc.compare.rungs) rung.stages = STAGES.map((name) => ({ name, runs: RUNS[rung.name].includes(name) }));
  change?.(doc);
  return doc;
}

// A pipeline's stages as text: a skipped one says so.
const stageText = (stages: { name: string; runs: boolean }[]) => stages.map((s) => (s.runs ? s.name : `${s.name}, skipped`));

const CORS = { "access-control-allow-origin": "*" };

// What a path answers in place of its payload: a status, headers and a body,
// or a network failure.
type Reply = {
  status?: number;
  headers?: Record<string, string>;
  json?: unknown;
  body?: string;
  contentType?: string;
  abort?: boolean;
};

// The service, mocked. `sent` records every request in order; a path in `hold`
// is answered only once `release` is called with it, and a path in `replies`
// with its reply, read as each request arrives.
async function mockService(page: Page, doc = payloads(), hold: string[] = [], replies: Record<string, Reply> = {}) {
  const sent: { path: string; body: string | null }[] = [];
  const releases = new Map<string, () => void>();
  const held = new Map(hold.map((p) => [p, new Promise<void>((r) => releases.set(p, r))]));
  const answers: Record<string, unknown> = {
    "/v1/meta": doc.meta,
    "/v1/health": doc.health,
    "/v1/compare": doc.compare,
  };
  await page.route(`${SERVICE}/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const reply = replies[pathname];
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: { ...CORS, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "Content-Type" },
      });
    }
    sent.push({ path: pathname, body: request.postData() });
    await held.get(pathname);
    if (!reply) return route.fulfill({ headers: CORS, json: answers[pathname] });
    if (reply.abort) return route.abort("failed");
    const headers = { ...CORS, ...reply.headers };
    return reply.json === undefined
      ? route.fulfill({ status: reply.status ?? 200, headers, body: reply.body, contentType: reply.contentType })
      : route.fulfill({ status: reply.status ?? 200, headers, json: reply.json });
  });
  return { sent, release: (p: string) => releases.get(p)!() };
}

const paths = (sent: { path: string }[]) => sent.map((s) => s.path);
const questions = (sent: { path: string; body: string | null }[]) =>
  sent.filter((s) => s.path === "/v1/compare").map((s) => JSON.parse(s.body!));

async function load(page: Page): Promise<Locator> {
  await page.setContent(
    '<section id="demo"><div id="mount"></div><p id="attribution">The attribution as the page ships it.</p></section>' +
      '<div id="demoNotes"></div>'
  );
  await page.addScriptTag({ path: COMPONENT });
  await page.evaluate(() =>
    (window as any).mountDemo(
      document.getElementById("mount"),
      document.getElementById("attribution"),
      document.getElementById("demoNotes")
    )
  );
  return page.locator("#demo");
}

const questionBox = (demo: Locator) => demo.getByRole("textbox", { name: "Question", exact: true });
const prepared = (demo: Locator) =>
  demo.getByRole("list", { name: "Prepared questions" }).getByRole("button");
// A column by its rung's name: the columns keep the order the service answers in.
const column = (demo: Locator, name: string) => demo.locator(".demo-rung").nth(RUNGS.indexOf(name));
const answers = (demo: Locator) => demo.locator(".demo-answer");
// Where the page keeps what the demo leaves out of its reading path.
const notes = (demo: Locator) => demo.page().locator("#demoNotes");
// On the page the notes are one closed control under the results; this opens
// it. The blank document has none, and its notes always show.
async function openNotes(page: Page) {
  const control = page.locator("details#notes");
  if ((await control.count()) && !(await control.evaluate((d) => (d as HTMLDetailsElement).open))) {
    await control.locator(":scope > summary").click();
  }
}
const byRank = (col: Locator) => col.locator(".demo-ranks summary");
// Each title once with its count, outside the ranking control.
const rows = (col: Locator) => col.locator(".demo-passages > ol > li");

// ── What goes to the service, and when ──────────────────────────────────────
// No consent gate exists (DISCOVERY.md §12), so the demo sends nothing a
// visitor did not start: one who never touches it reaches no new host.

for (const [what, target] of [
  ["the question box", (demo: Locator) => questionBox(demo)],
  ["a prepared question", (demo: Locator) => prepared(demo).first()],
] as const) {
  test(`nothing reaches the service until ${what} takes focus`, async ({ page }) => {
    const { sent } = await mockService(page);
    const demo = await load(page);
    await page.waitForTimeout(500);
    expect(sent).toEqual([]);
    await target(demo).focus();
    await expect.poll(() => paths(sent).sort()).toEqual(["/v1/health", "/v1/meta"]);
  });
}

// The live attribution replaces the page's copy before any rung output.
test("a question goes only once /v1/meta has answered, with the live attribution in place", async ({ page }) => {
  const doc = payloads();
  const { sent, release } = await mockService(page, doc, ["/v1/meta", "/v1/compare"]);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect.poll(() => paths(sent)).toContain("/v1/meta");
  await page.waitForTimeout(500);
  expect(paths(sent)).not.toContain("/v1/compare");
  release("/v1/meta");
  await expect.poll(() => paths(sent)).toContain("/v1/compare");
  await expect(page.locator("#attribution")).toHaveText(doc.meta.attribution);
  await expect(notes(demo).locator("p", { hasText: doc.meta.attribution })).toHaveCount(1);
  await expect(answers(demo)).toHaveCount(0);
  release("/v1/compare");
  await expect(answers(demo)).toHaveCount(RUNGS.length);
});

test("a prepared question goes as it reads, and fills the box", async ({ page }) => {
  const { sent } = await mockService(page);
  const demo = await load(page);
  const asks = prepared(demo);
  expect(await asks.count()).toBeGreaterThanOrEqual(3);
  expect(await asks.count()).toBeLessThanOrEqual(4);
  const question = (await asks.last().textContent())!;
  await asks.last().click();
  await expect(questionBox(demo)).toHaveValue(question);
  await expect.poll(() => questions(sent)).toEqual([{ query: question }]);
});

for (const [how, submit] of [
  ["Enter", (demo: Locator) => questionBox(demo).press("Enter")],
  ["the Compare button", (demo: Locator) => demo.getByRole("button", { name: "Compare", exact: true }).click()],
] as const) {
  test(`typed text goes on ${how}, as typed and nothing else`, async ({ page }) => {
    const { sent } = await mockService(page);
    const demo = await load(page);
    await questionBox(demo).fill("A question the visitor typed");
    await submit(demo);
    await expect.poll(() => questions(sent)).toEqual([{ query: "A question the visitor typed" }]);
    await expect(answers(demo)).toHaveCount(RUNGS.length);
  });
}

// ── The wait ────────────────────────────────────────────────────────────────
// A comparison comes back whole, so every rung waits until it does, and the
// only progress shown is the time elapsed.

test("while a comparison is out, every rung waits and the elapsed time counts", async ({ page }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  const { release } = await mockService(page, payloads(), ["/v1/compare"]);
  const demo = await load(page);
  await prepared(demo).first().click();
  const rungs = demo.locator(".demo-rung");
  // The labels come with the answers, so nothing heads a column until then.
  await expect(rungs.getByRole("heading")).toHaveCount(0);
  await expect(rungs.filter({ hasText: "Waiting" })).toHaveCount(RUNGS.length);
  const timer = demo.getByRole("timer");
  await expect(timer).toHaveText("0 s");
  await page.clock.runFor(3000);
  await expect(timer).toHaveText("3 s");
  await expect(demo.locator("progress, [role=progressbar]")).toHaveCount(0);
  release("/v1/compare");
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expect(rungs.filter({ hasText: "Waiting" })).toHaveCount(0);
  await expect(timer).toHaveText("3 s");
});

// ── The result ──────────────────────────────────────────────────────────────

// The fixture's passage_titles as rows: each title once, in the order it first
// ranked, with its count.
const ROWS: Record<string, string[]> = {
  closed_book: [],
  bm25: ["Synthetic Article A ×2", "Synthetic Article B ×1"],
  hybrid: ["Synthetic Article B ×1", "Synthetic Article A ×1"],
  full: ["Synthetic Article A ×2", "Synthetic Article C ×1"],
};
// The fixture's latency_ms in seconds, to one decimal.
const SECONDS: Record<string, string> = {
  closed_book: "0.1 s",
  bm25: "0.2 s",
  hybrid: "0.3 s",
  full: "0.4 s",
};

test("each rung answers in its own column, with its label, answer, passages and latency", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(demo.locator(".demo-rung h2")).toHaveText(doc.compare.rungs.map((r: any) => (r.name === "full" ? FULL : r.label)));
  for (const rung of doc.compare.rungs) {
    const col = column(demo, rung.name);
    await expect(col.locator(".demo-answer")).toHaveText(rung.answer);
    await expect(rows(col)).toHaveText(ROWS[rung.name]);
    await expect(col.locator(".demo-latency")).toHaveText(`Latency ${SECONDS[rung.name]}`);
  }
});

// The service writes a label as "what it does: how". The first part heads the
// column and the pipeline under it shows the how, so neither the rest of the
// sentence nor the technical name is on the page, open or closed.
test("a rung's heading is its label's first part, and the column holds neither the rest nor its technical name", async ({ page }) => {
  const sentence = "Synthetic short part: the rest of the sentence, at more length than a column should carry.";
  const doc = payloads((d) => {
    d.compare.rungs[1].label = sentence;
  });
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  const col = column(demo, "bm25");
  await expect(col.getByRole("heading", { level: 2 })).toHaveText("Synthetic short part");
  await expect(col).not.toContainText("the rest of the sentence");
  await expect(demo).not.toContainText("Technical name");
  await expect(demo).not.toContainText("How this works");
});

// Every rung is a served pipeline, so the full rung's label, which opens "The
// served pipeline", does not head its column: the page names it by what it does.
const FULL = "Keyword and meaning search, split and reranked";
test("the full rung is headed by what it does, whatever its label opens with", async ({ page }) => {
  const doc = payloads((d) => {
    d.compare.rungs[3].label = "The served pipeline: the question split into searches, keyword and meaning search fused, then reranked.";
  });
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(column(demo, "full").getByRole("heading", { level: 2 })).toHaveText(FULL);
  await expect(demo).not.toContainText("served pipeline");
});

// ── The pipelines ───────────────────────────────────────────────────────────
// Each column's pipeline comes from its rung's `stages`: every stage listed, in
// order, under the name the service gives it. The column keeps it as a list for
// screen readers. `stages` carries no branches, so hovering the column, focusing
// into it or tapping it draws its stages on the shape the page holds: rewrite,
// then the meaning search (embed, dense) beside the keyword search (bm25), fuse
// joining them, then rerank, generate and verify. Screen readers skip the flow.

const flow = (demo: Locator) => demo.locator(".demo-flow");
// The flow as drawn: each node's name, and whether it is struck through and
// dashed, so a skipped stage differs in more than colour.
const drawnFlow = (demo: Locator) =>
  flow(demo)
    .locator(".demo-node")
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const style = getComputedStyle(n);
        return { name: n.textContent, line: style.textDecorationLine, border: style.borderTopStyle };
      })
    );
const asDrawn = (stages: { name: string; runs: boolean }[]) =>
  stages.map((s) => ({ name: s.name, line: s.runs ? "none" : "line-through", border: s.runs ? "solid" : "dashed" }));
const box = (target: Locator) =>
  target.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });

// The answers lead, so the list sits under its answer and that answer's
// citations, ahead of the passages its search found.
test("each column keeps its pipeline as a list under its answer for screen readers, a skipped stage named in text", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  for (const rung of doc.compare.rungs) {
    const col = column(demo, rung.name);
    const pipeline = col.getByRole("list", { name: "Pipeline", exact: true });
    await expect(pipeline.getByRole("listitem")).toHaveText(stageText(rung.stages));
    expect(await shown(pipeline)).toBe(false);
    const order = await col.evaluate((c) => [...c.children].map((e) => (e.tagName === "H2" ? "h2" : e.className)));
    expect(order).toEqual([
      "h2",
      "demo-answer",
      ...(rung.citations.length ? ["demo-cites"] : []),
      "demo-stages",
      ...(rung.passage_titles.length ? ["demo-passages"] : []),
      "demo-latency",
    ]);
  }
  const pipelines = await demo.locator(".demo-stages").evaluateAll((lists) => lists.map((l) => l.textContent));
  expect(new Set(pipelines).size).toBe(RUNGS.length);
});

test("hovering a column draws its own pipeline as a flow under the row, and moving off takes it down", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expect(flow(demo)).toHaveCount(0);
  const flows = new Set<string>();
  for (const rung of doc.compare.rungs) {
    const col = column(demo, rung.name);
    await col.hover();
    await expect(flow(demo)).toBeVisible();
    await expect(flow(demo)).toHaveAttribute("aria-hidden", "true");
    const drawn = await drawnFlow(demo);
    expect(drawn).toEqual(asDrawn(rung.stages));
    flows.add(JSON.stringify(drawn));
    await expect(demo.locator(".demo-active")).toHaveCount(1);
    await expect(col).toHaveClass(/\bdemo-active\b/);
    const row = await demo.locator(".demo-rung").evaluateAll((cols) => Math.max(...cols.map((c) => c.getBoundingClientRect().bottom)));
    expect((await box(flow(demo))).top).toBeGreaterThan(row);
  }
  expect(flows.size).toBe(RUNGS.length);
  await page.mouse.move(0, 0);
  await expect(flow(demo)).toHaveCount(0);
  await expect(demo.locator(".demo-active")).toHaveCount(0);
});

// Across at a laptop's width, down at a phone's.
for (const [width, across] of [[1280, true], [390, false]] as const) {
  test(`at ${width}px the flow draws the two searches side by side, between rewrite and fuse`, async ({ page }) => {
    await mockService(page);
    const demo = await openPage(page, width);
    await prepared(demo).first().click();
    await expect(answers(demo)).toHaveCount(RUNGS.length);
    await column(demo, "full").locator(".demo-latency").hover();
    const at = await flow(demo).evaluate((f) =>
      Object.fromEntries(
        [...f.querySelectorAll(".demo-node")].map((n) => {
          const r = n.getBoundingClientRect();
          return [n.textContent!, { left: r.left, right: r.right, top: r.top, bottom: r.bottom }];
        })
      )
    );
    const [start, end, side, next] = across ? (["left", "right", "top", "bottom"] as const) : (["top", "bottom", "left", "right"] as const);
    expect(Math.abs(at.embed[start] - at.bm25[start])).toBeLessThanOrEqual(1);
    expect(at.bm25[side]).toBeGreaterThan(at.embed[next]);
    expect(Math.min(at.embed[start], at.bm25[start])).toBeGreaterThan(at.rewrite[end]);
    expect(at.fuse[start]).toBeGreaterThan(Math.max(at.dense[end], at.bm25[end]));
    for (const [a, b] of [["fuse", "rerank"], ["rerank", "generate"], ["generate", "verify"]]) expect(at[b][start]).toBeGreaterThan(at[a][end]);
  });
}

// What lights each joint, in the order the flow holds them: the fork after
// rewrite, each lane's links, the join into fuse, then the trunk. Either side
// of a fork or join counts when one of its searches runs.
const JOINTS = [
  ["rewrite", "embed|bm25"], ["rewrite", "embed"], ["embed", "dense"], ["dense", "fuse"], ["rewrite", "bm25"],
  ["bm25", "fuse"], ["dense|bm25", "fuse"], ["fuse", "rerank"], ["rerank", "generate"], ["generate", "verify"],
];
test("a joint in the flow is gold where the stages at both its ends run", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  for (const rung of doc.compare.rungs) {
    const runs = (ends: string) => ends.split("|").some((name) => RUNS[rung.name].includes(name));
    await column(demo, rung.name).hover();
    const lit = await flow(demo).locator(".demo-joint").evaluateAll((joints) => joints.map((j) => j.classList.contains("demo-lit")));
    expect(lit).toEqual(JOINTS.map(([from, to]) => runs(from) && runs(to)));
  }
});

test("focus inside a column draws its flow, and focus leaving the columns takes it down", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await column(demo, "hybrid").getByRole("button", { name: "[c1]", exact: true }).focus();
  await expect(flow(demo)).toBeVisible();
  expect(await drawnFlow(demo)).toEqual(asDrawn(doc.compare.rungs[2].stages));
  await questionBox(demo).focus();
  await expect(flow(demo)).toHaveCount(0);
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });
  test("at phone width a tapped column's flow sits directly under it, ahead of the next column, and stays", async ({ page }) => {
    const doc = payloads();
    await mockService(page, doc);
    const demo = await openPage(page, 390, 844);
    await prepared(demo).first().tap();
    await expect(answers(demo)).toHaveCount(RUNGS.length);
    await column(demo, "bm25").locator(".demo-latency").tap();
    await expect(flow(demo)).toBeVisible();
    expect(await drawnFlow(demo)).toEqual(asDrawn(doc.compare.rungs[1].stages));
    const [tapped, drawn, next] = await Promise.all([box(column(demo, "bm25")), box(flow(demo)), box(column(demo, "hybrid"))]);
    expect(drawn.top).toBeGreaterThan(tapped.bottom);
    expect(drawn.bottom).toBeLessThan(next.top);
    await page.waitForTimeout(500);
    await expect(flow(demo)).toBeVisible();
  });
});

// The page's shape names eight stages, so a rung whose stages are named
// otherwise keeps its list and draws no flow.
test("a pipeline lists the stages its rung lists, whatever they are named, and draws a flow only for the eight the shape names", async ({ page }) => {
  const doc = payloads((d) => {
    d.compare.rungs[1].stages = [
      { name: "synthetic stage one", runs: true },
      { name: "synthetic stage two", runs: false },
      { name: "synthetic stage three", runs: true },
    ];
    d.compare.rungs[2].stages = [{ name: "a lone synthetic stage", runs: false }];
  });
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expect(column(demo, "bm25").locator(".demo-stages li")).toHaveText([
    "synthetic stage one",
    "synthetic stage two, skipped",
    "synthetic stage three",
  ]);
  await expect(column(demo, "hybrid").locator(".demo-stages li")).toHaveText(["a lone synthetic stage, skipped"]);
  await expect(column(demo, "full").locator(".demo-stages li")).toHaveText(stageText(doc.compare.rungs[3].stages));
  for (const name of ["bm25", "hybrid"]) {
    await column(demo, name).hover();
    await expect(flow(demo)).toHaveCount(0);
  }
  await column(demo, "full").hover();
  await expect(flow(demo).locator(".demo-node")).toHaveText(STAGES);
});

test("a rung that lists no stages shows no pipeline or flow, and its answer and the other pipelines still show", async ({ page }) => {
  const doc = payloads((d) => {
    delete d.compare.rungs[0].stages;
    d.compare.rungs[3].stages = [];
  });
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  for (const name of ["closed_book", "full"]) {
    await expect(column(demo, name).locator(".demo-stages")).toHaveCount(0);
    await column(demo, name).hover();
    await expect(flow(demo)).toHaveCount(0);
  }
  for (const rung of doc.compare.rungs.slice(1, 3)) {
    await expect(column(demo, rung.name).locator(".demo-stages li")).toHaveText(stageText(rung.stages));
    await column(demo, rung.name).hover();
    await expect(flow(demo).locator(".demo-node")).toHaveText(rung.stages.map((s: any) => s.name));
  }
});

test("with no rung listing stages, no pipeline or flow shows anywhere and the answers do", async ({ page }) => {
  const doc = payloads((d) => d.compare.rungs.forEach((r: any) => delete r.stages));
  await mockService(page, doc);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  for (const name of RUNGS) await column(demo, name).hover();
  await expect(demo.locator(".demo-stages, [aria-label=Pipeline], .demo-flow")).toHaveCount(0);
});

test("latency shows in seconds, to one decimal", async ({ page }) => {
  const doc = payloads((d) => {
    d.compare.rungs[0].latency_ms = 17303;
    d.compare.rungs[1].latency_ms = 3000;
    d.compare.rungs[2].latency_ms = 17360;
  });
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(column(demo, "closed_book").locator(".demo-latency")).toHaveText("Latency 17.3 s");
  await expect(column(demo, "bm25").locator(".demo-latency")).toHaveText("Latency 3.0 s");
  await expect(column(demo, "hybrid").locator(".demo-latency")).toHaveText("Latency 17.4 s");
});

// The prepared questions sit directly under the box, with no label and no
// control, and stay there with answers on screen. Focus stays on the one asked.
test("the prepared questions sit under the box with no label or control, and stay once answers arrive", async ({ page }) => {
  await mockService(page);
  const demo = await load(page);
  const ask = demo.locator(".demo-ask");
  await expect(ask.locator(":scope > *")).toHaveCount(3);
  await expect(ask.locator(".demo-row + ul.demo-prepared")).toHaveCount(1);
  await expect(ask.locator("details, summary, p, h3")).toHaveCount(0);
  const count = await prepared(demo).count();
  expect(count).toBeGreaterThan(0);
  await prepared(demo).first().focus();
  await page.keyboard.press("Enter");
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expect(prepared(demo)).toHaveCount(count);
  await expect(prepared(demo).first()).toBeVisible();
  await expect(prepared(demo).first()).toBeFocused();
});

const [A, B, C, D] = ["Synthetic Article A", "Synthetic Article B", "Synthetic Article C", "Synthetic Article No. 7"];

test("an article that supplies several passages is one row with its count, in the order it first ranked", async ({ page }) => {
  const doc = payloads((d) => {
    d.compare.rungs[3].passage_titles = [B, A, D, A, D, A, C];
  });
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(rows(column(demo, "full"))).toHaveText([
    `${B} ×1`,
    `${A} ×3`,
    `${D} ×2`,
    `${C} ×1`,
  ]);
});

// These two rankings read the same as rows, so only the control tells them apart.
test("the ranking behind the counts is one control away, where the repeats sit included", async ({ page }) => {
  const doc = payloads((d) => {
    d.compare.rungs[1].passage_titles = [A, B, A, C, D, A];
    d.compare.rungs[2].passage_titles = [A, A, A, B, C, D];
  });
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  for (const rung of doc.compare.rungs.slice(1, 3)) {
    const col = column(demo, rung.name);
    await expect(rows(col)).toHaveText([`${A} ×3`, `${B} ×1`, `${C} ×1`, `${D} ×1`]);
    await expect(rows(col)).not.toContainText(["rank"]);
    await expect(byRank(col)).toHaveText("By rank");
    const ranked = col.locator(".demo-ranks ol li");
    await expect(ranked.first()).toBeHidden();
    await byRank(col).click();
    await expect(ranked.first()).toBeVisible();
    await expect(ranked).toHaveText(rung.passage_titles);
  }
});

test("a rung with no passages leaves the list and its ranking out", async ({ page }) => {
  await mockService(page);
  const demo = await load(page);
  await prepared(demo).first().click();
  const col = column(demo, "closed_book");
  await expect(col.locator(".demo-answer")).toHaveCount(1);
  await expect(col.locator(".demo-passages, .demo-ranks, details")).toHaveCount(0);
});

test("a citation opens to its passage and its title, which links to the article", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  const rung = doc.compare.rungs[2];
  const col = column(demo, rung.name);
  for (const cite of rung.citations) {
    const panel = col.locator(".demo-cite").filter({ has: page.locator("summary", { hasText: `[${cite.marker}]` }) });
    await expect(panel).not.toHaveAttribute("open", "");
    await col.getByRole("button", { name: `[${cite.marker}]`, exact: true }).click();
    await expect(panel).toHaveAttribute("open", "");
    await expect(panel.locator(".demo-snippet")).toHaveText(cite.snippet);
    await expect(panel.getByRole("link", { name: cite.page_title })).toHaveAttribute("href", cite.url);
    await expect(panel.locator(".demo-support")).toHaveText(cite.supported ? "supported" : "unsupported");
  }
});

// Brief §5b: model output enters as text, links come only from a citation's
// url, and a [cN] marker attaches its citation and does nothing else.
test("model output stays text, and only citation urls become links", async ({ page }) => {
  const doc = payloads((d) => {
    const full = d.compare.rungs[3];
    full.answer = 'Markup <img src="/x.png"> and https://elsewhere.example/ stay text.[c1] So does [c9].';
    full.citations[0].snippet = "A snippet with <b>markup</b> stays text.";
    full.citations[0].page_title = "A title with <i>markup</i>";
    full.passage_titles.push("A title with <i>markup</i>", "A title with <i>markup</i>");
    d.compare.rungs[1].citations[0].url = "javascript:alert(1)";
  });
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  const full = column(demo, "full");
  await expect(full.locator(".demo-answer")).toHaveText(doc.compare.rungs[3].answer);
  await expect(full.getByRole("button", { name: "[c9]", exact: true })).toHaveCount(0);
  await full.getByRole("button", { name: "[c1]", exact: true }).click();
  await expect(full.locator(".demo-snippet")).toHaveText(doc.compare.rungs[3].citations[0].snippet);
  await expect(demo.locator("img, b, i")).toHaveCount(0);
  // A url that is not an https link to English Wikipedia shows as its title alone.
  await expect(column(demo, "bm25").locator(".demo-cite")).toContainText(doc.compare.rungs[1].citations[0].page_title);
  const wikipedia = doc.compare.rungs
    .flatMap((r: any) => r.citations.map((c: any) => c.url))
    .filter((u: string) => u.startsWith("https://en.wikipedia.org/"));
  // The demo writes no link of its own.
  const hrefs = await demo.locator("a").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  expect(hrefs.sort()).toEqual([...wikipedia].sort());
});

// ── The label and the service line ──────────────────────────────────────────

test("the demo writes its notes in full to the page's notes, keeps none of them, and sends nothing", async ({ page }) => {
  const { sent } = await mockService(page);
  const demo = await load(page);
  await expect(demo.locator(".demo-corpus")).toHaveCount(0);
  await expect(notes(demo).locator("p")).toHaveText([LIMITS_FULL, PRIVACY_FULL, "The attribution as the page ships it."]);
  for (const full of [LIMITS_FULL, PRIVACY_FULL]) await expect(demo).not.toContainText(full);
  await expect(demo.locator("details.demo-about, .demo-anecdote, .demo-limits")).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(sent).toEqual([]);
});

// Comparison answers carry no index version (deployed openapi.json), so the
// deployed one shows, beside the commit, both from /v1/health. Two long hex
// strings mean nothing to most visitors, so they go to the page's notes.
test("the deployed commit and index version go to the notes, and are the ones /v1/health reports", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await load(page);
  const service = notes(demo).locator(".demo-service");
  await expect(service).toBeHidden();
  await questionBox(demo).focus();
  await expect(service.locator("dd")).toHaveText([doc.health.git_sha, doc.health.index_version]);
  await expect(service).toBeVisible();
  await expect(service.locator("dt")).toHaveText(["Deployed commit", "Index version"]);
  await expect(demo.locator(".demo-service")).toHaveCount(0);
});

// ── Failure states ──────────────────────────────────────────────────────────
// Brief §5 and ADR-0001: the rate limit with its window when script can read
// it, a spent budget told apart by message, and one unavailable state for
// anything the page cannot reach or read. Bodies are the deployed
// openapi.json's envelope, with the messages HANDOFF.md records.

const envelope = (code: string, message: string) => ({ error: { code, message, request_id: "0".repeat(32) } });
const UNAVAILABLE = "The service is unavailable. Try again later.";
const status = (demo: Locator) => demo.locator(".demo-status");
// Whether an element shows to a sighted visitor: a status announced only is
// clipped to a pixel, which Playwright still counts as visible.
const shown = (target: Locator) =>
  target.evaluate((e) => {
    const box = e.getBoundingClientRect();
    return box.width > 1 && box.height > 1;
  });

const FAILURES: { name: string; reply: Reply; says: string }[] = [
  {
    name: "a 429 whose Retry-After script can read shows the window, to the second",
    reply: {
      status: 429,
      headers: { "retry-after": "3563", "access-control-expose-headers": "Retry-After" },
      json: envelope("rate_limited", "this client's hourly limit is reached"),
    },
    says: "The demo is rate-limited. Try again in 59 min 23 s.",
  },
  {
    name: "a 429 whose Retry-After script cannot read is a plain rate limit",
    reply: { status: 429, headers: { "retry-after": "3563" }, json: envelope("rate_limited", "this client's hourly limit is reached") },
    says: "The demo is rate-limited. Try again later.",
  },
  {
    name: "a 503 from the service's daily cap says the daily budget is spent",
    reply: { status: 503, json: envelope("budget_exhausted", "the service's daily spend cap is reached") },
    says: "The daily demo budget is spent.",
  },
  {
    name: "a 503 from the model provider's spend limit says so",
    reply: { status: 503, json: envelope("budget_exhausted", "the model provider's spend limit is reached") },
    says: "The model provider's spend limit is reached.",
  },
  {
    name: "a 503 spent budget with a message the page does not know falls back to a spent budget",
    reply: { status: 503, json: envelope("budget_exhausted", "a spend limit is reached") },
    says: "The demo's budget is spent.",
  },
  {
    name: "a 400 says the service refused the question",
    reply: { status: 400, json: envelope("invalid_request", "query: String should have at most 2000 characters") },
    says: "The service refused that question.",
  },
  {
    name: "a 500 says the service failed",
    reply: { status: 500, json: envelope("internal", "the service failed") },
    says: "The service failed on that question. Try again.",
  },
  {
    name: "an error page from outside the service is unavailable",
    reply: { status: 503, contentType: "text/html", body: "<html><body>Service Unavailable</body></html>" },
    says: UNAVAILABLE,
  },
  {
    name: "an error status whose body is not the envelope is unavailable",
    reply: { status: 500, json: { detail: "Internal Server Error" } },
    says: UNAVAILABLE,
  },
  {
    name: "a 200 outside the comparison's shape is unavailable",
    reply: { json: { rungs: [{ name: "full" }] } },
    says: UNAVAILABLE,
  },
  {
    name: "a 200 whose stages are outside their shape is unavailable",
    reply: { json: payloads((d) => (d.compare.rungs[3].stages = [{ name: "rewrite", runs: "yes" }])).compare },
    says: UNAVAILABLE,
  },
  // A CORS refusal reaches script as this same network error (Fetch standard).
  // A fulfilled route cannot stage one: Playwright's fulfilled responses skip
  // the browser's CORS check.
  { name: "a network failure is unavailable", reply: { abort: true }, says: UNAVAILABLE },
];

for (const { name, reply, says } of FAILURES) {
  test(name, async ({ page }) => {
    await mockService(page, payloads(), [], { "/v1/compare": reply });
    const demo = await openPage(page);
    await prepared(demo).first().click();
    await expect(status(demo)).toHaveText(says);
    expect(await shown(status(demo))).toBe(true);
    await expect(demo.locator(".demo-rung")).toHaveCount(0);
    // With no answers to read, the prepared questions stay open for another try.
    await expect(prepared(demo).first()).toBeVisible();
    await expectAttributionBack(demo);
  });
}

test("a comparison still out when the page stops waiting is unavailable", async ({ page }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await mockService(page, payloads(), ["/v1/compare"]);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(demo.locator(".demo-rung").filter({ hasText: "Waiting" })).toHaveCount(RUNGS.length);
  await page.clock.runFor(10 * 60 * 1000);
  await expect(status(demo)).toHaveText(UNAVAILABLE);
  await expect(demo.locator(".demo-rung")).toHaveCount(0);
});

// The shape seen live on 2026-11-01: the rung's error set and its answer null,
// beside three rungs that answered.
test("one rung failing shows its own error while the others return", async ({ page }) => {
  const doc = payloads((d) => {
    Object.assign(d.compare.rungs[2], {
      answer: null,
      citations: [],
      passage_titles: [],
      usage: { input_tokens: null, output_tokens: null, cost_usd: null },
      error: { code: "upstream_error", message: "the model provider failed", request_id: "1".repeat(32) },
    });
  });
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  const failed = column(demo, "hybrid");
  await expect(failed.locator(".demo-error")).toHaveText("Failed: the model provider failed");
  // HANDOFF.md: `stages` describes the rung, so a failed one lists the same.
  await expect(failed.locator(".demo-stages li")).toHaveText(stageText(doc.compare.rungs[2].stages));
  await expect(failed).toContainText(doc.compare.rungs[2].label);
  await expect(failed.locator(".demo-latency")).toHaveText(`Latency ${SECONDS.hybrid}`);
  await expect(failed.locator(".demo-answer")).toHaveCount(0);
  for (const name of ["closed_book", "bm25", "full"]) {
    await expect(column(demo, name).locator(".demo-answer")).toHaveCount(1);
  }
  await expect(status(demo)).toHaveText("Comparison returned.");
});

for (const [how, reply] of [
  ["fails", { status: 500, json: envelope("internal", "the service failed") }],
  ["cannot be reached", { abort: true }],
  ["answers outside its contract", { json: { ...payloads().meta, public_mode: "read_write" } }],
] as const) {
  test(`when /v1/meta ${how}, no question goes, and the next attempt asks again`, async ({ page }) => {
    const replies: Record<string, Reply> = { "/v1/meta": reply };
    const { sent } = await mockService(page, payloads(), [], replies);
    const demo = await load(page);
    await prepared(demo).first().click();
    await expect(status(demo)).toHaveText(UNAVAILABLE);
    expect(paths(sent)).not.toContain("/v1/compare");
    delete replies["/v1/meta"];
    await prepared(demo).first().click();
    await expect(answers(demo)).toHaveCount(RUNGS.length);
  });
}

test("when /v1/health fails, the comparison still goes and the service line stays hidden", async ({ page }) => {
  await mockService(page, payloads(), [], { "/v1/health": { status: 500, json: envelope("internal", "the service failed") } });
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expect(notes(demo).locator("p").first()).toBeVisible();
  await expect(notes(demo).locator(".demo-service")).toBeHidden();
});

// ── On the page ─────────────────────────────────────────────────────────────
// retrieval-service.html mounts the demo at #demoMount. The section ships
// hidden and the build opens it when RETRIEVAL_DEMO is on (vercel.json), so
// these unhide it as the build does.

const PAGE = "/retrieval-service.html";

async function openPage(page: Page, width = 1280, height = 900): Promise<Locator> {
  await page.setViewportSize({ width, height });
  await page.route("**/data/retrieval-service/results.json", (route) => route.fulfill({ status: 404 }));
  await page.goto(PAGE);
  await page.locator("#demo").evaluate((el) => el.removeAttribute("hidden"));
  return page.locator("#demo");
}

// The attribution speaks of the passages on screen, so the page's <style> holds
// it back until one shows. The closed notes under the results hold a copy,
// beside each of the demo's notes in full, throughout.

// The demo's text as a visitor can read it now: hidden lines and closed controls left out.
const readableText = (demo: Locator) =>
  demo.evaluate((section) => {
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    let text = "";
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement!.checkVisibility()) text += node.textContent;
    }
    return text;
  });

async function expectAttributionBack(demo: Locator) {
  await expect(demo.locator("#demoAttribution")).toBeHidden();
  const text = await readableText(demo);
  for (const words of [SHIPPED_ATTRIBUTION, payloads().meta.attribution]) expect(text).not.toContain(words);
}

// The attribution sits where the corpus text appears: directly under the rung
// columns, the last thing in the section.
async function expectAttribution(demo: Locator, attribution: string) {
  await expect(demo.locator("#demoAttribution")).toHaveText(attribution);
  expect(await readableText(demo)).toContain(attribution);
  await expectSectionOrder(demo.page(), [".demo-rungs", "#demoAttribution"]);
  await expect(demo.locator(":scope > *").last()).toHaveId("demoAttribution");
}

// The section keeps none of the notes: no short ones, no full ones, no control.
async function expectNoNotesInDemo(demo: Locator) {
  await expect(demo.locator(".demo-anecdote, .demo-limits, .demo-about, .demo-note, .demo-service")).toHaveCount(0);
  const text = await readableText(demo);
  for (const words of [LIMITS_FULL, PRIVACY_FULL, CORPUS_FULL, ANECDOTE_FULL]) expect(text).not.toContain(words);
}

// Each note in full, in the page's notes, on screen once they are opened and
// inside the viewport.
async function expectNotesHoldAll(demo: Locator, attribution: string) {
  await openNotes(demo.page());
  const held = notes(demo);
  for (const full of [CORPUS_FULL, ANECDOTE_FULL, LIMITS_FULL, PRIVACY_FULL, attribution]) {
    await expect(held.locator("p", { hasText: full })).toBeVisible();
  }
  const [right, width] = await held.evaluate((n) => [
    Math.max(...[...n.querySelectorAll("*")].map((e) => e.getBoundingClientRect().right)),
    window.innerWidth,
  ]);
  expect(right).toBeLessThanOrEqual(width);
}

// In either state the demo opens on the box, with no corpus line, nothing about
// privacy (the footer links the policy), and no status shown unless it failed.
async function expectNoProse(demo: Locator) {
  await expect(demo.locator(".demo-corpus")).toHaveCount(0);
  await expect(demo.locator("#demoMount > :first-child")).toHaveClass("demo-ask");
  expect(await readableText(demo)).not.toMatch(/privacy/i);
  expect(await shown(status(demo))).toBe(false);
}

for (const [width, height] of [[390, 844], [1280, 900]] as const) {
  test(`at ${width}px the idle demo holds the attribution back, and the notes hold each note in full`, async ({ page }) => {
    const { sent } = await mockService(page);
    const demo = await openPage(page, width, height);
    await expect(questionBox(demo)).toBeVisible();
    await expectNoProse(demo);
    await expectAttributionBack(demo);
    await expectNoNotesInDemo(demo);
    await expectNotesHoldAll(demo, SHIPPED_ATTRIBUTION);
    expect(sent).toEqual([]);
  });

  test(`at ${width}px a returned comparison with passages shows the attribution under them, and the notes still hold all`, async ({ page }) => {
    const doc = payloads();
    await mockService(page, doc);
    const demo = await openPage(page, width, height);
    await prepared(demo).first().click();
    await expect(answers(demo)).toHaveCount(RUNGS.length);
    await expectNoProse(demo);
    await expectAttribution(demo, doc.meta.attribution);
    await expectNoNotesInDemo(demo);
    await expectNotesHoldAll(demo, doc.meta.attribution);
  });
}

test("the attribution stays back once /v1/meta has answered and while a comparison is out", async ({ page }) => {
  const doc = payloads();
  const { release } = await mockService(page, doc, ["/v1/compare"]);
  const demo = await openPage(page);
  await questionBox(demo).focus();
  await expect(demo.locator("#demoAttribution")).toHaveText(doc.meta.attribution);
  await expectAttributionBack(demo);
  await prepared(demo).first().click();
  await expect(demo.locator(".demo-rung").filter({ hasText: "Waiting" })).toHaveCount(RUNGS.length);
  await expectAttributionBack(demo);
  release("/v1/compare");
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expectAttribution(demo, doc.meta.attribution);
});

// The next question clears the answers, so the attribution goes with them.
test("the next question takes the attribution back until it returns, and a failure leaves it back", async ({ page }) => {
  const doc = payloads();
  const replies: Record<string, Reply> = {};
  await mockService(page, doc, [], replies);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expectAttribution(demo, doc.meta.attribution);

  let answer = () => {};
  const held = new Promise<void>((resolve) => {
    answer = resolve;
  });
  await page.route(`${SERVICE}/v1/compare`, async (route) => {
    await held;
    await route.fallback();
  });
  await questionBox(demo).press("Enter");
  await expect(demo.locator(".demo-rung").filter({ hasText: "Waiting" })).toHaveCount(RUNGS.length);
  await expectAttributionBack(demo);
  answer();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expectAttribution(demo, doc.meta.attribution);

  replies["/v1/compare"] = { status: 500, json: envelope("internal", "the service failed") };
  await questionBox(demo).press("Enter");
  await expect(status(demo)).toHaveText("The service failed on that question. Try again.");
  await expect(demo.locator(".demo-rung")).toHaveCount(0);
  await expectAttributionBack(demo);
  await expectNotesHoldAll(demo, doc.meta.attribution);
});

// A rung that failed alone, in the shape seen live on 2026-11-01.
const failRung = (rung: any) =>
  Object.assign(rung, {
    answer: null,
    citations: [],
    passage_titles: [],
    usage: { input_tokens: null, output_tokens: null, cost_usd: null },
    error: { code: "upstream_error", message: "the model provider failed", request_id: "1".repeat(32) },
  });

// The attribution covers passages, so a returned comparison with none on screen
// holds it back, and one passage anywhere brings it: a retrieved title, a failed
// rung's included, or a citation.
const PASSAGE_CASES: { name: string; change: (doc: Payloads) => void; passages: number }[] = [
  { name: "every rung failed", change: (d) => d.compare.rungs.forEach(failRung), passages: 0 },
  {
    name: "every rung answered with no passage",
    change: (d) => d.compare.rungs.forEach((r: any) => Object.assign(r, { citations: [], passage_titles: [] })),
    passages: 0,
  },
  {
    name: "only a failed rung lists a retrieved passage",
    change: (d) => {
      d.compare.rungs.forEach(failRung);
      d.compare.rungs[1].passage_titles = ["Synthetic title"];
    },
    passages: 1,
  },
  {
    name: "only a citation shows a passage",
    change: (d) =>
      d.compare.rungs.forEach((r: any, i: number) => Object.assign(r, { passage_titles: [] }, i === 1 ? {} : { citations: [] })),
    passages: 1,
  },
];

for (const { name, change, passages } of PASSAGE_CASES) {
  test(`returned, ${name}: ${passages ? "the attribution shows" : "the attribution stays back"}`, async ({ page }) => {
    const doc = payloads(change);
    await mockService(page, doc);
    const demo = await openPage(page);
    await prepared(demo).first().click();
    await expect(status(demo)).toHaveText("Comparison returned.");
    await expect(demo.locator(".demo-passages, .demo-cite")).toHaveCount(passages);
    if (passages) await expectAttribution(demo, doc.meta.attribution);
    else await expectAttributionBack(demo);
    await expectNoNotesInDemo(demo);
    await expectNotesHoldAll(demo, doc.meta.attribution);
  });
}

// No script, so no comparison can ever return. The same holds for the moment
// before the script mounts the demo.
test.describe("with script off", () => {
  test.use({ javaScriptEnabled: false });
  test("the attribution stays back, and the notes keep the page's own two", async ({ page }) => {
    const demo = await openPage(page);
    await expect(demo.locator("#demoAttribution")).toBeHidden();
    await expect(notes(demo).locator("p")).toHaveText([CORPUS_FULL, ANECDOTE_FULL]);
    await openNotes(page);
    await expect(notes(demo).locator("p").first()).toBeVisible();
  });
});

test("the page mounts the demo and sends nothing to the service as it loads", async ({ page }) => {
  const { sent } = await mockService(page);
  const demo = await openPage(page);
  await expect(questionBox(demo)).toBeVisible();
  await page.waitForTimeout(500);
  expect(sent).toEqual([]);
});

// A chat box, centred under the sentence: a rounded field holding its send
// button, an arrow named Compare, with a placeholder showing and the label
// kept for screen readers.
for (const width of [390, 1280]) {
  test(`at ${width}px the question box is a rounded chat box, centred, its send button an arrow named Compare`, async ({ page }) => {
    await mockService(page);
    const demo = await openPage(page, width);
    await expect(questionBox(demo)).toHaveAttribute("placeholder", "Ask a question");
    expect(await shown(demo.locator('label[for="demoQuestion"]'))).toBe(false);
    const send = demo.getByRole("button", { name: "Compare", exact: true });
    await expect(send).toHaveText("↑");
    const row = demo.locator(".demo-row");
    const [field, button] = await Promise.all([box(row), box(send)]);
    const middle = await page.evaluate(() => document.documentElement.clientWidth / 2);
    expect(Math.abs((field.left + field.right) / 2 - middle)).toBeLessThanOrEqual(1);
    expect(await row.evaluate((r) => parseFloat(getComputedStyle(r).borderTopLeftRadius))).toBeGreaterThanOrEqual(16);
    expect(button.left).toBeGreaterThan(field.left);
    expect(button.right).toBeLessThanOrEqual(field.right);
    expect(button.top).toBeGreaterThanOrEqual(field.top);
    expect(button.bottom).toBeLessThanOrEqual(field.bottom);
  });
}

test("on the page, a comparison runs end to end and the live attribution replaces the page's", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await openPage(page);
  await expect(notes(demo).locator(".demo-service")).toBeHidden();
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expect(page.locator("#demoAttribution")).toHaveText(doc.meta.attribution);
  await openNotes(page);
  await expect(notes(demo).locator(".demo-service")).toBeVisible();
});

// The timer and the columns show the wait and the answers, so those statuses
// are announced to a screen reader and not shown; a failure is both. While a
// comparison is out, the seconds are the largest text in the demo.
test("waiting and returned are announced without showing, and a failure shows", async ({ page }) => {
  const replies: Record<string, Reply> = {};
  const { release } = await mockService(page, payloads(), ["/v1/compare"], replies);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(status(demo)).toHaveText("Waiting for the service.");
  expect(await shown(status(demo))).toBe(false);
  await expect(demo.locator(".demo-elapsed")).toBeVisible();
  await expect(demo).toHaveClass(/\bdemo-waiting\b/);
  const sizes = await demo.evaluate((section) => {
    const size = (e: Element) => parseFloat(getComputedStyle(e).fontSize);
    const texted = [...section.querySelectorAll("*")].filter(
      (e) => e.checkVisibility() && [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())
    );
    return { timer: size(section.querySelector("[role=timer]")!), others: texted.filter((e) => e.getAttribute("role") !== "timer").map(size) };
  });
  expect(sizes.timer).toBeGreaterThan(Math.max(...sizes.others));
  release("/v1/compare");
  await expect(status(demo)).toHaveText("Comparison returned.");
  expect(await shown(status(demo))).toBe(false);
  await expect(demo).not.toHaveClass(/\bdemo-waiting\b/);
  replies["/v1/compare"] = { status: 500, json: envelope("internal", "the service failed") };
  await questionBox(demo).press("Enter");
  await expect(status(demo)).toHaveText("The service failed on that question. Try again.");
  expect(await shown(status(demo))).toBe(true);
});

// Nothing is lost: with every control in the demo open, and the page's notes,
// what the reading path leaves out is on screen, the ranks as numbers included.
test("with every control open, everything the demo leaves out of the reading path shows", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  const service = notes(demo).locator(".demo-service dd");
  await expect(service.first()).toHaveText(doc.health.git_sha);
  await demo.locator("details:not([open]) > summary").evaluateAll((all) => all.forEach((s) => (s as HTMLElement).click()));
  await openNotes(page);

  for (const full of [LIMITS_FULL, PRIVACY_FULL, CORPUS_FULL, ANECDOTE_FULL, doc.meta.attribution]) {
    await expect(notes(demo).locator("p", { hasText: full })).toBeVisible();
  }
  await expect(service.nth(0)).toBeVisible();
  await expect(service.nth(1)).toHaveText(doc.health.index_version);
  await expect(prepared(demo).first()).toBeVisible();
  const bm25 = column(demo, "bm25");
  await expect(bm25.locator(".demo-snippet")).toBeVisible();
  const ranked = bm25.locator(".demo-ranks ol");
  await expect(ranked.locator("li")).toHaveText(doc.compare.rungs[1].passage_titles);
  expect(await ranked.evaluate((ol) => getComputedStyle(ol).listStyleType)).toBe("decimal");
  await expect(ranked.locator("li").first()).toBeVisible();
});

// Everything around an answer is smaller than the answer.
test("an answer is the largest text in its column", async ({ page }) => {
  await mockService(page);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  const { answer, others } = await column(demo, "full").evaluate((col) => {
    const size = (e: Element) => parseFloat(getComputedStyle(e).fontSize);
    const texted = [...col.querySelectorAll("*")].filter((e) =>
      [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())
    );
    return {
      answer: size(col.querySelector(".demo-answer")!),
      others: texted.filter((e) => !e.closest(".demo-answer")).map(size),
    };
  });
  expect(others.length).toBeGreaterThan(0);
  expect(answer).toBeGreaterThan(Math.max(...others));
});

// ADR-0001: four across, two below 860px, one below 640px.
for (const [width, across] of [[1280, 4], [800, 2], [375, 1]] as const) {
  test(`at ${width}px the rungs sit ${across} across`, async ({ page }) => {
    await mockService(page);
    const demo = await openPage(page, width);
    await prepared(demo).first().click();
    await expect(answers(demo)).toHaveCount(RUNGS.length);
    const tops = await demo.locator(".demo-rung").evaluateAll((cols) => cols.map((c) => c.getBoundingClientRect().top));
    expect(tops.filter((top) => top === tops[0])).toHaveLength(across);
  });
}

// Synthetic, with hard line breaks as live snippets have, and longer than any
// column shows at the cut.
const LONG_PASSAGE = Array.from({ length: 30 }, (_, i) => `Synthetic line ${i + 1} of a long passage.`).join("\n");

// The page's body clips horizontal overflow, so the check is each element's
// own right edge, never the page's scroll width.
test("at phone width nothing in the demo reaches past the viewport, long ids and a citation cut and opened included", async ({ page }) => {
  const long = "a".repeat(160);
  const doc = payloads((d) => {
    const full = d.compare.rungs[3];
    full.answer = `${long}.[c1]`;
    full.passage_titles.push(long, long);
    full.citations[0].page_title = long;
    full.citations[0].snippet = `${LONG_PASSAGE}\n${long}`;
    full.stages.push({ name: long, runs: false });
  });
  await mockService(page, doc);
  const demo = await openPage(page, 375);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  const col = column(demo, "full");
  await col.getByRole("button", { name: "[c1]", exact: true }).click();
  // The long stage is outside the page's shape, so this column draws no flow;
  // the next one's is drawn instead, at this width down the column.
  await expect(flow(demo)).toHaveCount(0);
  await column(demo, "hybrid").hover();
  await expect(flow(demo)).toBeVisible();
  const expectInside = async () => {
    const [right, width] = await demo.evaluate((mount) => [
      Math.max(...[...mount.querySelectorAll("*")].map((e) => e.getBoundingClientRect().right)),
      window.innerWidth,
    ]);
    expect(right).toBeLessThanOrEqual(width);
  };
  await expectInside();
  await col.getByRole("button", { name: "Show the rest" }).click();
  await expect(col.getByRole("button", { name: "Show less" })).toBeVisible();
  await expectInside();
  await byRank(col).click();
  await openNotes(page);
  await expect(notes(demo).locator(".demo-service dd").first()).toBeVisible();
  await expectInside();
});

// A snippet past eight rendered lines shows eight, and a button opens the rest.
// The cut is styling alone, so these run on the page, whose <style> holds it.
const snippetLines = (snippet: Locator) =>
  snippet.evaluate((p) => {
    const line = parseFloat(getComputedStyle(p).lineHeight);
    return {
      shown: Math.round(p.clientHeight / line),
      whole: Math.round(p.scrollHeight / line),
      text: p.textContent,
    };
  });

for (const [width, height] of [[390, 844], [1280, 900]] as const) {
  test(`at ${width}px a long passage shows eight lines and opens in full, with nothing altered`, async ({ page }) => {
    const doc = payloads((d) => {
      d.compare.rungs[3].citations[0].snippet = LONG_PASSAGE;
    });
    const cite = doc.compare.rungs[3].citations[0];
    await mockService(page, doc);
    const demo = await openPage(page, width, height);
    await prepared(demo).first().click();
    await expect(answers(demo)).toHaveCount(RUNGS.length);
    const col = column(demo, "full");
    await col.getByRole("button", { name: "[c1]", exact: true }).click();
    const panel = col.locator(".demo-cite");
    const snippet = panel.locator(".demo-snippet");
    const more = panel.getByRole("button", { name: "Show the rest" });

    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(more).toHaveAttribute("aria-controls", (await snippet.getAttribute("id"))!);
    const cut = await snippetLines(snippet);
    expect(cut.shown).toBe(8);
    expect(cut.whole).toBeGreaterThanOrEqual(30);
    expect(cut.text).toBe(LONG_PASSAGE);
    // Brief §3: wherever a passage shows, its title and link show.
    await expect(panel.locator("summary")).toContainText(cite.page_title);
    await expect(panel.locator(".demo-support")).toBeVisible();
    await expect(panel.getByRole("link", { name: cite.page_title })).toBeVisible();

    await more.click();
    const less = panel.getByRole("button", { name: "Show less" });
    await expect(less).toHaveAttribute("aria-expanded", "true");
    const opened = await snippetLines(snippet);
    expect(opened.shown).toBe(opened.whole);
    expect(opened.shown).toBeGreaterThanOrEqual(30);
    expect(opened.text).toBe(LONG_PASSAGE);

    await less.click();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    expect((await snippetLines(snippet)).shown).toBe(8);
  });
}

// Lines short enough never to wrap, so the rendered count is the written count.
for (const [written, shows] of [[8, 8], [9, 8]] as const) {
  test(`a passage of ${written} lines shows ${shows}, ${written > shows ? "with" : "with no"} button`, async ({ page }) => {
    const doc = payloads((d) => {
      d.compare.rungs[3].citations[0].snippet = Array.from({ length: written }, (_, i) => `Line ${i + 1}.`).join("\n");
    });
    await mockService(page, doc);
    const demo = await openPage(page);
    await prepared(demo).first().click();
    await expect(answers(demo)).toHaveCount(RUNGS.length);
    const col = column(demo, "full");
    await col.getByRole("button", { name: "[c1]", exact: true }).click();
    const snippet = col.locator(".demo-snippet");
    await expect(snippet).toBeVisible();
    const more = col.locator(".demo-more");
    if (written > shows) await expect(more).toBeVisible();
    else await expect(more).toBeHidden();
    expect(await snippetLines(snippet)).toMatchObject({ shown: shows, whole: written });
  });
}

// Unbroken by hard line breaks, so it overflows eight lines of a quarter-width
// column and fits eight of a full-width one.
test("whether a passage is cut follows its column's width", async ({ page }) => {
  const doc = payloads((d) => {
    d.compare.rungs[3].citations[0].snippet = "Synthetic passage word ".repeat(18).trim();
  });
  await mockService(page, doc);
  const demo = await openPage(page, 1280);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  const col = column(demo, "full");
  await col.getByRole("button", { name: "[c1]", exact: true }).click();
  const more = col.getByRole("button", { name: "Show the rest" });
  await expect(more).toBeVisible();
  await page.setViewportSize({ width: 600, height: 900 });
  await expect(more).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(more).toBeVisible();
});

test("the same long passage in three columns opens in one without opening the others", async ({ page }) => {
  const doc = payloads((d) => {
    for (const rung of d.compare.rungs.slice(1)) rung.citations[0].snippet = LONG_PASSAGE;
  });
  await mockService(page, doc);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  for (const name of ["bm25", "hybrid", "full"]) {
    await column(demo, name).getByRole("button", { name: "[c1]", exact: true }).click();
  }
  await column(demo, "hybrid").getByRole("button", { name: "Show the rest" }).click();
  await expect(column(demo, "hybrid").getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  for (const name of ["bm25", "full"]) {
    await expect(column(demo, name).getByRole("button", { name: "Show the rest" })).toHaveAttribute("aria-expanded", "false");
    expect((await snippetLines(column(demo, name).locator(".demo-snippet"))).shown).toBe(8);
  }
});

// The answers are the argument: before any scrolling a visitor sees the question
// box and whole answers, with labels and answers as long as live ones. All four
// across a laptop's first screen; on a phone one whole, and the next begun.
for (const [width, height, whole] of [[390, 844, 1], [1280, 720, 4]] as const) {
  test(`at ${width}x${height} the question box and ${whole} whole answers show without scrolling`, async ({ page }) => {
    const doc = payloads((d) => {
      for (const rung of d.compare.rungs) {
        rung.label = "Synthetic short part: the rest of a sentence as long as a live one, which says how the rung searches.";
        rung.answer =
          "A synthetic answer as long as a live one: it names a work, its catalogue number, " +
          "its nickname, the year it was published and its dedicatee.";
      }
    });
    await mockService(page, doc);
    const demo = await openPage(page, width, height);
    await prepared(demo).first().click();
    await expect(answers(demo)).toHaveCount(RUNGS.length);
    const seen = await page.evaluate(() => ({
      scrolled: window.scrollY,
      nav: document.querySelector("nav")!.getBoundingClientRect().bottom,
      box: document.getElementById("demoQuestion")!.getBoundingClientRect().top,
      answers: [...document.querySelectorAll(".demo-answer")].map((a) => a.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom })),
      height: window.innerHeight,
    }));
    expect(seen.scrolled).toBe(0);
    expect(seen.box).toBeGreaterThanOrEqual(seen.nav);
    for (const answer of seen.answers.slice(0, whole)) expect(answer.bottom).toBeLessThanOrEqual(seen.height);
    if (whole < seen.answers.length) expect(seen.answers[whole].top).toBeLessThan(seen.height);
  });
}

// Headings step down one level at a time: the page's h1, each rung's h2 and
// its passages' h3, then the sections below.
test("on the page, no heading skips a level, the rung columns' included", async ({ page }) => {
  await mockService(page);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  const levels = await page
    .locator("main :is(h1, h2, h3, h4, h5, h6)")
    .evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
  expect(levels[0]).toBe(1);
  const skips = levels.flatMap((level, i) => (i && level > levels[i - 1] + 1 ? [`h${levels[i - 1]} to h${level}`] : []));
  expect(skips).toEqual([]);
});
