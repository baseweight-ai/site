/**
 * Homepage: the consultancy page's sections and its offer carousel.
 *
 * The copy asserted here is the site's current decision, not law (CLAUDE.md):
 * change a label on the page and change it here in the same commit. Prices are
 * asserted because they are published terms, so a silent edit is a pricing
 * change nobody reviewed.
 */
import { test, expect } from "@playwright/test";
import { CAL_URL, expectSectionOrder } from "./copy-text";

// Four cards, in this order. Prices are published terms, so they are asserted:
// a silent edit is a pricing change nobody reviewed. Price and duration stay
// co-equal on one line, since a price without a duration is not decidable.
const OFFERS = [
  { name: "Production Diagnostic", spec: "$7,500 · 2 weeks" },
  { name: "Eval Harness Sprint", spec: "From $24,000 · 3 weeks" },
  { name: "Eval Retainer", spec: "From $5,000/month" },
  { name: "Post-Training", spec: "From $45,000 · 6 weeks" },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
});

test("hero states the positioning and books a call", async ({ page }) => {
  await expect(page.locator("h1")).toHaveText("We make AI systems work after the demo.");
  await expect(page.locator(".hero-sub")).toHaveText(
    "Baseweight is an AI engineering consultancy. We build, measure, harden and optimize LLM systems in production."
  );
  await expect(page.locator(".hero a.btn-primary")).toHaveAttribute("href", CAL_URL);
});

test("the page is titled for the consultancy", async ({ page }) => {
  await expect(page).toHaveTitle("Baseweight: AI engineering consultancy");
});

// Read order: what we do, then who it is for, then what it costs, then the
// artifacts behind it. Pinned because a section move is a positioning decision.
test("sections run in the intended order", async ({ page }) => {
  await expectSectionOrder(page, ["#hero", "#what-we-do", "#who", "#offers", "#published", ".final-cta"]);
});

test("the page carries exactly two CTAs in the body, both to cal.com", async ({ page }) => {
  // Hero and final CTA only. The offer cards deliberately carry no button: with
  // the nav CTA always on screen, a button per card stacked five gold buttons in
  // one viewport. A third body CTA here means one crept back.
  const ctas = page.locator("main").getByRole("link", { name: /Book a call/i });
  await expect(ctas).toHaveCount(2);
  for (const cta of await ctas.all()) {
    await expect(cta).toHaveAttribute("href", CAL_URL);
  }
  await expect(page.locator("nav#nav a.nav-cta")).toHaveAttribute("href", CAL_URL);
  await expect(page.locator(".sticky-cta")).toHaveCount(0); // removed site-wide
});

test("what-we-do lists the six lines of work", async ({ page }) => {
  await expect(page.locator(".do-item")).toHaveCount(6);
  // The middle four mirror the hero's verbs: build, measure, harden, optimize.
  await expect(page.locator(".do-term")).toHaveText([
    "Build AI systems",
    "Measure them",
    "Harden them",
    "Optimize them",
    "Train your own models",
    "Run them in production",
  ]);
});

test("the offer carousel carries every offer and its spec line", async ({ page }) => {
  const cards = page.locator(".offer-card");
  await expect(cards).toHaveCount(OFFERS.length);
  for (const [i, offer] of OFFERS.entries()) {
    const card = cards.nth(i);
    await expect(card.locator(".offer-index")).toHaveText(String(i + 1).padStart(2, "0"));
    await expect(card.locator("h3")).toHaveText(offer.name);
    await expect(card.locator(".offer-spec")).toHaveText(offer.spec);
    await expect(card.getByRole("link")).toHaveCount(0);
  }
});

// Four elements per card, in one order, and nothing else. The outcome, fee
// credit, and findings lines were cut on 2026-09-20; a card grew to seven
// fields once and the row got unreadable.
test("every card renders exactly four fields, in order", async ({ page }) => {
  const cards = page.locator(".offer-card");
  for (let i = 0; i < OFFERS.length; i++) {
    const shape = await cards.nth(i).evaluate((card) => ({
      children: [...card.children].map((el) => el.className || el.tagName.toLowerCase()),
      tops: [".offer-index", "h3", "p", ".offer-spec"].map(
        (sel) => (card.querySelector(sel) as HTMLElement).getBoundingClientRect().top
      ),
    }));
    expect(shape.children, OFFERS[i].name).toEqual(["offer-index", "h3", "p", "offer-spec"]);
    for (let n = 1; n < shape.tops.length; n++) {
      expect(shape.tops[n]).toBeGreaterThan(shape.tops[n - 1]);
    }
  }
  await expect(page.locator(".offer-outcome, .offer-note, .offer-credit")).toHaveCount(0);
});

// Card width is derived from the track width, so both of these hold at every
// width rather than only at the one the layout was eyeballed on.
for (const width of [1440, 1280, 1120, 1024, 900, 760, 620, 400]) {
  // Viewport as a fixture, so the shared beforeEach navigation is the only
  // load and it happens at the right width.
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("the carousel shows whole cards of equal height", async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const track = document.querySelector("#offerTrack") as HTMLElement;
      const cards = [...document.querySelectorAll(".offer-card")];
      const rects = cards.map((c) => c.getBoundingClientRect());
      return {
        track: track.clientWidth,
        card: rects[0].width,
        gap: parseFloat(getComputedStyle(track).columnGap),
        heights: rects.map((r) => Math.round(r.height)),
      };
    });
    // A whole number of cards spans the track: nothing is ever cut mid-sentence.
    const leftover = (metrics.track + metrics.gap) % (metrics.card + metrics.gap);
    expect(Math.min(leftover, metrics.card + metrics.gap - leftover)).toBeLessThan(2);
    expect(new Set(metrics.heights).size).toBe(1);
    });
  });
}

test("carousel arrows advance the track and bound at both ends", async ({ page }) => {
  const track = page.locator("#offerTrack");
  const prev = page.locator("#offerPrev");
  const next = page.locator("#offerNext");

  await expect(prev).toBeDisabled(); // starts at the left edge
  await expect(next).toBeEnabled();

  await next.click();
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(prev).toBeEnabled();

  await prev.click();
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeLessThanOrEqual(1);
});

// The rail is the "this scrolls" signal: a thumb covering part of a track is
// read as a scrollbar, where four small dots were read as decoration.
test("the rail thumb shows what fraction of the row is on screen", async ({ page }) => {
  const measure = () =>
    page.evaluate(() => {
      const track = document.querySelector("#offerTrack") as HTMLElement;
      const thumb = document.querySelector("#offerRailThumb") as HTMLElement;
      const rail = document.querySelector("#offerRail") as HTMLElement;
      return {
        shown: track.clientWidth / track.scrollWidth,
        thumbRatio: thumb.getBoundingClientRect().width / rail.getBoundingClientRect().width,
        thumbLeft: thumb.getBoundingClientRect().left - rail.getBoundingClientRect().left,
      };
    });

  const start = await measure();
  expect(start.shown).toBeLessThan(1); // there is more than one screenful
  expect(start.thumbRatio).toBeCloseTo(start.shown, 1);
  expect(start.thumbLeft).toBeLessThan(2); // parked at the left

  // scroll-behavior is smooth on the track, so jump with it switched off.
  await page.locator("#offerTrack").evaluate((el) => {
    el.style.scrollBehavior = "auto";
    el.scrollLeft = el.scrollWidth;
  });
  await expect.poll(async () => (await measure()).thumbLeft).toBeGreaterThan(start.thumbLeft + 4);
});

test("an edge fade marks the direction there is more in", async ({ page }) => {
  // Whole cards only means nothing peeks past the edge, so the fade is what
  // says the row continues. It must follow the scroll, not sit on both sides.
  const viewport = page.locator("#offerViewport");
  await expect(viewport).not.toHaveClass(/has-prev/); // at the left edge
  await expect(viewport).toHaveClass(/has-next/);

  await page.locator("#offerTrack").evaluate((el) => {
    el.style.scrollBehavior = "auto";
    el.scrollLeft = el.scrollWidth;
  });
  await expect(viewport).toHaveClass(/has-prev/);
  await expect(viewport).not.toHaveClass(/has-next/); // at the right edge
});

test.describe("with JS off", () => {
  test.use({ javaScriptEnabled: false });
  test("the fade is on, so the signal survives", async ({ page }) => {
    await expect(page.locator("#offerViewport")).toHaveClass(/has-next/);
  });
});

// ── Published band ──────────────────────────────────────────────────────────
// Rows are links, not CTAs, so they do not count against the
// one-CTA-per-viewport rule.

test("the published section carries both rows, each linking to its page", async ({ page }) => {
  const rows = page.locator(".published-row");
  await expect(rows).toHaveCount(2);
  await expect(page.locator("#published .section-label")).toHaveText("Proof");
  await expect(page.locator("#published h2")).toHaveText("What we’ve built.");

  const shipped = rows.nth(0);
  await expect(shipped).toHaveAttribute("href", "/benchmark");
  await expect(shipped.locator(".published-name")).toHaveText("Benchmark");
  await expect(shipped.locator(".published-what")).toHaveText(
    "Fine-tuned open models against a frontier API on two vertical tasks, with hash-verified results."
  );

  const second = rows.nth(1);
  await expect(second).toHaveAttribute("href", "/retrieval-service");
  await expect(second.locator(".published-name")).toHaveText("Retrieval service");
  await expect(second.locator(".published-what")).toHaveText(
    "Deployed, with tracing, a failure-mode eval suite, and cost per request."
  );
  await expect(second.locator(".published-go")).toHaveCount(1);
  // The "In build" label came off on 2026-09-20 when the row got a page.
  await expect(page.locator("#published")).not.toContainText(/in build/i);
});

// Each row carries the card treatment rather than reading as a table line.
test("the rows are blocks, not bare list lines", async ({ page }) => {
  const style = await page.locator(".published-row").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      left: parseFloat(cs.borderLeftWidth),
      padX: parseFloat(cs.paddingLeft),
      height: el.getBoundingClientRect().height,
    };
  });
  expect(style.bg).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(style.left).toBeGreaterThan(1);
  expect(style.padX).toBeGreaterThan(20);
  expect(style.height).toBeGreaterThan(70);
});

test("who-we-work-with names the three audiences", async ({ page }) => {
  await expect(page.locator(".who-card h3")).toHaveText(["Startups", "Agencies", "Operators"]);
});

// Agencies only. A text link, not a button, so it stays under the section.
test("the agencies card carries the one contact link", async ({ page }) => {
  const cards = page.locator(".who-card");
  await expect(cards.nth(0).locator("a")).toHaveCount(0);
  await expect(cards.nth(2).locator("a")).toHaveCount(0);
  const link = cards.nth(1).locator("a.who-link");
  await expect(link).toHaveText("Email us");
  await expect(link).toHaveAttribute("href", "mailto:hello@baseweight.co");
  const style = await link.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(style).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

// ── Final CTA: two routes, unequal weight ───────────────────────────────────
// Booking is the primary; the email route is a real outlined button so a reader
// who will not book on a first visit still has somewhere to go.

test("the final CTA offers a call and an email, weighted differently", async ({ page }) => {
  const cta = page.locator(".final-cta");
  await expect(cta.locator("a.btn-primary")).toHaveCount(1);
  await expect(cta.locator("a.btn-primary")).toHaveAttribute("href", CAL_URL);
  const email = cta.locator("a.btn-ghost");
  await expect(email).toHaveText("Email us");
  await expect(email).toHaveAttribute("href", "mailto:hello@baseweight.co");
  // Outlined, not a second filled block: transparent background, real border.
  const style = await email.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, borderWidth: cs.borderTopWidth };
  });
  expect(style.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(parseFloat(style.borderWidth)).toBeGreaterThan(0);
});

// ── Scroll behaviour ─────────────────────────────────────────────────────────

test("keyboard focus into the carousel clears the fixed nav", async ({ page }) => {
  await page.locator("#offerTrack").focus();
  const track = (await page.locator("#offerTrack").boundingBox())!;
  const navBottom = await page
    .locator("nav#nav .nav-inner")
    .evaluate((el) => el.getBoundingClientRect().bottom);
  // html { scroll-padding-top } keeps a scrolled-to target out from under the nav.
  expect(track.y).toBeGreaterThan(navBottom);
});

test("a fast jump down never lands on a blank viewport", async ({ page }) => {
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior })
  );
  await page.waitForTimeout(120); // about what a fast scroller actually waits
  const painting = await page.evaluate(() => {
    const vh = window.innerHeight;
    return [...document.querySelectorAll(".reveal")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh && getComputedStyle(el).opacity !== "0";
    }).length;
  });
  expect(painting).toBeGreaterThan(0);
});

test("the removed sections stay removed", async ({ page }) => {
  await expect(page.locator(".faq-item")).toHaveCount(0);
  await expect(page.locator(".pricing-table")).toHaveCount(0);
  await expect(page.locator(".task-eg")).toHaveCount(0);
  await expect(page.getByText(/founding/i)).toHaveCount(0);
  await expect(page.locator(".offer-cta")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Scope your task/i })).toHaveCount(0);
  await expect(page.locator(".proof-strip")).toHaveCount(0); // head-to-head strip, removed 2026-09-20
});
