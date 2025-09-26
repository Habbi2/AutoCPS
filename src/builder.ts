import crypto from 'node:crypto';
import { CollectedResources } from './collect';

export interface CSPBuildOptions {
  strict?: boolean; // if true use nonces/hashes only for scripts/styles and disallow external origins except explicit
  existing?: string | null;
}

export interface CSPResult {
  policy: string;
  directives: Record<string,string[]>;
  diff?: { added: string[]; removed: string[] };
  notes: string[];
}

export function buildCSP(resources: CollectedResources, opts: CSPBuildOptions = {}): CSPResult {
  const notes: string[] = [];
  const directives: Record<string,string[]> = {
    'default-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  // Scripts
  const scriptSrc: string[] = ["'self'"];
  for (const o of resources.externalScriptOrigins) scriptSrc.push(o);
  for (const code of resources.inlineScripts) {
    const hash = sha256(code);
    scriptSrc.push(`'sha256-${hash}'`);
  }
  if (scriptSrc.length) directives['script-src'] = dedupe(scriptSrc);

  // Styles
  const styleSrc: string[] = ["'self'"];
  for (const o of resources.externalStyleOrigins) styleSrc.push(o);
  for (const css of resources.inlineStyles) styleSrc.push(`'sha256-${sha256(css)}'`);
  if (styleSrc.length) directives['style-src'] = dedupe(styleSrc);

  // Images
  const imgSrc: string[] = ["'self'", 'data:'];
  for (const o of resources.imageOrigins) imgSrc.push(o);
  if (imgSrc.length) directives['img-src'] = dedupe(imgSrc);

  // Fonts
  if (resources.fontOrigins.size) {
    const fontSrc: string[] = ["'self'"];
    for (const o of resources.fontOrigins) fontSrc.push(o);
    directives['font-src'] = dedupe(fontSrc);
  }

  // Connect (heuristic currently only preconnect links); always include self
  const connectSrc: string[] = ["'self'"];
  for (const o of resources.connectOrigins) connectSrc.push(o);
  directives['connect-src'] = dedupe(connectSrc);

  // Upgrade insecure + block mixed plugins baseline
  directives['upgrade-insecure-requests'] = [];

  // Strict mode adjustments
  if (opts.strict) {
    // Remove external origins except self + hashes
    tightenToHashes(directives, 'script-src');
    tightenToHashes(directives, 'style-src');
    notes.push('Strict mode: external script/style origins removed; only self + hashes allowed.');
  }

  const policy = serialize(directives);
  const diff = opts.existing ? diffPolicies(opts.existing, policy) : undefined;
  if (diff && (diff.added.length || diff.removed.length)) {
    notes.push('Diff computed vs existing CSP.');
  }

  return { policy, directives, diff, notes };
}

function sha256(content: string) {
  return crypto.createHash('sha256').update(content).digest('base64');
}

function dedupe(arr: string[]) { return Array.from(new Set(arr)); }

function serialize(directives: Record<string,string[]>) {
  return Object.entries(directives)
    .map(([k,v]) => v.length ? `${k} ${v.join(' ')}` : k)
    .join('; ');
}

function tightenToHashes(directives: Record<string,string[]>, name: string) {
  const list = directives[name];
  if (!list) return;
  const hashes = list.filter(i => /^'sha256-/.test(i));
  const self = list.includes("'self'") ? ["'self'"] : [];
  directives[name] = dedupe([...self, ...hashes]);
}

function diffPolicies(oldP: string, newP: string) {
  const oldSet = new Set(oldP.split(/;\s*/));
  const newSet = new Set(newP.split(/;\s*/));
  const added: string[] = []; const removed: string[] = [];
  for (const d of newSet) if (!oldSet.has(d)) added.push(d);
  for (const d of oldSet) if (!newSet.has(d)) removed.push(d);
  return { added, removed };
}
