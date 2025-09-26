<p align="center">
	<img width="100" src="app/icon.svg" alt="AutoCSP logo" />
</p>

# AutoCSP

> From permissive → locked‑down CSP (baseline + strict) in minutes. [Live Demo](https://auto-cps.vercel.app) · [Repo](https://github.com/Habbi2/AutoCPS)

<!-- Badges (add real ones once available) -->
![Stars](https://img.shields.io/github/stars/Habbi2/AutoCPS?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square) ![Status](https://img.shields.io/badge/status-early_preview-orange?style=flat-square)

AutoCSP generates, compares, and refines production‑ready Content-Security-Policy headers for any public URL. It discovers required sources (static + optional runtime + multi‑page crawl), hashes inline code, and surfaces risk & directive analytics so you can confidently ship a hardened policy.

## TL;DR / Why
Manual CSP hardening is slow: teams copy templates, stay stuck in `report-only`, or allow everything. AutoCSP automates discovery and offers a dual-policy workflow (Baseline vs Strict) so you can iteratively tighten without guesswork.

| You Have | AutoCSP Gives |
|----------|---------------|
| Loose `default-src *` or copy‑paste policy | Minimal baseline + hash‑focused strict candidate |
| Inline script/style sprawl | SHA-256 hashing & ratios |
| Unknown risks | Heuristic risk score + issue list |
| Slow iteration | Immediate diff between existing / baseline / strict |

## Feature Highlights
### Core
- Dual Baseline & Strict policy generation (strict = self + hashes for script/style)
- Detection & diff against any existing CSP
- Inline script & style SHA-256 hashing
- Opinionated hardening: `object-src 'none'; frame-ancestors 'none'; base-uri 'self'; upgrade-insecure-requests`

### Discovery
- Static HTML + attribute / tag scanning
- (Optional) Runtime resource capture via Playwright (dynamic scripts, injected tags)
- Multi-page crawl (BFS) with configurable depth to union resources

### Analytics & Insight
- Directive-by-directive stats (counts, origin breakdown, hash ratios)
- Risk scoring heuristics (level + issues list) for each policy mode
- Risk deltas (Baseline → Strict) visualization
- Per-directive diff (added/removed sources between modes)
- Hide/filter directives in the UI
- Hash presence + external origin ratios

### Exports & Integration
- Copyable headers & diffs
- Multi-environment deployment snippets: Helmet (Express), nginx, Apache, Cloudflare, HTML meta tag
- JSON & CSV export (directive metrics)
- Policy selection for snippet generation (choose baseline or strict)
- LocalStorage persistence of last scan + UI state

### Other
- Additional security headers suggestions (Referrer-Policy, Permissions-Policy)
- Graceful runtime fallback if Playwright isn’t installed
- About page & lightweight theming

## Quick Start

### Web UI
```bash
git clone https://github.com/Habbi2/AutoCPS
cd AutoCPS
npm install
npm run dev
```
Visit http://localhost:3000 then enter a target URL. Toggle Strict / Runtime / Crawl Depth (e.g. 2) and compare:

Baseline ↔ Strict ↔ Existing (if present).

### Fast Example
```
autocsp https://example.com --strict --json > report.json
```
`report.json` now contains baseline+strict+diff+metrics for further automation.

## CLI Usage (Experimental)
```bash
npx ts-node src/cli.ts <url> [--strict] [--runtime] [--depth <n>] [--json]
```
Flags:
- `--strict`  Generate strict variant (self + hashes only for script/style)
- `--runtime` Attempt dynamic discovery via Playwright (if installed)
- `--depth`   Crawl depth (default 0 = single page)
- `--json`    Output structured JSON (baseline + strict + diffs)

## API Endpoint
`GET /api/csp?url=<target>&strict=<bool>&runtime=<bool>&depth=<n>`

### Query Parameters
| Param   | Type | Default | Description |
|---------|------|---------|-------------|
| `url`   | string | (required) | Target page to analyze |
| `strict`| boolean | false | If true, active policy = strict variant |
| `runtime` | boolean | false | Enable Playwright runtime capture (falls back if unavailable) |
| `depth` | number | 0 | Crawl depth (0 = just the page) |

### Response (abridged)
```json
{
	"input": "https://example.com",
	"finalUrl": "https://www.example.com/",
	"status": 200,
	"existing": "default-src 'self'",
	"baseline": {
		"policy": "default-src 'self'; ...",
		"diffExisting": { "added": [], "removed": [] },
		"risk": { "score": 38, "level": "medium", "issues": ["Wildcard * in img-src"] },
		"summaries": { "script-src": { "hashes": 5, "origins": 2, "externalOrigins": ["https://cdn.example"], "hashRatio": 0.71 } }
	},
	"strict": {
		"policy": "default-src 'self'; ...",
		"risk": { "score": 12, "level": "low", "issues": [] }
	},
	"diffModes": { "added": ["script-src 'sha256-...'"], "removed": ["script-src https://cdn.example"] },
	"runtimeStatus": "disabled | captured | unavailable",
	"crawl": { "depth": 1, "pages": 3 },
	"snippets": { "helmet": "helmet({contentSecurityPolicy: ...})", "nginx": "add_header Content-Security-Policy ..." },
	"headers": { "Referrer-Policy": "strict-origin-when-cross-origin" },
	"activeMode": "baseline",
	"policy": "default-src 'self'; ..."
}
```

## Example Policy Output
```
default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; script-src 'self' https://cdn.example.com 'sha256-AbCd...'; style-src 'self' 'sha256-XyZ...'; img-src 'self' data: https://img.cdn.com; connect-src 'self'; upgrade-insecure-requests
```

## Deployment (Vercel)
1. Import this repo into Vercel.
2. Build Command: `npm run build`
3. Output: Next.js App Router site + `/api/csp` endpoint.

### Example Curl
```bash
curl "https://<your-vercel-domain>/api/csp?url=https://example.com&strict=true&depth=1"
```

## Architecture Overview
- `src/fetch.ts` / `src/collect.ts` static HTML & tag scanning
- `src/runtime.ts` optional Playwright dynamic discovery (dynamic import)
- `src/crawl.ts` BFS crawl union of resource references by depth
- `src/builder.ts` directive assembly + strict tightening + existing diff
- `src/risk.ts` heuristic scoring / issues
- `src/snippets.ts` snippet generation for multiple environments
- `app/api/csp/route.ts` orchestrates request → result JSON
- `app/page.tsx` UI, state persistence, analytics panels & exports

## Risk Scoring (Heuristic)
Lower is better. Points are added for patterns like wildcards, broad `default-src`, external inline reliance, missing hardening directives, etc. Future versions may allow tuning weights.

## CSV / JSON Export
UI buttons let you download directive metrics for offline analysis or diffing in spreadsheets / scripts.

## Limitations / Notes
- Runtime mode depends on Playwright; not bundled by default to keep install light.
- Crawl depth > 2 can increase latency notably.
- Hashing large inline blocks has diminishing returns vs moving code to external files.
- Use strict mode progressively—verify no functional regressions before enforcing.

## Roadmap (Next)
- CSP report ingestion & adaptive tightening assistant
- Nonce + hybrid hash/nonce strategies
- Permission-Policy linter & recommendations
- SRI synergy & asset fingerprint diffusion
- GitHub Action PR reviewer (CSP suggestions)

## Contributing
Issues & ideas welcome. Open a discussion or PR—this is an early preview.

## License
MIT

## Social / Preview Assets
Planned OG image: side‑by‑side Baseline vs Strict diff with risk delta badge. (Add `/api/og` endpoint or static `/public/og.png`.)

## Acknowledgements
Built by Habbi Web Design. Feedback appreciated.
