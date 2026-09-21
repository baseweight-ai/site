/**
 * Cross-cutting site tests: nav, footer, CTAs, page titles.
 * These enforce the invariants documented in CLAUDE.md:
 *   - Footer is identical on every page
 *   - All CTA buttons say "Book a call" and link to cal.com
 *   - Nav is rendered on every page
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { CAL_URL, SITE_ROOT, sitePages } from "./copy-text";

// Titles are decisions, so they stay written down. The page list is not: it
// comes from disk, so a new page gets nav, footer, title and CTA coverage on
// arrival instead of silently escaping this file.
const TITLES: Record<string, RegExp> = {
  "index.html": /Baseweight/,
  "about.html": /About/,
  "benchmark.html": /Benchmark/i,
  "methodology.html": /How it.s tested/i,
  "retrieval-service.html": /Retrieval service/,
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

// Home, Benchmark, About, then the Book a call button. Contact was removed with
// its page on 2026-09-20.
test("nav carries exactly Home, Benchmark, About and the call button", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("nav#nav a").first()).toBeVisible();
  const nav = page.locator("nav#nav");
  await expect(nav.locator("li a:not(.nav-cta)")).toHaveText(["Home", "Benchmark", "About"]);
  await expect(nav.getByRole("link", { name: "Benchmark", exact: true })).toHaveAttribute(
    "href",
    "/benchmark"
  );
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

test("benchmark page has its nav link marked active", async ({ page }) => {
  await page.goto("/benchmark.html");
  const activeLink = page.locator("nav a.active, nav a[aria-current]");
  if (await activeLink.count() > 0) {
    const href = await activeLink.first().getAttribute("href");
    expect(href).toMatch(/benchmark/i);
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
      "https://baseweight.co/benchmark",
      "https://baseweight.co/methodology",
      "https://baseweight.co/privacy",
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
  for (const source of ["/head-to-head", "/contact", "/pilot", "/scope", "/fit-score", "/diagnostic"]) {
    expect(map[source], `${source} must redirect`).toBeTruthy();
  }
  expect(map["/head-to-head"]).toBe("/benchmark");
  expect(map["/contact"]).toBe("/#cta");
});
