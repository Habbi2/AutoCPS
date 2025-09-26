import { collectResources, CollectedResources } from './collect';

export interface RuntimeOptions { timeoutMs?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; }

export async function collectRuntimeResources(url: string, opts: RuntimeOptions = {}): Promise<CollectedResources> {
  // Dynamic import so build does not require playwright present
  if (!process.env.PLAYWRIGHT_ENABLED) {
    // Runtime disabled by env, return empty collection baseline
    return collectResources('', url);
  }
  let chromium: any;
  try {
    // Obfuscate import path so bundler doesn't eagerly include playwright in serverless function
    const pkg = 'playwright';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    chromium = (await import(/* @vite-ignore */ pkg)).chromium;
  } catch (e) {
    return collectResources('', url); // playwright unavailable
  }

  const timeout = opts.timeoutMs ?? 15000;
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url, { timeout, waitUntil: opts.waitUntil ?? 'networkidle' });

    // Extract HTML snapshot AFTER runtime mutations
    const html = await page.content();

    // Collect network request origins for scripts/styles/images/fonts/connect
    const externalScriptOrigins = new Set<string>();
    const externalStyleOrigins = new Set<string>();
    const imageOrigins = new Set<string>();
    const fontOrigins = new Set<string>();
    const connectOrigins = new Set<string>();

  page.on('requestfinished', (req: any) => {
      try {
        const resourceType = req.resourceType();
        const u = req.url();
        const origin = safeOrigin(u);
        if (!origin) return;
        switch (resourceType) {
          case 'script': externalScriptOrigins.add(origin); break;
          case 'stylesheet': externalStyleOrigins.add(origin); break;
          case 'image': imageOrigins.add(origin); break;
          case 'font': fontOrigins.add(origin); break;
          case 'xhr':
          case 'fetch':
          case 'websocket': connectOrigins.add(origin); break;
          default: break;
        }
      } catch {}
    });

    // small wait to allow late network
    await page.waitForTimeout(500);

    const staticCollected = collectResources(html, url);

    // merge network-discovered origins
    externalScriptOrigins.forEach(o => staticCollected.externalScriptOrigins.add(o));
    externalStyleOrigins.forEach(o => staticCollected.externalStyleOrigins.add(o));
    imageOrigins.forEach(o => staticCollected.imageOrigins.add(o));
    fontOrigins.forEach(o => staticCollected.fontOrigins.add(o));
    connectOrigins.forEach(o => staticCollected.connectOrigins.add(o));

    return staticCollected;
  } finally {
    await browser.close();
  }
}

function safeOrigin(u: string): string | undefined {
  try { const url = new URL(u); return url.origin; } catch { return undefined; }
}
