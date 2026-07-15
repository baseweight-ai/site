/**
 * Shared definition of "the visitor-visible text of a page" plus the site's
 * page inventory. copy-lint (patterns) and copy-budget (word counts) both
 * import from here so the two can never diverge on what counts as copy, and
 * a page added to the repo is linted and budgeted on arrival.
 */
import fs from "fs";
import path from "path";

export const SITE_ROOT = path.join(__dirname, "..");

// convert.html is an internal utility (image converter), not part of the site.
export const PAGE_EXEMPT = new Set(["convert.html"]);

export function sitePages(): string[] {
  return fs
    .readdirSync(SITE_ROOT)
    .filter((f) => f.endsWith(".html") && !PAGE_EXEMPT.has(f))
    .sort();
}

export function stripBlocks(html: string): { visible: string; scripts: string[]; metas: string[] } {
  const scripts: string[] = [];
  // Meta/OG descriptions and titles are copy too; tag-stripping would drop the
  // content attributes, so pull them out first.
  const metas = [...html.matchAll(/<meta[^>]+content="([^"]*)"/gi)]
    .map((m) => m[1])
    .filter((c) => c.length >= 20); // skip viewport/charset-style values
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, (m) => {
    scripts.push(m);
    return " ";
  });
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&rsquo;|&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  return { visible: s, scripts, metas };
}

// Pull quoted string literals out of inline scripts; skips code and comments.
export function stringLiterals(scriptBlocks: string[]): string[] {
  const out: string[] = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  for (const block of scriptBlocks) {
    // Drop line + block comments so commented-out code can't fire the lint.
    const code = block.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const lit = m[1] ?? m[2] ?? m[3] ?? "";
      if (lit.length >= 8) out.push(lit); // short literals are code, not copy
    }
  }
  return out;
}

export function visibleWords(html: string): number {
  return stripBlocks(html).visible.split(/\s+/).filter(Boolean).length;
}
