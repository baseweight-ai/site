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

All CSS and JavaScript is **inline within each HTML file** — there are no shared stylesheets or script files. The design system CSS variables are duplicated in every page's `<style>` block.

**Pages:** `index.html`, `about.html`, `contact.html`, `privacy.html`, `diagnostic.html`

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

**When updating shared styles** (nav, footer, design tokens, fonts), the change must be applied to every HTML file manually — there is no shared CSS file.

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
