#!/usr/bin/env node
import { fetchPage } from './fetch';
import { collectResources } from './collect';
import { buildCSP } from './builder';
import { collectRuntimeResources } from './runtime';

function parseArgs(argv: string[]) {
  const args: Record<string, any> = { strict: false, runtime: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') args.strict = true;
  else if (a === '--json') args.json = true;
  else if (a === '--runtime') args.runtime = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (!args.url) args.url = a;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.url) {
  console.log(`Usage: autocsp <url> [--strict] [--runtime] [--json]\n` +
`Examples:\n  autocsp https://example.com\n  autocsp https://example.com --strict --json\n  autocsp https://example.com --runtime`);
    process.exit(args.url ? 0 : 1);
  }
  try {
    const page = await fetchPage(args.url);
    let resources = collectResources(page.html, page.finalUrl);
    if (args.runtime) {
      try {
        resources = await collectRuntimeResources(page.finalUrl, { waitUntil: 'networkidle' });
      } catch (e: any) {
        console.error('Runtime collection failed or Playwright missing - continuing with static parse.');
      }
    }
    const result = buildCSP(resources, { strict: args.strict, existing: page.csp });
    if (args.json) {
      console.log(JSON.stringify({ input: args.url, finalUrl: page.finalUrl, status: page.status, existingCsp: page.csp, ...result }, null, 2));
    } else {
      console.log('\nProposed Content-Security-Policy:\n');
      console.log(result.policy + '\n');
      if (page.csp) {
        console.log('Existing CSP Detected:');
        console.log(page.csp + '\n');
      }
      if (result.diff && (result.diff.added.length || result.diff.removed.length)) {
        console.log('Diff vs existing:');
        if (result.diff.added.length) console.log('  + ' + result.diff.added.join('\n  + '));
        if (result.diff.removed.length) console.log('  - ' + result.diff.removed.join('\n  - '));
        console.log('');
      }
      if (result.notes.length) {
        console.log('Notes:');
        for (const n of result.notes) console.log('  - ' + n);
      }
    }
  } catch (e: any) {
    console.error('Failed:', e.message || e);
    process.exit(1);
  }
}

main();
