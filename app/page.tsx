'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { buildSnippets } from '../src/snippets';

interface PolicyModeInfo { policy: string; notes: string[]; diffExisting?: { added: string[]; removed: string[] }; }
interface ApiResult {
  policy: string; // active policy
  notes: string[]; // active notes
  activeMode: 'baseline' | 'strict';
  baseline: PolicyModeInfo;
  strict: PolicyModeInfo;
  diffModes: { added: string[]; removed: string[] };
  headers: Record<string,string>;
  existing?: string;
  finalUrl?: string;
  input?: string;
  status?: number;
  runtime?: boolean;
  runtimeStatus?: 'disabled' | 'ok' | 'unavailable';
  crawl?: { depth: number; pages: string[]; count: number };
  risk?: { active: RiskResult; baseline: RiskResult; strict: RiskResult };
  summaries?: { baseline: Record<string,SummaryEntry>; strict: Record<string,SummaryEntry> };
}

interface RiskResult { score: number; level: 'low' | 'medium' | 'high'; issues: string[]; }
interface SummaryEntry { sources: number; hashes: number; origins: number; wildcards: number; }

function copy(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text: string) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  } catch {}
}
function diffText(diff: { added: string[]; removed: string[] }) {
  return [
    ...diff.added.map(a => '+ ' + a),
    ...diff.removed.map(r => '- ' + r)
  ].join('\n');
}
function headersText(h: Record<string,string>) {
  return Object.entries(h).map(([k,v]) => `${k}: ${v}`).join('\n');
}

export default function Page() {
  const [url, setUrl] = useState('');
  const [strict, setStrict] = useState(false);
  const [runtime, setRuntime] = useState(false);
  const [loading, setLoading] = useState(false);
  const [depth, setDepth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [snippetMode, setSnippetMode] = useState<'baseline'|'strict'>('baseline');
  const [showRiskDelta, setShowRiskDelta] = useState(false);
  const [dirFilter, setDirFilter] = useState('');
  const [hiddenDirectives, setHiddenDirectives] = useState<string[]>([]);
  const [showDirDiff, setShowDirDiff] = useState(false);
  const snippets = useMemo(() => {
    if (!result) return null;
    const policy = snippetMode === 'strict' ? result.strict.policy : result.baseline.policy;
    return buildSnippets(policy, result.headers || {});
  }, [result, snippetMode]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setLoading(true); setError(null); setResult(null);
    try {
  const r = await fetch(`/api/csp?url=${encodeURIComponent(url)}${strict ? '&strict=true' : ''}${runtime ? '&runtime=true' : ''}${depth>0 ? `&depth=${depth}` : ''}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  // Persist & restore last scan and UI prefs
  useEffect(() => {
    try {
      const saved = localStorage.getItem('autocsp:last');
      if (saved) {
        const parsed = JSON.parse(saved);
        setResult(parsed.result);
        setUrl(parsed.url || '');
        setSnippetMode(parsed.snippetMode || 'baseline');
        setStrict(parsed.strict || false);
        setRuntime(parsed.runtime || false);
        setDepth(parsed.depth || 0);
        setShowRiskDelta(parsed.showRiskDelta || false);
        setHiddenDirectives(parsed.hiddenDirectives || []);
        setShowDirDiff(parsed.showDirDiff || false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!result) return;
    try {
      localStorage.setItem('autocsp:last', JSON.stringify({
        result, url, snippetMode, strict, runtime, depth, showRiskDelta, hiddenDirectives, showDirDiff
      }));
    } catch {}
  }, [result, url, snippetMode, strict, runtime, depth, showRiskDelta, hiddenDirectives, showDirDiff]);

  return (
    <div>
      <form onSubmit={run} className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">URL</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex flex-wrap gap-6 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input id="strict" type="checkbox" checked={strict} onChange={e => setStrict(e.target.checked)} className="h-4 w-4" />
            <span>Strict (only 'self' + hashes)</span>
          </label>
          <label className="flex items-center gap-2 text-sm" title="Execute page to capture dynamically added resources (slower)">
            <input type="checkbox" checked={runtime} onChange={e => setRuntime(e.target.checked)} className="h-4 w-4" />
            <span>Runtime (Playwright)</span>
          </label>
          <label className="flex items-center gap-2 text-sm" title="Breadth-first crawl depth for same-origin pages (0 = disabled)">
            <span>Depth</span>
            <select value={depth} onChange={e => setDepth(parseInt(e.target.value))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs">
              {[0,1,2,3].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>
        <button disabled={loading} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium">{loading ? 'Generating…' : 'Generate CSP'}</button>
      </form>
      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
      {result && (
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="font-semibold text-lg">Policies</h2>
              {result.runtimeStatus && (
                <span className={`text-[10px] px-2 py-1 rounded border tracking-wide uppercase font-semibold ${result.runtimeStatus==='ok' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40' : result.runtimeStatus==='unavailable' ? 'bg-amber-600/20 text-amber-300 border-amber-600/40' : 'bg-slate-700/40 text-slate-300 border-slate-600'}`}>{result.runtimeStatus==='ok' ? 'Runtime Active' : result.runtimeStatus==='unavailable' ? 'Runtime Fallback' : 'Runtime Off'}</span>
              )}
              {result.crawl && (
                <span className="text-[10px] px-2 py-1 rounded border border-slate-600 bg-slate-700/40 text-slate-300">Crawl {result.crawl.depth}d / {result.crawl.count} page{result.crawl.count!==1?'s':''}</span>
              )}
              {result.risk && (
                <RiskBadge risk={strict ? result.risk.strict : result.risk.baseline} />
              )}
              <div className="flex gap-2 text-xs bg-slate-800/60 p-1 rounded border border-slate-700">
                <button type="button" onClick={() => setStrict(false)} className={`px-2 py-1 rounded ${!strict ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700'}`}>Baseline</button>
                <button type="button" onClick={() => setStrict(true)}  className={`px-2 py-1 rounded ${strict ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700'}`}>Strict</button>
              </div>
              <button type="button" onClick={() => copy(result.policy)} className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600">Copy Active</button>
              <button type="button" onClick={() => copy(result.baseline.policy)} className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600">Copy Baseline</button>
              <button type="button" onClick={() => copy(result.strict.policy)} className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600">Copy Strict</button>
            </div>
            <div>
              <h3 className="font-medium text-sm mb-1">Active Policy ({strict ? 'Strict' : 'Baseline'})</h3>
              <pre className="p-4 bg-slate-900 rounded overflow-x-auto text-xs whitespace-pre-wrap break-words border border-slate-700">
{result.policy}
              </pre>
            </div>
            {result.baseline.policy !== result.strict.policy && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium text-xs mb-1">Baseline</h4>
                  <pre className="p-3 bg-slate-900 rounded text-[11px] whitespace-pre-wrap border border-slate-800 max-h-64 overflow-auto">{result.baseline.policy}</pre>
                </div>
                <div>
                  <h4 className="font-medium text-xs mb-1">Strict</h4>
                  <pre className="p-3 bg-slate-900 rounded text-[11px] whitespace-pre-wrap border border-slate-800 max-h-64 overflow-auto">{result.strict.policy}</pre>
                </div>
              </div>
            )}
          </section>
          {result.diffModes && (result.diffModes.added.length || result.diffModes.removed.length) && (
            <section>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold">Baseline vs Strict Diff</h3>
                <button type="button" onClick={() => copy(diffText(result.diffModes))} className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600">Copy Diff</button>
              </div>
              <div className="grid gap-2 text-xs">
                {result.diffModes.added.map(a => <div key={a} className="text-green-400">+ {a}</div>)}
                {result.diffModes.removed.map(d => <div key={d} className="text-rose-400">- {d}</div>)}
              </div>
            </section>
          )}
          {result.existing && (
            <section>
              <h3 className="font-semibold mb-2">Existing Policy</h3>
              <pre className="p-3 bg-slate-900 rounded text-xs whitespace-pre-wrap break-words border border-slate-800">{result.existing}</pre>
            </section>
          )}
          {result.headers && (
            <section>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold">Additional Headers</h3>
                <button type="button" onClick={() => copy(headersText(result.headers))} className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600">Copy All</button>
              </div>
              <div className="space-y-2 text-xs">
                {Object.entries(result.headers).map(([k,v]) => (
                  <div key={k} className="border border-slate-800 rounded p-2 bg-slate-900/60">
                    <div className="font-mono break-all"><span className="text-slate-400">{k}:</span> {v}</div>
                    <button type="button" onClick={() => copy(`${k}: ${v}`)} className="mt-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600">Copy</button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {result.risk && (
            <section>
              <h3 className="font-semibold mb-2">Risk Assessment ({strict ? 'Strict' : 'Baseline'})</h3>
              <div className="text-xs flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <RiskBadge risk={strict ? result.risk.strict : result.risk.baseline} />
                  <span className="text-slate-400">Score is heuristic (100 best). Lower score indicates potential weaknesses.</span>
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {(strict ? result.risk.strict.issues : result.risk.baseline.issues).map(i => <li key={i}>{i}</li>)}
                </ul>
              </div>
            </section>
          )}
          {result.summaries && (
            <section>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h3 className="font-semibold">Directive Summary ({strict ? 'Strict' : 'Baseline'} Policy)</h3>
                <input value={dirFilter} onChange={e=>setDirFilter(e.target.value)} placeholder="filter (e.g. script)" className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700" />
                <ExportButton result={result} />
                <CSVButton result={result} />
                <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                  <input type="checkbox" className="h-3 w-3" checked={showDirDiff} onChange={e=>setShowDirDiff(e.target.checked)} />
                  <span>Show diff</span>
                </label>
              </div>
              <HideDirectiveSelector summaries={result.summaries!} hidden={hiddenDirectives} toggle={(d)=> setHiddenDirectives(h => h.includes(d)? h.filter(x=>x!==d): [...h,d])} />
              <DirectiveSummary table={(strict ? result.summaries!.strict : result.summaries!.baseline)} filter={dirFilter} hidden={hiddenDirectives} />
              {showDirDiff && <DirectiveDiff baseline={result.summaries!.baseline} strictSum={result.summaries!.strict} hidden={hiddenDirectives} />}
              <HashSummary summaries={result.summaries} />
            </section>
          )}
          {result.risk && showRiskDelta && (
            <section>
              <h3 className="font-semibold mb-2">Risk Delta (Strict vs Baseline)</h3>
              <RiskDelta base={result.risk.baseline} strict={result.risk.strict} />
            </section>
          )}
          {snippets && (
            <section>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold">Deployment Snippets</h3>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-400">Policy:</span>
                  <select value={snippetMode} onChange={e=>setSnippetMode(e.target.value as any)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1">
                    <option value="baseline">Baseline</option>
                    <option value="strict">Strict</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SnippetBlock title="Helmet / Express" code={snippets.helmet} />
                <SnippetBlock title="nginx" code={snippets.nginx} />
                <SnippetBlock title="Apache" code={snippets.apache} />
                <SnippetBlock title="Cloudflare Transform" code={snippets.cloudflare} />
              </div>
              <div className="mt-4">
                <h4 className="text-xs font-semibold mb-1">Meta (not recommended for strict deployments)</h4>
                <pre className="p-3 bg-slate-900 rounded text-[11px] whitespace-pre-wrap border border-slate-800 overflow-auto">{snippets.meta}</pre>
                <button type="button" onClick={() => copy(snippets.meta)} className="mt-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600">Copy Meta</button>
              </div>
            </section>
          )}
          {result.notes.length > 0 && (
            <section>
              <h3 className="font-semibold mb-2">Notes</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                {result.notes.map(n => <li key={n}>{n}</li>)}
              </ul>
              <div className="mt-3 flex items-center gap-2 text-[10px]">
                {result.risk && (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" className="h-3 w-3" checked={showRiskDelta} onChange={e=>setShowRiskDelta(e.target.checked)} />
                    <span>Show risk delta</span>
                  </label>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskResult }) {
  const color = risk.level === 'low' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40' : risk.level === 'medium' ? 'bg-amber-600/20 text-amber-300 border-amber-600/40' : 'bg-rose-600/20 text-rose-300 border-rose-600/40';
  return <span className={`text-[10px] px-2 py-1 rounded border font-semibold tracking-wide ${color}`}>Risk {risk.level.toUpperCase()} {risk.score}</span>;
}

function SnippetBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold">{title}</h4>
        <button type="button" onClick={() => copy(code)} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600">Copy</button>
      </div>
      <pre className="p-3 bg-slate-900 rounded text-[11px] whitespace-pre overflow-auto border border-slate-800 max-h-64">{code}</pre>
    </div>
  );
}

function DirectiveSummary({ table, filter, hidden }: { table: Record<string, SummaryEntry>; filter?: string; hidden?: string[] }) {
  let entries = Object.entries(table).sort();
  if (filter) {
    const f = filter.toLowerCase();
    entries = entries.filter(([k]) => k.toLowerCase().includes(f));
  }
  if (hidden && hidden.length) entries = entries.filter(([k]) => !hidden.includes(k));
  return (
    <div className="overflow-auto border border-slate-800 rounded bg-slate-900/50">
      <table className="min-w-full text-[10px]">
        <thead className="bg-slate-800/60">
          <tr className="text-left">
            <th className="px-2 py-1 font-semibold">Directive</th>
            <th className="px-2 py-1 font-semibold">Sources</th>
            <th className="px-2 py-1 font-semibold">Hashes</th>
            <th className="px-2 py-1 font-semibold">Origins</th>
            <th className="px-2 py-1 font-semibold">Wildcards</th>
            <th className="px-2 py-1 font-semibold">Hash %</th>
            <th className="px-2 py-1 font-semibold">Origin %</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([k,v]) => (
            <tr key={k} className="odd:bg-slate-900 even:bg-slate-900/70">
              <td className="px-2 py-1 font-mono whitespace-nowrap">{k}</td>
              <td className="px-2 py-1">{v.sources}</td>
              <td className="px-2 py-1">{v.hashes}</td>
              <td className="px-2 py-1">{v.origins}</td>
              <td className="px-2 py-1">{v.wildcards}</td>
              <td className="px-2 py-1 w-24">
                <Bar value={v.sources? (v.hashes / v.sources) : 0} color="emerald" />
              </td>
              <td className="px-2 py-1 w-24">
                <Bar value={v.sources? (v.origins / v.sources) : 0} color="indigo" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HashSummary({ summaries }: { summaries: ApiResult['summaries'] }) {
  if (!summaries) return null;
  const b = summaries.baseline; const s = summaries.strict;
  function countHashes(tbl: Record<string, SummaryEntry>) {
    return Object.values(tbl).reduce((acc, v) => acc + v.hashes, 0);
  }
  const baselineHashes = countHashes(b);
  const strictHashes = countHashes(s);
  return (
    <div className="mt-3 text-[10px] flex gap-4 flex-wrap text-slate-300">
      <div className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700">Baseline hashes: {baselineHashes}</div>
      <div className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700">Strict hashes: {strictHashes}</div>
      <div className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700">Delta: {strictHashes - baselineHashes}</div>
    </div>
  );
}

function RiskDelta({ base, strict }: { base: RiskResult; strict: RiskResult }) {
  const added = strict.issues.filter(i => !base.issues.includes(i));
  const resolved = base.issues.filter(i => !strict.issues.includes(i));
  const scoreDelta = strict.score - base.score;
  const scoreColor = scoreDelta > 0 ? 'bg-emerald-600/30 text-emerald-200 border-emerald-600/40' : scoreDelta < 0 ? 'bg-rose-600/30 text-rose-200 border-rose-600/40' : 'bg-slate-700/60 text-slate-300 border-slate-600';
  return (
    <div className="text-[11px] flex flex-col gap-2">
      <div className="flex gap-3 flex-wrap">
        <span className={`px-2 py-1 rounded border ${scoreColor}`}>Score Δ: {base.score} → {strict.score} ({scoreDelta >=0? '+'+scoreDelta: scoreDelta})</span>
        <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700">Issues: {base.issues.length} → {strict.issues.length}</span>
      </div>
      {added.length > 0 && (
        <div>
          <div className="text-rose-300 font-semibold mb-1">New Issues in Strict</div>
          <ul className="list-disc pl-5 space-y-1">{added.map(i => <li key={i}>{i}</li>)}</ul>
        </div>
      )}
      {resolved.length > 0 && (
        <div>
          <div className="text-emerald-300 font-semibold mb-1">Resolved from Baseline</div>
          <ul className="list-disc pl-5 space-y-1">{resolved.map(i => <li key={i}>{i}</li>)}</ul>
        </div>
      )}
      {added.length === 0 && resolved.length === 0 && <div className="text-slate-400">No issue set changes between modes.</div>}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: 'emerald' | 'indigo' }) {
  const pct = Math.round(value * 100);
  const barColor = color === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500';
  return (
    <div className="w-full bg-slate-800 rounded h-3 relative overflow-hidden">
      <div className={`${barColor} h-full`} style={{ width: pct + '%' }} />
      <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/80 mix-blend-difference">{pct}%</span>
    </div>
  );
}

function ExportButton({ result }: { result: ApiResult }) {
  function download() {
    const blob = new Blob([JSON.stringify({
      url: result.finalUrl || result.input,
      generatedAt: new Date().toISOString(),
      policies: { baseline: result.baseline.policy, strict: result.strict.policy },
      risk: result.risk,
      summaries: result.summaries,
      headers: result.headers,
      crawl: result.crawl
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'csp-report.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  }
  return <button type="button" onClick={download} className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700">Export JSON</button>;
}

function CSVButton({ result }: { result: ApiResult }) {
  function download() {
    const rows: string[] = [];
    rows.push(['directive','mode','sources','hashes','origins','wildcards'].join(','));
    const modes: [string, Record<string, SummaryEntry>][] = [
      ['baseline', result.summaries?.baseline || {}],
      ['strict', result.summaries?.strict || {}]
    ];
    for (const [mode, tbl] of modes) {
      for (const [dir, s] of Object.entries(tbl)) {
        rows.push([dir, mode, s.sources, s.hashes, s.origins, s.wildcards].join(','));
      }
    }
    if (result.risk) {
      rows.push('');
      rows.push('risk,mode,score,issues');
      rows.push(['risk','baseline',result.risk.baseline.score, JSON.stringify(result.risk.baseline.issues).replace(/,/g,';')].join(','));
      rows.push(['risk','strict',result.risk.strict.score, JSON.stringify(result.risk.strict.issues).replace(/,/g,';')].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'csp-summary.csv';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  }
  return <button type="button" onClick={download} className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700">CSV</button>;
}

function HideDirectiveSelector({ summaries, hidden, toggle }: { summaries: NonNullable<ApiResult['summaries']>; hidden: string[]; toggle: (d: string)=>void }) {
  const allDirs = Array.from(new Set([...Object.keys(summaries.baseline), ...Object.keys(summaries.strict)])).sort();
  return (
    <div className="flex flex-wrap gap-2 text-[10px] mb-2">
      {allDirs.map(d => (
        <label key={d} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/60 border border-slate-700 cursor-pointer">
          <input type="checkbox" className="h-3 w-3" checked={!hidden.includes(d)} onChange={() => toggle(d)} />
          <span>{d}</span>
        </label>
      ))}
    </div>
  );
}

function DirectiveDiff({ baseline, strictSum, hidden }: { baseline: Record<string, SummaryEntry>; strictSum: Record<string, SummaryEntry>; hidden: string[] }) {
  const dirs = Array.from(new Set([...Object.keys(baseline), ...Object.keys(strictSum)])).sort().filter(d => !hidden.includes(d));
  return (
    <div className="overflow-auto border border-slate-800 rounded bg-slate-900/50 mt-4">
      <table className="min-w-full text-[10px]">
        <thead className="bg-slate-800/60">
          <tr className="text-left">
            <th className="px-2 py-1 font-semibold">Directive</th>
            <th className="px-2 py-1 font-semibold">Base Hashes</th>
            <th className="px-2 py-1 font-semibold">Strict Hashes</th>
            <th className="px-2 py-1 font-semibold">Δ Hash</th>
            <th className="px-2 py-1 font-semibold">Base Origins</th>
            <th className="px-2 py-1 font-semibold">Strict Origins</th>
            <th className="px-2 py-1 font-semibold">Δ Origins</th>
            <th className="px-2 py-1 font-semibold">Base Wildcards</th>
            <th className="px-2 py-1 font-semibold">Strict Wildcards</th>
            <th className="px-2 py-1 font-semibold">Δ Wildcards</th>
          </tr>
        </thead>
        <tbody>
          {dirs.map(d => {
            const b = baseline[d] || {sources:0,hashes:0,origins:0,wildcards:0};
            const s = strictSum[d] || {sources:0,hashes:0,origins:0,wildcards:0};
            const dh = s.hashes - b.hashes;
            const doo = s.origins - b.origins;
            const dw = s.wildcards - b.wildcards;
            const color = (n:number)=> n>0? 'text-emerald-300': n<0? 'text-rose-300':'text-slate-400';
            return (
              <tr key={d} className="odd:bg-slate-900 even:bg-slate-900/70">
                <td className="px-2 py-1 font-mono whitespace-nowrap">{d}</td>
                <td className="px-2 py-1">{b.hashes}</td>
                <td className="px-2 py-1">{s.hashes}</td>
                <td className={`px-2 py-1 ${color(dh)}`}>{dh>=0? '+'+dh: dh}</td>
                <td className="px-2 py-1">{b.origins}</td>
                <td className="px-2 py-1">{s.origins}</td>
                <td className={`px-2 py-1 ${color(doo)}`}>{doo>=0? '+'+doo: doo}</td>
                <td className="px-2 py-1">{b.wildcards}</td>
                <td className="px-2 py-1">{s.wildcards}</td>
                <td className={`px-2 py-1 ${color(dw)}`}>{dw>=0? '+'+dw: dw}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
