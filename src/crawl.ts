import { fetchPage } from './fetch';
import { collectResources, CollectedResources } from './collect';

export interface CrawlOptions { depth: number; sameOriginOnly?: boolean; maxPages?: number; }
export interface CrawlResult { pages: string[]; resources: CollectedResources; }

export async function crawl(startUrl: string, opts: CrawlOptions): Promise<CrawlResult> {
  const depth = Math.max(0, opts.depth);
  const maxPages = opts.maxPages ?? 15;
  const visited = new Set<string>();
  const queue: { url: string; d: number }[] = [{ url: startUrl, d: 0 }];
  const origin = new URL(startUrl).origin;

  const aggregate: CollectedResources = {
    inlineScripts: [],
    inlineStyles: [],
    externalScriptOrigins: new Set(),
    externalStyleOrigins: new Set(),
    imageOrigins: new Set(),
    fontOrigins: new Set(),
    connectOrigins: new Set(),
    dataUris: { scripts: 0, images: 0, styles: 0 }
  };

  while (queue.length && visited.size < maxPages) {
    const { url, d } = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const page = await fetchPage(url);
      const res = collectResources(page.html, page.finalUrl);
      mergeResources(aggregate, res);

      if (d < depth) {
        // Extract links for next level (simple regex approach to avoid extra parser traversal cost)
        const linkMatches = page.html.matchAll(/<a[^>]+href=["']([^"'#?]+)["']/gi);
        for (const m of linkMatches) {
          const href = m[1];
          if (!href) continue;
          let next: string;
          try { next = new URL(href, page.finalUrl).toString(); } catch { continue; }
          if (opts.sameOriginOnly !== false && new URL(next).origin !== origin) continue;
          if (!visited.has(next)) queue.push({ url: next, d: d + 1 });
        }
      }
    } catch {
      // Skip errors silently for now (could add logging)
    }
  }

  return { pages: Array.from(visited), resources: aggregate };
}

function mergeResources(base: CollectedResources, extra: CollectedResources) {
  base.inlineScripts.push(...extra.inlineScripts);
  base.inlineStyles.push(...extra.inlineStyles);
  extra.externalScriptOrigins.forEach(o => base.externalScriptOrigins.add(o));
  extra.externalStyleOrigins.forEach(o => base.externalStyleOrigins.add(o));
  extra.imageOrigins.forEach(o => base.imageOrigins.add(o));
  extra.fontOrigins.forEach(o => base.fontOrigins.add(o));
  extra.connectOrigins.forEach(o => base.connectOrigins.add(o));
  base.dataUris.scripts += extra.dataUris.scripts;
  base.dataUris.images += extra.dataUris.images;
  base.dataUris.styles += extra.dataUris.styles;
}
