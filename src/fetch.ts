
export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  csp?: string;
}

export async function fetchPage(url: string, timeoutMs = 15000): Promise<FetchedPage> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response | undefined;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      // Some origin servers send different content or block generic runtimes without UA
      headers: {
        'User-Agent': 'AutoCSP/0.1 (+https://github.com/Habbi2/AutoCPS)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    // Even on non-2xx we still attempt to read body so caller can inspect
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
    // Re-throw with normalized shape
    const err: any = new Error(e?.message || 'Fetch failed');
    err.cause = e;
    err.meta = {
      type: e?.name === 'AbortError' ? 'timeout' : 'network',
      aborted: e?.name === 'AbortError',
      originalName: e?.name,
      url
    };
    throw err;
  } finally {
    clearTimeout(t);
  }
}
