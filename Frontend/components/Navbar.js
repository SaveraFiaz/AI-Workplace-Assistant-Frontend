'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/knowledge-search', label: 'Knowledge Search' },
  { href: '/contract-analyzer', label: 'Contract Analyzer' },
  { href: '/email-reply', label: 'Email Reply' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">

        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">
            AI<span className="gradient-text">Assist</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              pathname === '/'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Dashboard
          </Link>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname === link.href
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
