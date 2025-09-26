import React from 'react';

export const metadata = {
  title: 'About – AutoCSP',
  description: 'Learn about the AutoCSP tool.'
};

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">About AutoCSP</h2>
      <p className="text-sm text-slate-300 leading-relaxed">
        AutoCSP is an experimental tool that helps you rapidly generate and refine Content-Security-Policy (CSP) headers by
        analyzing a target site. It produces both a baseline and a stricter hash-only variant, highlights differences, and
        surfaces risk heuristics, directive stats, and deployment snippets for multiple environments.
      </p>
      <p className="text-sm text-slate-300 leading-relaxed">
        The goal is to accelerate adoption of strong CSPs by making discovery, hashing inline code, and evaluating tradeoffs more
        approachable. Features like crawl-based aggregation, runtime resource discovery, policy diffing, and risk deltas are
        meant to give you confidence before rolling a policy out in report-only or enforcement mode.
      </p>
      <p className="text-sm text-slate-300 leading-relaxed">
        Built by <a href="https://www.habbiwebdesign.site/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Habbi Web Design</a>. Visit the site to learn more about other projects and services.
      </p>
      <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
        MIT Licensed · This is an early preview—feedback and ideas are welcome.
      </div>
    </div>
  );
}
