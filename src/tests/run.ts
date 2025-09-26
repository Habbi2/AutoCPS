import { buildCSP } from '../builder';
import { CollectedResources } from '../collect';

const sample: CollectedResources = {
  inlineScripts: ['console.log("hi")'],
  inlineStyles: ['body{color:red}'],
  externalScriptOrigins: new Set(['https://cdn.example.com']),
  externalStyleOrigins: new Set(),
  imageOrigins: new Set(['https://img.cdn.com']),
  fontOrigins: new Set(),
  connectOrigins: new Set(),
  dataUris: { scripts: 0, images: 0, styles: 0 }
};

const res = buildCSP(sample, {});
if (!res.policy.includes('script-src')) throw new Error('Missing script-src');
if (!/sha256-/.test(res.policy)) throw new Error('Inline script hash missing');
console.log('Test OK');
