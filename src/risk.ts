export interface RiskIssue { id: string; message: string; weight: number; }
export interface RiskResult { score: number; level: 'low' | 'medium' | 'high'; issues: RiskIssue[]; }

// Heuristic scoring: start at 100, subtract for risky patterns / missing hardening
export function assessPolicy(policy: string): RiskResult {
  const issues: RiskIssue[] = [];
  let score = 100;
  const lower = policy.toLowerCase();

  function add(id: string, message: string, weight: number) {
    issues.push({ id, message, weight });
    score -= weight;
  }

  // Parse directives into map
  const parts = policy.split(/;\s*/).filter(Boolean);
  const dirMap: Record<string,string[]> = {};
  for (const p of parts) {
    const [name, ...rest] = p.trim().split(/\s+/);
    if (!name) continue;
    dirMap[name] = rest;
  }

  // Key directives presence
  const required = ['default-src','object-src','frame-ancestors','base-uri'];
  for (const r of required) {
    if (!(r in dirMap)) add('missing-'+r, `Missing directive: ${r}`, 8);
  }

  // default-src fallback risk
  if (dirMap['default-src'] && dirMap['default-src'].includes("*")) {
    add('default-wildcard', "default-src allows * (overly permissive)", 15);
  }

  // wildcard usage in script/style/img connect
  const wildcardDirs = ['script-src','style-src','img-src','connect-src'];
  for (const d of wildcardDirs) {
    const v = dirMap[d]; if (!v) continue;
    if (v.includes("*")) add(d+'-wildcard', `${d} has *`, 12);
    if (v.some(tok => tok.startsWith('http:'))) add(d+'-http', `${d} includes insecure http: origin`, 10);
    if (v.some(tok => tok === "'unsafe-inline'")) add(d+'-unsafe-inline', `${d} uses 'unsafe-inline'`, 14);
    if (v.some(tok => tok === "'unsafe-eval'")) add(d+'-unsafe-eval', `${d} uses 'unsafe-eval'`, 10);
  }

  // object-src should be 'none'
  if (dirMap['object-src'] && !dirMap['object-src'].includes("'none'")) {
    add('object-not-none', "object-src should be 'none'", 10);
  }

  // frame-ancestors should be restrictive
  if (dirMap['frame-ancestors'] && dirMap['frame-ancestors'].includes("*")) {
    add('frame-any', "frame-ancestors uses * (clickjacking risk)", 12);
  }

  // upgrade-insecure-requests recommended
  if (!parts.some(p => p.startsWith('upgrade-insecure-requests'))) {
    add('missing-upgrade', 'Missing upgrade-insecure-requests (recommended)', 4);
  }

  // Hash count heuristic (encourage hashing vs unsafe-inline)
  const hashCount = (policy.match(/'sha256-[A-Za-z0-9+/=]+'/g) || []).length;
  if (hashCount === 0 && dirMap['script-src'] && dirMap['script-src'].length > 0 && !dirMap['script-src'].includes("'unsafe-inline'")) {
    add('no-hashes', 'No script hashes detected (consider hashing inline scripts)', 5);
  }

  if (score < 0) score = 0;
  const level: RiskResult['level'] = score >= 80 ? 'low' : score >= 55 ? 'medium' : 'high';
  return { score, level, issues };
}
