
export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  csp?: string;
}

export interface FetchOptions { timeoutMs?: number; maxRetries?: number; }

export async function fetchPage(url: string, timeoutMs = 15000, opts: FetchOptions = {}): Promise<FetchedPage> {
  const retries = Math.max(0, opts.maxRetries ?? 2);
  let attempt = 0;
  let lastErr: any;
  while (attempt <= retries) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AutoCSP/0.1 (+https://github.com/Habbi2/AutoCPS)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      let html = '';
      try { html = await res.text(); } catch { html = ''; }
      return {
        url,
        finalUrl: res.url,
        status: res.status,
        headers,
        html,
        csp: headers['content-security-policy']
      };
    } catch (e: any) {
      lastErr = e;
      // AbortError or network: retry unless final attempt
      if (attempt === retries) {
        const err: any = new Error(e?.message || 'Fetch failed');
        err.cause = e;
        err.meta = {
          type: e?.name === 'AbortError' ? 'timeout' : 'network',
          aborted: e?.name === 'AbortError',
          originalName: e?.name,
          url,
          attempt,
          retries
        };
        throw err;
      }
      await new Promise(r => setTimeout(r, 150 * (attempt + 1))); // backoff
    } finally {
      clearTimeout(t);
      attempt++;
    }
  }
  throw lastErr;
}
