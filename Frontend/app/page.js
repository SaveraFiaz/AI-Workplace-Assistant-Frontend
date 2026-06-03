import Link from 'next/link';

// No JSX outside component — icons rendered inline inside the component
const MODULES = [
  {
    title:     'Knowledge Search',
    description: 'Ask questions in plain English — AI instantly finds answers from your company documents, HR policies, and manuals.',
    iconPath:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    href:      '/knowledge-search',
    gradient:  'from-indigo-500 to-blue-600',
    glow:      'shadow-indigo-500/20',
    badge:     'RAG Powered',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  {
    title:     'Contract Analyzer',
    description: 'Upload any contract and AI detects risky clauses, auto-renewals, and hidden terms — explained in plain language.',
    iconPath:  'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    href:      '/contract-analyzer',
    gradient:  'from-violet-500 to-purple-600',
    glow:      'shadow-violet-500/20',
    badge:     'Risk Detection',
    badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  },
  {
    title:     'Email Reply Assistant',
    description: 'Paste any email and get formal, polite, and firm AI-generated reply options — ready to send in seconds.',
    iconPath:  'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    href:      '/email-reply',
    gradient:  'from-cyan-500 to-teal-600',
    glow:      'shadow-cyan-500/20',
    badge:     'Multi-tone',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950">

      {/* Hero */}
      <section className="relative animated-gradient overflow-hidden">
        <div className="orb w-96 h-96 bg-indigo-600 top-[-80px] left-[-80px]" />
        <div className="orb w-80 h-80 bg-violet-600 bottom-[-60px] right-[-60px]" />
        <div className="orb w-64 h-64 bg-cyan-500 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="relative max-w-7xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Enterprise AI Productivity Platform
          </div>

          <h1 className="text-6xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight">
            Your AI-Powered
            <br />
            <span className="gradient-text">Workplace Assistant</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Instantly find information, analyze contracts with confidence,
            and create professional responses from a single intelligent workspace.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/knowledge-search" className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all duration-200">
              Get Started
            </Link>
            <Link href="/contract-analyzer" className="px-8 py-3.5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 hover:border-white/40 transition-all duration-200">
              Analyze a Contract →
            </Link>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="bg-slate-950 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-400 font-semibold text-sm uppercase tracking-widest mb-3">Platform Modules</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Everything in One Place</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">Powerful AI capabilities working together in a single intelligent platform.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MODULES.map((mod) => (
              <div key={mod.href} className={`card-hover group relative bg-slate-900 border border-white/5 rounded-2xl p-8 shadow-2xl ${mod.glow}`}>
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={mod.iconPath} />
                  </svg>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border mb-4 ${mod.badgeColor}`}>
                  {mod.badge}
                </span>
                <h3 className="text-xl font-bold text-white mb-3">{mod.title}</h3>
                <p className="text-slate-400 leading-relaxed mb-8 text-sm">{mod.description}</p>
                <Link href={mod.href} className={`block w-full py-3 rounded-xl font-semibold text-sm text-white text-center bg-gradient-to-r ${mod.gradient} opacity-90 hover:opacity-100 hover:shadow-lg transition-all duration-200`}>
                  Launch {mod.title} →
                </Link>
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${mod.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
