/**
 * Cross-cutting site tests: nav, footer, CTAs, page titles.
 * These enforce the invariants documented in CLAUDE.md:
 *   - Footer is identical on every page
 *   - All CTA buttons say "Book a call" and link to cal.com
 *   - Nav is rendered on every page
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { CAL_URL, SITE_ROOT, sitePages } from "./copy-text";

// Titles are decisions, so they stay written down. The page list is not: it
// comes from disk, so a new page gets nav, footer, title and CTA coverage on
// arrival instead of silently escaping this file.
const TITLES: Record<string, RegExp> = {
  "index.html": /Baseweight/,
  "about.html": /About/,
  "fine-tuning.html": /^Fine-tuning:/,
  "methodology.html": /How it.s tested/i,
  "retrieval.html": /^Retrieval \|/,
  "privacy.html": /Privacy/,
};

const PAGES = sitePages().map((page) => ({ path: `/${page}`, title: TITLES[page] }));

test("every page has an expected title", () => {
  const missing = sitePages().filter((p) => !TITLES[p]);
  expect(missing, `Pages without a title expectation: ${missing.join(", ")}`).toEqual([]);
});

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

// Home, Examples, About, then the Book a call button. Examples goes to the
// homepage section that links each example's page.
// Contact was removed with its page on 2026-09-20.
test("nav carries exactly Home, Examples, About and the call button", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("nav#nav a").first()).toBeVisible();
  const nav = page.locator("nav#nav");
  await expect(nav.locator("li a:not(.nav-cta)")).toHaveText(["Home", "Examples", "About"]);
  await expect(nav.getByRole("link", { name: "Examples", exact: true })).toHaveAttribute(
    "href",
    "/#published"
  );
  await expect(page.locator("#published")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: /Contact/i })).toHaveCount(0);
  await expect(nav.locator("a.nav-cta")).toHaveAttribute("href", CAL_URL);
});

// ── Footer ────────────────────────────────────────────────────────────────────

for (const { path } of PAGES) {
  test(`${path} renders footer with copyright`, async ({ page }) => {
    await page.goto(path);
    const footer = page.locator("footer");
    await expect(footer).toContainText("Baseweight");
    await expect(footer.getByRole("link", { name: /Privacy Policy/i })).toBeVisible();
    // The contact page is gone; the email address is the route in its place.
    await expect(footer.getByRole("link", { name: "hello@baseweight.co" })).toHaveAttribute(
      "href",
      "mailto:hello@baseweight.co"
    );
    // The footer carries no last-updated date.
    await expect(footer).not.toContainText("Updated");
  });
}

// ── CTA buttons ───────────────────────────────────────────────────────────────

const CTA_PAGES = PAGES.filter(p => !p.path.includes("privacy"));

for (const { path } of CTA_PAGES) {
  test(`${path} CTA buttons say "Book a call" and link to cal.com`, async ({ page }) => {
    await page.goto(path);
    const ctas = page.getByRole("link", { name: /Book a call/i });
    await expect(ctas.first()).toBeVisible();
    const count = await ctas.count();
    for (let i = 0; i < count; i++) {
      const href = await ctas.nth(i).getAttribute("href");
      expect(href).toBe(CAL_URL);
    }
  });
}

// ── No broken nav active state ────────────────────────────────────────────────

// Examples is current on the example pages, Fine-tuning's method page included. Its
// link goes to the homepage section, not to the page itself, so it is current "true"
// rather than "page".
test("Examples is the highlighted nav link on each example page", async ({ page }) => {
  const nav = page.locator("nav#nav");
  const color = (name: string) =>
    nav.getByRole("link", { name, exact: true }).evaluate((el) => getComputedStyle(el).color);
  for (const path of ["/fine-tuning.html", "/methodology.html", "/retrieval.html"]) {
    await page.goto(path);
    const current = nav.locator("a[aria-current]");
    await expect(current, path).toHaveCount(1);
    await expect(current, path).toHaveText("Examples");
    await expect(current, path).toHaveAttribute("aria-current", "true");
    expect(await color("Examples"), path).not.toBe(await color("About"));
  }
});

// ── Capture path ────────────────────────────────────────────────────────────
// There is none. The notify opt-in was removed from /about on 2026-09-20, so no
// page posts anything anywhere; the routes are the call and the email address.
// Derived from disk so a new page is covered on arrival.

for (const page of sitePages()) {
  test(`${page} carries no form`, () => {
    const html = fs.readFileSync(path.join(SITE_ROOT, page), "utf-8");
    expect(html, `${page} must not carry a form`).not.toMatch(/<form\b/i);
    expect(html, `${page} must not carry an email input`).not.toMatch(/type="email"/i);
  });
}

// ── Founder ─────────────────────────────────────────────────────────────────
// The one outbound identity link on the site, inside the Person markup so the
// name it carries is still the schema value.

test("the founder name links to the profile, inside its Person markup", async ({ page }) => {
  await page.goto("/about.html");
  const link = page.locator('[itemprop="name"] a.founder-link');
  await expect(link).toHaveText("Philip Stevens");
  await expect(link).toHaveAttribute("href", "https://www.linkedin.com/in/philipcstevens/");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const person = page.locator('[itemprop="founder"][itemtype="https://schema.org/Person"]');
  await expect(person).toHaveCount(1);
  await expect(person.locator('[itemprop="name"]')).toHaveText("Philip Stevens");
});

// ── Redirects ───────────────────────────────────────────────────────────────
// Vercel serves these in production; the dev static server cannot, so the
// config itself is what gets asserted. serve.json mirrors it for `npx serve`.

// Every page a visitor should be able to find, and nothing that redirects.
test("the sitemap lists the live pages", () => {
  const xml = fs.readFileSync(path.join(SITE_ROOT, "sitemap.xml"), "utf-8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.sort()).toEqual(
    [
      "https://baseweight.co/",
      "https://baseweight.co/about",
      "https://baseweight.co/fine-tuning",
      "https://baseweight.co/methodology",
      "https://baseweight.co/privacy",
      "https://baseweight.co/retrieval",
    ].sort()
  );
  // A redirected or noindexed path in the sitemap is a crawl error. Derived, so
  // adding a redirect or lifting a noindex needs no edit here.
  const vercel = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "vercel.json"), "utf-8"));
  const forbidden = new Set<string>(
    (vercel.redirects as { source: string }[]).map((r) => `https://baseweight.co${r.source}`)
  );
  for (const page of sitePages()) {
    const html = fs.readFileSync(path.join(SITE_ROOT, page), "utf-8");
    if (/<meta name="robots"[^>]*noindex/i.test(html)) {
      forbidden.add(`https://baseweight.co/${page.replace(/\.html$/, "")}`);
    }
  }
  for (const loc of locs) {
    expect(forbidden.has(loc), `${loc} redirects or is noindexed, so it cannot be in the sitemap`).toBe(false);
  }
});

type Redirect = { source: string; destination: string; permanent?: boolean };
const redirectMap = (rules: Redirect[]) =>
  Object.fromEntries(rules.map((r) => [r.source, r.destination]));

// vercel.json is the source of truth; serve.json exists only because `npx serve`
// cannot read it. Comparing the two to each other catches a rule added to one
// and forgotten in the other, which comparing each to a third list did not.
test("serve.json mirrors vercel.json, and every redirect is a 301", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "vercel.json"), "utf-8"));
  const serve = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "serve.json"), "utf-8"));
  expect(redirectMap(serve.redirects)).toEqual(redirectMap(vercel.redirects));
  for (const rule of vercel.redirects as Redirect[]) {
    expect(rule.permanent, `${rule.source} must be a 301`).toBe(true);
  }
});

// These paths were retired and must stay retired, wherever they point.
test("retired paths still redirect", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "vercel.json"), "utf-8"));
  const map = redirectMap(vercel.redirects);
  for (const source of ["/benchmark", "/retrieval-service", "/head-to-head", "/contact", "/pilot", "/scope", "/fit-score", "/diagnostic"]) {
    expect(map[source], `${source} must redirect`).toBeTruthy();
  }
  expect(map["/benchmark"]).toBe("/fine-tuning");
  expect(map["/head-to-head"]).toBe("/fine-tuning");
  expect(map["/retrieval-service"]).toBe("/retrieval");
  expect(map["/contact"]).toBe("/#cta");
});

// ── Content-Security-Policy ─────────────────────────────────────────────────
// Vercel sends the policy in production and the dev static server sends none,
// so it is read from vercel.json. The Retrieval page calls the service from the
// browser (INTEGRATION-BRIEF.md §5), so connect-src names the service's origin.

const SERVICE_ORIGIN = "https://baseweight-service.fly.dev";

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

function sitePolicy(): string {
  const vercel = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "vercel.json"), "utf-8"));
  const site = (vercel.headers as HeaderRule[]).find((r) => r.source === "/(.*)")!;
  return site.headers.find((h) => h.key === "Content-Security-Policy")!.value;
}

test("the site policy opens connect-src to the service's origin and nothing else", () => {
  const directives = sitePolicy().split(";").map((d) => d.trim().split(/\s+/));
  const connect = directives.find(([name]) => name === "connect-src")!;
  expect(connect.slice(1)).toEqual([
    "'self'",
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    SERVICE_ORIGIN,
  ]);
  const others = directives.filter(([name]) => name !== "connect-src").flat();
  expect(others, "the service's origin belongs in connect-src only").not.toContain(SERVICE_ORIGIN);
});

// The browser is what enforces the policy, so a browser is asked. Both origins
// are stubbed: a call the policy lets out is answered here, and the suite
// spends none of the service's hourly allowance.
test("the site policy lets page script call the service and refuses other origins", async ({ page }) => {
  await page.route("**/retrieval.html", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": sitePolicy() },
    });
  });
  const elsewhere = "https://elsewhere.fly.dev";
  for (const origin of [SERVICE_ORIGIN, elsewhere]) {
    await page.route(`${origin}/**`, (route) =>
      route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: {} })
    );
  }
  await page.goto("/retrieval.html");
  const outcome = await page.evaluate(async ([allowed, refused]) => {
    const violation = new Promise((resolve) =>
      document.addEventListener("securitypolicyviolation", (e) => resolve(e.effectiveDirective))
    );
    const call = (url: string) => fetch(url).then((r) => r.status, () => "refused");
    const statuses = [await call(allowed), await call(refused)];
    const none = new Promise((resolve) => setTimeout(() => resolve("none"), 2000));
    return { statuses, violated: await Promise.race([violation, none]) };
  }, [`${SERVICE_ORIGIN}/v1/health`, `${elsewhere}/v1/health`]);
  expect(outcome).toEqual({ statuses: [200, "refused"], violated: "connect-src" });
});

// The Retrieval page's own rule (brief §5b): the site policy repeated, with
// img-src narrowed to this site and the service, so a rendering mistake still
// loads no image from elsewhere. Repeated whole, it covers the page whether
// Vercel sends both policies or only the page's, and it comes after the site
// rule, so it is the last rule that matches the page.
test("the Retrieval page's policy is the site policy with img-src narrowed to the site and the service", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "vercel.json"), "utf-8"));
  const rules = vercel.headers as HeaderRule[];
  const pages = rules.filter((r) => r.source === "/retrieval");
  expect(pages).toHaveLength(1);
  expect(rules.indexOf(pages[0])).toBeGreaterThan(rules.findIndex((r) => r.source === "/(.*)"));
  expect(pages[0].headers).toEqual([
    {
      key: "Content-Security-Policy",
      value: sitePolicy().replace(/img-src [^;]*/, `img-src 'self' ${SERVICE_ORIGIN}`),
    },
  ]);
  expect(sitePolicy(), "every other page keeps its images").toContain("img-src 'self' data: https:");
});

// ── Waking the service ──────────────────────────────────────────────────────
// components.js wakes the retrieval service so the demo answers sooner: one
// GET /v1/health per visit, after load, never read and never shown. Automated
// browsers skip it, so these tests present the page as a visitor's to watch it.

const AS_VISITOR = () => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });

test("a visit wakes the service once, and a wake held open never holds up the page", async ({ page }) => {
  await page.addInitScript(AS_VISITOR);
  const wakes: string[] = [];
  // Never answered, as during a cold start.
  await page.route(`${SERVICE_ORIGIN}/**`, (route) => {
    wakes.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
  });
  await page.goto("/index.html");
  await expect(page.locator("nav#nav a").first()).toBeVisible();
  await expect.poll(() => wakes).toEqual(["GET /v1/health"]);
  for (const next of ["/about.html", "/fine-tuning.html", "/retrieval.html"]) {
    await page.goto(next);
    await expect(page.locator("nav#nav a").first()).toBeVisible();
  }
  await page.waitForTimeout(500);
  expect(wakes, "one wake per visit, however many pages").toEqual(["GET /v1/health"]);
});

test("with the service down, the wake shows nothing and throws nothing", async ({ page }) => {
  await page.addInitScript(AS_VISITOR);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  let woke = false;
  await page.route(`${SERVICE_ORIGIN}/**`, (route) => {
    woke = true;
    return route.abort("connectionrefused");
  });
  await page.goto("/index.html");
  const before = await page.locator("body").innerHTML();
  await expect.poll(() => woke).toBe(true);
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
  expect(await page.locator("body").innerHTML()).toBe(before);
});

test("automated browsers leave the service asleep", async ({ page }) => {
  let woke = false;
  await page.route(`${SERVICE_ORIGIN}/**`, (route) => {
    woke = true;
    return route.abort();
  });
  await page.goto("/index.html");
  await page.waitForTimeout(500);
  expect(woke).toBe(false);
});

// ── The build ───────────────────────────────────────────────────────────────
// build.mjs fails the deploy on a malformed results snapshot. The build command
// runs as vercel.json gives it, in a copy of what it reads, so the tree is not
// written.

function runBuild(snapshot?: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-build-"));
  try {
    fs.mkdirSync(path.join(dir, "e2e"));
    for (const file of ["build.mjs", "e2e/retrieval-service-schema.ts"]) {
      fs.copyFileSync(path.join(SITE_ROOT, file), path.join(dir, file));
    }
    if (snapshot !== undefined) {
      fs.mkdirSync(path.join(dir, "data/retrieval-service"), { recursive: true });
      fs.writeFileSync(path.join(dir, "data/retrieval-service/results.json"), snapshot);
    }
    const vercel = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "vercel.json"), "utf-8"));
    const run = spawnSync(vercel.buildCommand, { cwd: dir, shell: true, encoding: "utf-8" });
    return { status: run.status, stderr: run.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("the build passes without a snapshot and fails on a malformed one", () => {
  const clean = runBuild();
  expect(clean.status, clean.stderr).toBe(0);
  const built = runBuild("{}");
  expect(built.status).not.toBe(0);
  expect(built.stderr).toContain("results snapshot fails its schema");
});

test("the build command fits the 256 characters Vercel allows it", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "vercel.json"), "utf-8"));
  expect(vercel.buildCommand.length).toBeLessThanOrEqual(256);
});

// ── What deploys ────────────────────────────────────────────────────────────
// The build output is the repo root, so every tracked file .vercelignore lets
// through is public. Through go the pages, what they load, what the build
// reads and the crawler files; every other tracked file stays off. Patterns are
// read by git's own matcher: .vercelignore takes .gitignore's syntax.

const BUILD_READS = ["vercel.json", "build.mjs", "e2e/retrieval-service-schema.ts", "data/retrieval-service/results.json"];
const FOR_CRAWLERS = ["robots.txt", "sitemap.xml"];
// A same-site path a page or script names in quotes, origin optional.
const NAMED = /["'`](?:https:\/\/(?:www\.)?baseweight\.co)?(\/[\w./-]+\.\w{2,5})["'`]/g;

const trackedFiles = () =>
  spawnSync("git", ["ls-files"], { cwd: SITE_ROOT, encoding: "utf-8" }).stdout.split("\n").filter(Boolean);

function keptOffDeploy(paths: string[]): Set<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vercelignore-"));
  try {
    spawnSync("git", ["init", "-q"], { cwd: dir });
    fs.copyFileSync(path.join(SITE_ROOT, ".vercelignore"), path.join(dir, ".gitignore"));
    const run = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], { cwd: dir, input: paths.join("\n"), encoding: "utf-8" });
    return new Set(run.stdout.split("\n").filter(Boolean));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// The file that serves a site path; a clean URL is its page.
function fileFor(urlPath: string): string {
  const file = decodeURIComponent(urlPath).replace(/^\//, "");
  if (!file) return "index.html";
  return path.extname(file) ? file : `${file}.html`;
}

test("the deploy carries the pages, what they load and what the build reads, and no other tracked file", async ({ page, baseURL }) => {
  const tracked = trackedFiles();
  const pages = tracked.filter((f) => !f.includes("/") && f.endsWith(".html"));
  const needed = new Set([...pages, ...BUILD_READS, ...FOR_CRAWLERS]);
  const origin = new URL(baseURL!).origin;
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.origin === origin) needed.add(fileFor(url.pathname));
  });
  for (const file of pages) {
    await page.goto(`/${file}`);
    await page.waitForLoadState("networkidle");
  }
  // What a browser does not request on load: icons, social images, later fetches.
  const sources = [...needed].filter((f) => /\.(html|js|css)$/.test(f) && fs.existsSync(path.join(SITE_ROOT, f)));
  for (const source of sources) {
    for (const m of fs.readFileSync(path.join(SITE_ROOT, source), "utf-8").matchAll(NAMED)) needed.add(fileFor(m[1]));
  }
  // Vercel serves its own /_vercel/ paths.
  for (const file of needed) if (file.startsWith("_vercel/")) needed.delete(file);

  const off = keptOffDeploy([...new Set([...tracked, ...needed])]);
  expect([...needed].filter((f) => off.has(f)), "needed by a page or the build, but kept off the deploy").toEqual([]);
  expect(tracked.filter((f) => !needed.has(f) && !off.has(f)), "needed by nothing, but deployed and public").toEqual([]);
  for (const file of ["COPY-STYLE.md", "data/benchmark/hs-benchmark-spec.md", "data/benchmark/hs-benchmark-issue.md"]) {
    expect(off.has(file), `${file} stays off the deploy`).toBe(true);
  }
});
