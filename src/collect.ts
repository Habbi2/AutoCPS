import * as parse5 from 'parse5';

export interface CollectedResources {
  inlineScripts: string[];
  inlineStyles: string[];
  externalScriptOrigins: Set<string>;
  externalStyleOrigins: Set<string>;
  imageOrigins: Set<string>;
  fontOrigins: Set<string>;
  connectOrigins: Set<string>; // heuristic: fetch/XHR endpoints (to be added in runtime phase later)
  dataUris: { scripts: number; images: number; styles: number };
}

export function collectResources(html: string, pageUrl: string): CollectedResources {
  const doc: any = parse5.parse(html);
  const baseOrigin = safeOrigin(pageUrl);
  const res: CollectedResources = {
    inlineScripts: [],
    inlineStyles: [],
    externalScriptOrigins: new Set(),
    externalStyleOrigins: new Set(),
    imageOrigins: new Set(),
    fontOrigins: new Set(),
    connectOrigins: new Set(),
    dataUris: { scripts: 0, images: 0, styles: 0 }
  };

  function getAttr(node: any, name: string): string | undefined {
    if (!node.attrs) return undefined;
    const found = node.attrs.find((a: any) => a.name.toLowerCase() === name.toLowerCase());
    return found?.value;
  }

  function recordOrigin(url?: string) {
    if (!url) return;
    if (/^data:/i.test(url)) return;
    const o = safeOrigin(url);
    if (o && o !== baseOrigin) return o;
    return o; // always return origin (even if same) for future policy tightening
  }

  function walk(node: any) {
    if (node.nodeName === '#text') return;
    const tag = node.tagName?.toLowerCase();
    if (tag === 'script') {
      const src = getAttr(node, 'src');
      if (src) {
        const o = recordOrigin(src);
        if (o) res.externalScriptOrigins.add(o);
      } else if (node.childNodes) {
        const code = node.childNodes.map((c: any) => c.value || '').join('');
        if (code.trim()) res.inlineScripts.push(code);
      }
    }
    if (tag === 'link') {
      const rel = (getAttr(node, 'rel') || '').toLowerCase();
      const href = getAttr(node, 'href');
      if (rel.includes('stylesheet') && href) {
        const o = recordOrigin(href);
        if (o) res.externalStyleOrigins.add(o);
      }
      if (/preconnect|dns-prefetch/.test(rel) && href) {
        const o = recordOrigin(href);
        if (o) res.connectOrigins.add(o);
      }
    }
    if (tag === 'img') {
      const src = getAttr(node, 'src');
      if (src) {
        if (/^data:/i.test(src)) res.dataUris.images++;
        const o = recordOrigin(src);
        if (o) res.imageOrigins.add(o);
      }
    }
    if (tag === 'style' && node.childNodes) {
      const css = node.childNodes.map((c: any) => c.value || '').join('');
      if (css.trim()) res.inlineStyles.push(css);
      // crude font src detection
  const fontUrlMatches = Array.from(css.matchAll(/url\(([^)]+)\)/gi)) as RegExpMatchArray[];
  const fontUrls = fontUrlMatches.map(m => (m[1] || '').replace(/['"]/g,''));
      for (const fu of fontUrls) {
        if (/^data:/i.test(fu)) continue; else {
          const o = recordOrigin(fu);
          if (o) res.fontOrigins.add(o);
        }
      }
    }
    if (node.childNodes) node.childNodes.forEach(walk);
  }

  walk(doc);
  return res;
}

function safeOrigin(u: string): string | undefined {
  try { const url = new URL(u, 'http://dummy'); return url.origin; } catch { return undefined; }
}
