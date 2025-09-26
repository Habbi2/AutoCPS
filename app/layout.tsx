import './globals.css';
import React from 'react';

export const metadata = {
  title: 'AutoCSP – Generate Content-Security-Policy',
  description: 'Generate baseline or strict CSP headers (hashing inline scripts/styles) from any URL.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <header className="mb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">AutoCSP</h1>
                <p className="text-slate-400 mt-2 text-sm">Baseline & strict Content-Security-Policy suggestions with inline hash generation.</p>
              </div>
              <nav className="flex flex-wrap gap-3 text-xs md:text-[11px] font-medium">
                <a href="/" className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700">Home</a>
                <a href="/about" className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700">About</a>
                <a href="https://www.habbiwebdesign.site/" target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-700/40">Habbi Web Design ↗</a>
              </nav>
            </div>
          </header>
          {children}
          <footer className="mt-16 text-xs text-slate-500 flex flex-col gap-2">
            <div>MIT Licensed · Early Preview</div>
            <div className="flex flex-wrap gap-4">
              <a href="/about" className="hover:text-slate-300">About</a>
              <a href="https://www.habbiwebdesign.site/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">habbiwebdesign.site</a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
