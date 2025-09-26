
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
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const html = await res.text();
    return {
      url,
      finalUrl: res.url,
      status: res.status,
      headers,
      html,
      csp: headers['content-security-policy']
    };
  } finally {
    clearTimeout(t);
  }
}
