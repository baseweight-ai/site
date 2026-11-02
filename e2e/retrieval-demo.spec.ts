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
const LABEL = "Read-only. Comparisons are rate-limited, and the demo has a daily budget.";
const PRIVACY = "Your question and IP address go to our service, which passes the question to its providers. Privacy policy";

type Payloads = { meta: any; health: any; compare: any };

// The fixture with one change applied.
function payloads(change?: (doc: Payloads) => void): Payloads {
  const doc = JSON.parse(FIXTURE);
  change?.(doc);
  return doc;
}

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
  await page.setContent('<p id="attribution">The attribution as the page ships it.</p><div id="mount"></div>');
  await page.addScriptTag({ path: COMPONENT });
  await page.evaluate(() =>
    (window as any).mountDemo(document.getElementById("mount"), document.getElementById("attribution"))
  );
  return page.locator("#mount");
}

const questionBox = (demo: Locator) => demo.getByRole("textbox", { name: "Question", exact: true });
const prepared = (demo: Locator) =>
  demo.getByRole("list", { name: "Prepared questions" }).getByRole("button");
const column = (demo: Locator, name: string) =>
  demo.locator(".demo-rung").filter({ has: demo.page().getByRole("heading", { name, exact: true }) });
const answers = (demo: Locator) => demo.locator(".demo-answer");

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
// A comparison comes back whole, so every rung stays outstanding until it
// does, and the only progress shown is the time elapsed.

test("while a comparison is out, every rung is outstanding and the elapsed time counts", async ({ page }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  const { release } = await mockService(page, payloads(), ["/v1/compare"]);
  const demo = await load(page);
  await prepared(demo).first().click();
  const rungs = demo.locator(".demo-rung");
  await expect(rungs.getByRole("heading")).toHaveText(RUNGS);
  await expect(rungs.filter({ hasText: "Outstanding" })).toHaveCount(RUNGS.length);
  const timer = demo.getByRole("timer");
  await expect(timer).toHaveText("0 s");
  await page.clock.runFor(3000);
  await expect(timer).toHaveText("3 s");
  await expect(demo.locator("progress, [role=progressbar]")).toHaveCount(0);
  release("/v1/compare");
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expect(demo.getByText("Outstanding")).toHaveCount(0);
  await expect(timer).toHaveText("3 s");
});

// ── The result ──────────────────────────────────────────────────────────────

test("each rung answers in its own column, with its label, answer, passages and latency", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(demo.locator(".demo-rung h2")).toHaveText(doc.compare.rungs.map((r: any) => r.name));
  for (const rung of doc.compare.rungs) {
    const col = column(demo, rung.name);
    await expect(col).toContainText(rung.label);
    await expect(col.locator(".demo-answer")).toHaveText(rung.answer);
    // Every title the rung retrieved, in its order, repeats included.
    await expect(col.locator(".demo-passages li")).toHaveText(rung.passage_titles);
    await expect(col).toContainText(`${rung.latency_ms} ms`);
  }
});

test("a citation opens to its passage and its title, which links to the article", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await load(page);
  await prepared(demo).first().click();
  const rung = doc.compare.rungs[2];
  const col = column(demo, rung.name);
  for (const cite of rung.citations) {
    const panel = col.locator("details").filter({ has: page.locator("summary", { hasText: `[${cite.marker}]` }) });
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
  await expect(column(demo, "bm25").locator("details")).toContainText(doc.compare.rungs[1].citations[0].page_title);
  const wikipedia = doc.compare.rungs
    .flatMap((r: any) => r.citations.map((c: any) => c.url))
    .filter((u: string) => u.startsWith("https://en.wikipedia.org/"));
  // The one link the demo writes itself is the privacy policy's.
  const hrefs = await demo.locator("a").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  expect(hrefs.sort()).toEqual([...wikipedia, "/privacy"].sort());
});

// ── The label and the service line ──────────────────────────────────────────

test("the demo says it is read-only and limited before anything is sent", async ({ page }) => {
  const { sent } = await mockService(page);
  const demo = await load(page);
  await expect(demo).toContainText(LABEL);
  expect(sent).toEqual([]);
});

// privacy.html names the providers and says what the service keeps.
test("under the question box, the demo says what leaves the browser and links the privacy policy", async ({ page }) => {
  const { sent } = await mockService(page);
  const demo = await load(page);
  const line = demo.locator(".demo-row + p");
  await expect(line).toHaveText(PRIVACY);
  await expect(line.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
  expect(sent).toEqual([]);
});

// Comparison answers carry no index version (deployed openapi.json), so the
// deployed one shows, beside the commit, both from /v1/health.
test("the deployed commit and index version are the ones /v1/health reports", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await load(page);
  await questionBox(demo).focus();
  await expect(demo.locator(".demo-service dt")).toHaveText(["Deployed commit", "Index version"]);
  await expect(demo.locator(".demo-service dd")).toHaveText([doc.health.git_sha, doc.health.index_version]);
});

// ── Failure states ──────────────────────────────────────────────────────────
// Brief §5 and ADR-0001: the rate limit with its window when script can read
// it, a spent budget told apart by message, and one unavailable state for
// anything the page cannot reach or read. Bodies are the deployed
// openapi.json's envelope, with the messages HANDOFF.md records.

const envelope = (code: string, message: string) => ({ error: { code, message, request_id: "0".repeat(32) } });
const UNAVAILABLE = "The service is unavailable. Try again later.";
const status = (demo: Locator) => demo.locator(".demo-status");

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
  // A CORS refusal reaches script as this same network error (Fetch standard).
  // A fulfilled route cannot stage one: Playwright's fulfilled responses skip
  // the browser's CORS check.
  { name: "a network failure is unavailable", reply: { abort: true }, says: UNAVAILABLE },
];

for (const { name, reply, says } of FAILURES) {
  test(name, async ({ page }) => {
    await mockService(page, payloads(), [], { "/v1/compare": reply });
    const demo = await load(page);
    await prepared(demo).first().click();
    await expect(status(demo)).toHaveText(says);
    await expect(demo.locator(".demo-rung")).toHaveCount(0);
  });
}

test("a comparison still out when the page stops waiting is unavailable", async ({ page }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await mockService(page, payloads(), ["/v1/compare"]);
  const demo = await load(page);
  await prepared(demo).first().click();
  await expect(demo.locator(".demo-rung").filter({ hasText: "Outstanding" })).toHaveCount(RUNGS.length);
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
  await expect(failed).toContainText(doc.compare.rungs[2].label);
  await expect(failed).toContainText(`${doc.compare.rungs[2].latency_ms} ms`);
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
  await expect(demo.locator(".demo-service")).toBeHidden();
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
  return page.locator("#demoMount");
}

test("the page mounts the demo and sends nothing to the service as it loads", async ({ page }) => {
  const { sent } = await mockService(page);
  const demo = await openPage(page);
  await expect(questionBox(demo)).toBeVisible();
  await page.waitForTimeout(500);
  expect(sent).toEqual([]);
});

test("on the page, a comparison runs end to end and the live attribution replaces the page's", async ({ page }) => {
  const doc = payloads();
  await mockService(page, doc);
  const demo = await openPage(page);
  await expect(demo.locator(".demo-service")).toBeHidden();
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expect(page.locator("#demoAttribution")).toHaveText(doc.meta.attribution);
  await expect(demo.locator(".demo-service")).toBeVisible();
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

// The page's body clips horizontal overflow, so the check is each element's
// own right edge, never the page's scroll width.
test("at phone width nothing in the demo reaches past the viewport, long ids and an open citation included", async ({ page }) => {
  const long = "a".repeat(160);
  const doc = payloads((d) => {
    const full = d.compare.rungs[3];
    full.answer = `${long}.[c1]`;
    full.passage_titles.push(long);
    full.citations[0].page_title = long;
    full.citations[0].snippet += `\n${long}`;
  });
  await mockService(page, doc);
  const demo = await openPage(page, 375);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await column(demo, "full").getByRole("button", { name: "[c1]", exact: true }).click();
  const [right, width] = await demo.evaluate((mount) => [
    Math.max(...[...mount.querySelectorAll("*")].map((e) => e.getBoundingClientRect().right)),
    window.innerWidth,
  ]);
  expect(right).toBeLessThanOrEqual(width);
});

// The demo is the page: before any scrolling a visitor sees the question box
// and at least one whole answer, with labels and answers as long as live ones.
for (const [width, height] of [[390, 844], [1280, 720]] as const) {
  test(`at ${width}x${height} the question box and an answer show without scrolling`, async ({ page }) => {
    const doc = payloads((d) => {
      for (const rung of d.compare.rungs) {
        rung.label = "A synthetic label as long as a live one, which says what the rung searches and how.";
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
      answer: document.querySelector(".demo-answer")!.getBoundingClientRect().bottom,
      height: window.innerHeight,
    }));
    expect(seen.scrolled).toBe(0);
    expect(seen.box).toBeGreaterThanOrEqual(seen.nav);
    expect(seen.answer).toBeLessThanOrEqual(seen.height);
  });
}

// The attribution sits where the corpus text appears: under the rung columns,
// before the service line and the notes.
test("on the page, the attribution sits directly under the rung columns", async ({ page }) => {
  await mockService(page);
  const demo = await openPage(page);
  await prepared(demo).first().click();
  await expect(answers(demo)).toHaveCount(RUNGS.length);
  await expect(demo.locator(".demo-service")).toBeVisible();
  await expectSectionOrder(page, [".demo-rungs", "#demoAttribution", ".demo-service", "#demo .demo-note"]);
});

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
