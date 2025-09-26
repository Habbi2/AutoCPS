export interface SnippetSet { helmet: string; nginx: string; apache: string; cloudflare: string; meta: string; }

export function buildSnippets(csp: string, extraHeaders: Record<string,string>): SnippetSet {
  const headersArray = Object.entries({ 'Content-Security-Policy': csp, ...extraHeaders });
  const helmetLines = headersArray.map(([k,v]) => `${headerKeyToHelmet(k)}: ${JSON.stringify(v)}`).join(',\n    ');
  const helmet = `// Helmet (Express)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
  frameguard: false,
  hsts: false,
  dnsPrefetchControl: false,
  ieNoOpen: false,
  noSniff: false,
  xssFilter: false
}));
// Manually set headers (adjust as needed)
app.use((_, res, next) => {
  ${headersArray.map(([k,v]) => `res.setHeader(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n  ')}
  next();
});`;

  const nginx = headersArray.map(([k,v]) => `add_header ${k} ${quoteMaybe(v)} always;`).join('\n');
  const apache = headersArray.map(([k,v]) => `Header set ${k} ${quoteMaybe(v)}`).join('\n');
  const cloudflare = headersArray.map(([k,v]) => `${k}: ${v}`).join('\n');
  const meta = `<meta http="Content-Security-Policy" content="${escapeHtml(csp)}">`;

  return { helmet, nginx, apache, cloudflare, meta };
}

function headerKeyToHelmet(k: string) {
  // Provide mapping for known keys if we later enable helmet's built-in; for now return placeholder
  return k.replace(/-/g,'');
}
function quoteMaybe(v: string) {
  if (/\s|;/.test(v)) return `'${v.replace(/'/g,"'\\''")}'`; // naive escaping
  return v;
}
function escapeHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
