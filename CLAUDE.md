# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Baseweight is a static marketing site for a domain AI adaptation consultancy. No build tools, no package manager, no framework — just HTML files deployed to Vercel.

## Deployment

Deployed via Vercel with `cleanUrls: true`, so `/about` serves `about.html`, `/contact` serves `contact.html`, etc. To preview locally, use any static file server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Architecture

**Shared components** (the only external files):
- `components.css` — nav, footer, and skip-nav CSS; linked from every page's `<head>`
- `components.js` — renders the nav and footer HTML into `<nav id="nav"></nav>` and `<footer></footer>` shell elements, and wires up scroll/mobile-toggle behavior; included at the bottom of every page's `<body>`

All other CSS and JavaScript is **inline within each HTML file**. The design system CSS variables are duplicated in every page's `<style>` block.

**Pages:** `index.html`, `about.html`, `contact.html`, `privacy.html`, `diagnostic.html`, `benchmark.html`, `methodology.html`

**Design tokens** (defined in `:root` in each file):
- `--accent: #c9a84c` — gold accent color
- `--font-display: 'Syne'` — headings
- `--font-mono: 'IBM Plex Mono'` — body text and UI elements
- `--max-width: 1120px` — layout container
- `--bg-primary: #080808` — near-black background

**Recurring CSS patterns:**
- `.reveal` + IntersectionObserver for scroll-triggered fade-in animations
- `.container` for centered, max-width layout with responsive horizontal padding
- `.section-label` for small-caps section headers with a gold accent line prefix
- `nav.scrolled` state toggled by scroll position for frosted-glass nav

**When updating nav or footer styles**, edit `components.css` only — it applies everywhere automatically. When updating design tokens or fonts, the change must still be applied to every HTML file manually.

**The footer is identical across every page — never vary it.** Copy this exactly:

```html
<footer>
  <div class="container">
    <p>&copy; 2026 Baseweight. &nbsp;&middot;&nbsp; <a href="/about" style="color: var(--text-muted);">About</a> &nbsp;&middot;&nbsp; <a href="/contact" style="color: var(--text-muted);">Contact</a> &nbsp;&middot;&nbsp; <a href="/privacy" rel="privacy-policy" style="color: var(--text-muted);">Privacy Policy</a></p>
    <p style="font-size:12px; margin-top:6px; color: var(--text-muted);" itemscope itemtype="https://schema.org/WebPage">By <span itemprop="author" itemscope itemtype="https://schema.org/Person"><a href="/about" rel="author" itemprop="url" style="color: var(--text-muted);"><span itemprop="name">Philip Stevens</span></a></span> &nbsp;&middot;&nbsp; Updated <time itemprop="datePublished" datetime="2026-03-01">March 2026</time></p>
  </div>
</footer>
```

**All CTA buttons** (nav and body) must say "Book a free call" and link to `https://cal.com/philip-stevens/baseweight-intro` with `target="_blank" rel="noopener noreferrer"`.

## SEO & Meta

- `sitemap.xml` and `robots.txt` are manually maintained
- Each page has full OG and Twitter card meta tags
- `images/featured.png` (1200×627) is the shared social preview image; `images/icon.png` (300×300) is used as apple-touch-icon
- `images/banner.png` (1584×396) is the LinkedIn profile banner
- Canonical URLs point to `https://baseweight.co/`

## Site Audit

`squirrel.toml` configures squirrelscan for site health auditing (links, SEO, performance rules). Run against the live site or a local server.

## Security Headers

Defined in `vercel.json`. CSP allows inline scripts/styles (required since all JS/CSS is inline), Google Fonts, and `script.google.com` for the contact form submission endpoint.
