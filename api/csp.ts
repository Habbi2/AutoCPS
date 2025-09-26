import { fetchPage } from '../src/fetch';
import { collectResources } from '../src/collect';
import { buildCSP } from '../src/builder';

export default async function handler(req: any, res: any) {
  const url = (req.query.url || req.body?.url) as string | undefined;
  const strict = (req.query.strict || req.body?.strict) === 'true';
  if (!url) {
    res.status(400).json({ error: 'Missing url param' });
    return;
  }
  try {
    const page = await fetchPage(url);
    const resources = collectResources(page.html, page.finalUrl);
    const csp = buildCSP(resources, { strict, existing: page.csp });
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.json({ input: url, finalUrl: page.finalUrl, status: page.status, existing: page.csp, ...csp });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}