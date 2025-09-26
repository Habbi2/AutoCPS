import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime (some functionality like crypto + unrestricted fetch may fail on edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { fetchPage } from '../../../src/fetch';
import { collectResources } from '../../../src/collect';
import { buildCSP } from '../../../src/builder';
import { crawl } from '../../../src/crawl';
import { assessPolicy } from '../../../src/risk';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }
  const debug = req.nextUrl.searchParams.get('debug') === '1';
  const strictQuery = req.nextUrl.searchParams.get('strict') === 'true';
  const timeoutParam = req.nextUrl.searchParams.get('timeout');
  const timeoutMs = timeoutParam ? Math.min(45000, Math.max(3000, parseInt(timeoutParam, 10) || 15000)) : 15000;
  const runtime = req.nextUrl.searchParams.get('runtime') === 'true';
  const depthParam = req.nextUrl.searchParams.get('depth');
  const depth = depthParam ? Math.min(3, Math.max(0, parseInt(depthParam, 10) || 0)) : 0; // cap depth to 3
  const trace: any[] = [];
  function mark(step: string, extra: any = {}) { if (debug) trace.push({ step, ts: Date.now(), ...extra }); }
  try {
  mark('fetch:start', { url, timeoutMs });
  const page = await fetchPage(url, timeoutMs, { maxRetries: 2 });
  mark('fetch:done', { status: page.status, finalUrl: page.finalUrl, size: page.html.length });
    let resources = collectResources(page.html, page.finalUrl);
    let runtimeStatus: 'disabled' | 'ok' | 'unavailable' = 'disabled';
    if (runtime) {
      try {
        mark('runtime:start');
        const mod = await import('../../../src/runtime');
        resources = await mod.collectRuntimeResources(page.finalUrl, { waitUntil: 'networkidle' });
        runtimeStatus = 'ok';
        mark('runtime:ok');
      } catch (e: any) {
        // playwright not available or runtime failure; continue with static resources
        runtimeStatus = 'unavailable';
        mark('runtime:fail', { message: e?.message });
      }
    }
    let crawledPages: string[] = [page.finalUrl];
    if (depth > 0) {
      try {
        mark('crawl:start', { depth });
        const crawlRes = await crawl(page.finalUrl, { depth, sameOriginOnly: true });
        crawledPages = crawlRes.pages;
        // merge crawl resources
        const merged = crawlRes.resources;
        resources.inlineScripts.push(...merged.inlineScripts);
        resources.inlineStyles.push(...merged.inlineStyles);
        merged.externalScriptOrigins.forEach(o => resources.externalScriptOrigins.add(o));
        merged.externalStyleOrigins.forEach(o => resources.externalStyleOrigins.add(o));
        merged.imageOrigins.forEach(o => resources.imageOrigins.add(o));
        merged.fontOrigins.forEach(o => resources.fontOrigins.add(o));
        merged.connectOrigins.forEach(o => resources.connectOrigins.add(o));
      } catch {}
    }
    // Build baseline (non-strict) and strict side-by-side
    const baseline = buildCSP(resources, { strict: false, existing: page.csp });
    const strict = buildCSP(resources, { strict: true, existing: page.csp });
    const active = strictQuery ? strict : baseline;
  const diffModes = diffBetweenPolicies(baseline.policy, strict.policy);
  const summaryBaseline = summarizeDirectives(baseline.directives);
  const summaryStrict = summarizeDirectives(strict.directives);
    const headers = recommendedHeaders();
  const riskActive = stringifyRisk(assessPolicy(active.policy));
  const riskBaseline = stringifyRisk(assessPolicy(baseline.policy));
  const riskStrict = stringifyRisk(assessPolicy(strict.policy));
    const responseBody: any = {
      input: url,
      finalUrl: page.finalUrl,
      status: page.status,
      existing: page.csp,
  baseline: { policy: baseline.policy, notes: baseline.notes, diffExisting: baseline.diff },
  strict: { policy: strict.policy, notes: strict.notes, diffExisting: strict.diff },
  activeMode: strictQuery ? 'strict' : 'baseline',
  runtime: runtime ? true : false,
      runtimeStatus,
      crawl: { depth, pages: crawledPages, count: crawledPages.length },
      diffModes,
      headers,
      policy: active.policy,
      notes: active.notes,
      risk: { active: riskActive, baseline: riskBaseline, strict: riskStrict },
      summaries: { baseline: summaryBaseline, strict: summaryStrict }
    };
    if (debug) responseBody.trace = trace;
    return NextResponse.json(responseBody, {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=300'
      }
    });
  } catch (e: any) {
    const meta = normalizeError(e);
    const soft: any = {
      error: meta.message,
      kind: meta.kind,
      detail: debug ? meta : undefined,
      upstream: meta.meta?.status,
      attempt: meta.meta?.attempt,
      retries: meta.meta?.retries,
      url,
      timeoutMs
    };
    if (debug) soft.trace = trace;
    return new NextResponse(
      JSON.stringify(soft),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'x-autocsp-error-kind': meta.kind || 'unknown'
        }
      }
    );
  }
}

function diffBetweenPolicies(a: string, b: string) {
  if (a === b) return { added: [], removed: [] };
  const setA = new Set(a.split(/;\s*/));
  const setB = new Set(b.split(/;\s*/));
  const added: string[] = []; const removed: string[] = [];
  for (const d of setB) if (!setA.has(d)) added.push(d);
  for (const d of setA) if (!setB.has(d)) removed.push(d);
  return { added, removed };
}

function recommendedHeaders() {
  return {
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=(self)',
      'battery=()',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'picture-in-picture=(self)',
      'publickey-credentials-get=(self)',
      'screen-wake-lock=()',
      'sync-xhr=(self)',
      'usb=()',
      'xr-spatial-tracking=()'
    ].join(', ')
  };
}

function stringifyRisk(r: { score: number; level: string; issues: { id: string; message: string; weight: number }[] }) {
  return { score: r.score, level: r.level, issues: r.issues.map(i => i.message) };
}

function summarizeDirectives(directives: Record<string,string[]>) {
  const out: Record<string, { sources: number; hashes: number; origins: number; wildcards: number }> = {};
  const hashRe = /^'sha256-/;
  const originRe = /^https?:\/\//i;
  for (const [name, list] of Object.entries(directives)) {
    const hashes = list.filter(s => hashRe.test(s)).length;
    const origins = list.filter(s => originRe.test(s)).length;
    const wildcards = list.filter(s => s === "*").length;
    out[name] = { sources: list.length, hashes, origins, wildcards };
  }
  return out;
}

function normalizeError(e: any) {
  const kind = e?.meta?.type || (e?.name === 'AbortError' ? 'timeout' : 'unknown');
  return {
    kind,
    message: e?.message || 'Internal error',
    stack: e?.stack,
    meta: e?.meta,
    originalName: e?.name,
    causeMessage: e?.cause?.message
  };
}
