# AutoCSP (Early Preview)

Generate a sensible Content-Security-Policy for any public URL.

## Why
Hand-authoring CSPs is tedious; teams either ship nothing or copy a permissive template. AutoCSP inspects the page and proposes a policy using self + precise hashes and discovered origins.

## Features
- Baseline & Strict policies generated side-by-side
- Detect existing CSP & show diffs vs both modes
- Hash all inline scripts & styles (SHA-256)
- Baseline hardening: `object-src 'none'; frame-ancestors 'none'; base-uri 'self'; upgrade-insecure-requests`
- Strict mode automatically removes external script/style origins (self + hashes only)
- Diff: existing vs each mode AND baseline vs strict
- Additional security headers suggestions (Referrer-Policy, Permissions-Policy)
- Copy buttons for active/baseline/strict/diff/headers
- JSON API & CLI output
- (Experimental) Runtime discovery flag (`--runtime` / `runtime=true`) to execute page with Playwright and include dynamically injected resources

## Local Dev (Web UI + CLI)
Install deps then start the Next.js dev server (web UI at http://localhost:3000):
```bash
npm install
npm run dev
```

Open the browser form and enter a URL. Toggle Strict to see tightened policy. Copy buttons let you grab any variant. Runtime checkbox (coming online) will attempt dynamic capture when Playwright is available.

CLI still works (direct TypeScript):
```bash
npm run dev:cli -- https://example.com --strict --json
```

### CLI Usage (after build or via npx)
```bash
autocsp <url> [--strict] [--runtime] [--json]
```

## Example Output
```
Proposed Content-Security-Policy:

default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; script-src 'self' https://cdn.example.com 'sha256-AbCd...'; style-src 'self' 'sha256-XyZ...'; img-src 'self' data: https://img.cdn.com; connect-src 'self'; upgrade-insecure-requests
```

## Deploy on Vercel
1. Create a new Vercel project pointing at this repo.
2. Build Command: `npm run build`.
3. The site UI will be served (Next.js) and the API route is `/api/csp`.

You can still call the API directly or use the form UI.

### Example Request
```bash
curl "https://<your-vercel-domain>/api/csp?url=https://example.com"
```
Add `&strict=true` for strict hashing mode. Add `&runtime=true` to attempt dynamic resource discovery (requires Playwright in the deployment environment; falls back silently if absent).

### Response Shape (abridged)
```json
{
	"input": "https://example.com",
	"finalUrl": "https://www.example.com/",
	"status": 200,
	"existing": "default-src 'self'",
	"baseline": { "policy": "default-src 'self'; ...", "diffExisting": {"added":[],"removed":[]}, "notes": [] },
	"strict": { "policy": "default-src 'self'; ...", "diffExisting": {"added":["script-src 'sha256-...'"]}, "notes": ["Strict mode: external script/style origins removed; only self + hashes allowed."] },
	"diffModes": { "added": ["script-src 'sha256-...'"], "removed": ["script-src https://cdn.example"] },
	"headers": { "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "accelerometer=(), ..." },
	"policy": "default-src 'self'; ...", // active (depends on strict param)
	"activeMode": "baseline"
}
```

### Caching
Responses are cached at the edge for 10 minutes (`s-maxage=600`). Re-run after changes to update.

## Roadmap
- CSP report ingestion + violation analytics (report-to / reporting endpoint)
- Nonce option & mixed hash+nonce strategies
- Progressive tightening assistant (remove unused origins iteratively)
- Export as Helm values / Terraform snippet / nginx & Apache config
- GitHub Action comment bot (PR diff recommending tighter CSP)
- Permissions-Policy linter (detect overly broad directives)
- Service Worker script handling & subresource integrity synergy

## License
MIT
