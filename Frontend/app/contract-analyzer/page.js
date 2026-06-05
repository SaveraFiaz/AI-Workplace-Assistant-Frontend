'use client';
import { useState, useRef } from 'react';

const API = 'https://ai-workplace-assistant-frontend-61n2.onrender.com/api';

const RISK_STYLE = {
  High:   { badge: 'bg-red-500/10 text-red-400 border-red-500/20',     dot: 'bg-red-400' },
  Medium: { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
  Low:    { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
};

const OPTIONS = [
  {
    id:          'summary',
    label:       'Contract Summary',
    description: 'Plain English overview of the entire contract.',
    color:       { active: 'border-violet-500/50 bg-violet-500/5', icon: 'bg-violet-600', text: 'text-violet-400', dot: 'bg-violet-400' },
  },
  {
    id:          'risks',
    label:       'Risky Clauses',
    description: 'Flags auto-renewal, penalties, liability limits & hidden charges.',
    color:       { active: 'border-red-500/50 bg-red-500/5', icon: 'bg-red-600', text: 'text-red-400', dot: 'bg-red-400' },
  },
  {
    id:          'legal_terms',
    label:       'Legal-Term Explanations',
    description: 'Complex legal jargon translated into simple language.',
    color:       { active: 'border-cyan-500/50 bg-cyan-500/5', icon: 'bg-cyan-600', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  },
  {
    id:          'questions',
    label:       'Questions Before Signing',
    description: 'Key questions you should ask before you sign.',
    color:       { active: 'border-amber-500/50 bg-amber-500/5', icon: 'bg-amber-600', text: 'text-amber-400', dot: 'bg-amber-400' },
  },
];

export default function ContractAnalyzer() {
  const [file,        setFile]        = useState(null);
  const [selected,    setSelected]    = useState(new Set(['summary', 'risks', 'legal_terms', 'questions']));
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [termInput,   setTermInput]   = useState('');
  const [termResult,  setTermResult]  = useState(null);
  const [termLoading, setTermLoading] = useState(false);
  const [termHistory, setTermHistory] = useState([]);
  const fileRef  = useRef(null);
  const termRef  = useRef(null);

  const toggleOption = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || selected.size === 0) return;
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('analysis_types', JSON.stringify([...selected]));
    try {
      const res  = await fetch(`${API}/contract-analyzer`, { method: 'POST', body: fd });
      const data = await res.json();
      setResult(!res.ok ? { error: data.detail || data.error || 'Analysis failed.' } : data);
    } catch {
      setResult({ error: 'Cannot reach backend. Make sure the server is running on port 8000.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTermSearch = async (e) => {
    e.preventDefault();
    const term = termInput.trim();
    if (!term) return;
    setTermLoading(true);
    setTermResult(null);
    try {
      const res  = await fetch(`${API}/contract-analyzer/explain-term`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term }),
      });
      const data = await res.json();
      setTermResult(data);
      setTermHistory(prev => [term, ...prev.filter(t => t !== term)].slice(0, 5));
      setTermInput('');
    } catch {
      setTermResult({ term, simple_meaning: 'Failed to connect to backend.' });
    } finally {
      setTermLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-950">

      {/* Header */}
      <div className="border-b border-white/5 bg-slate-900/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Contract Analyzer</h1>
            <p className="text-slate-400 text-sm">Upload a contract, choose what to analyze, get AI insights</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* File Upload */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
            <p className="text-sm font-semibold text-slate-300 mb-4">Upload Contract</p>
            <div className="file-drop-zone relative flex flex-col items-center gap-3" style={{ minHeight: '130px', justifyContent: 'center' }}>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={e => {
                  const f = e.target.files && e.target.files[0];
                  if (f) setFile(f);
                }}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer', zIndex: 10,
                }}
              />
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center pointer-events-none">
                <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              {file ? (
                <div className="text-center pointer-events-none">
                  <p className="text-violet-400 font-semibold">{file.name}</p>
                  <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB — ready to analyze</p>
                </div>
              ) : (
                <div className="text-center pointer-events-none">
                  <p className="text-slate-300 font-medium">Click to select your contract</p>
                  <p className="text-slate-500 text-sm mt-1">PDF or DOCX · Max 10 MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Analysis Options */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold text-slate-300">What do you want to analyze?</p>
                <p className="text-xs text-slate-500 mt-0.5">Select at least one option</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(
                  selected.size === OPTIONS.length
                    ? new Set([OPTIONS[0].id])
                    : new Set(OPTIONS.map(o => o.id))
                )}
                className="text-xs font-semibold text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-400/50 px-3 py-1.5 rounded-lg transition-all"
              >
                {selected.size === OPTIONS.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OPTIONS.map(opt => {
                const active = selected.has(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleOption(opt.id)}
                    className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-150 ${
                      active ? opt.color.active : 'border-white/5 bg-slate-800/30 hover:bg-slate-800/60 hover:border-white/10'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? opt.color.icon : 'bg-slate-700'}`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold mb-0.5 ${active ? opt.color.text : 'text-slate-300'}`}>{opt.label}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{opt.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      active ? `${opt.color.icon} border-transparent` : 'border-slate-600'
                    }`}>
                      {active && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-2 mt-4">
              {OPTIONS.map(opt => (
                <div key={opt.id} className={`h-1 w-8 rounded-full transition-all ${selected.has(opt.id) ? opt.color.dot : 'bg-slate-700'}`} />
              ))}
              <span className="text-xs text-slate-500 ml-1">{selected.size} of {OPTIONS.length} selected</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !file || selected.size === 0}
            className="w-full py-3.5 rounded-xl font-semibold text-white text-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 shadow-lg shadow-violet-500/20 transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Analyzing Contract...</span>
            ) : `Analyze Contract (${selected.size} ${selected.size === 1 ? 'section' : 'sections'}) →`}
          </button>
        </form>

        {/* Loading Banner */}
        {loading && (
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="mt-0.5"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
              <div>
                <p className="text-white font-semibold text-sm">AI is reading your contract...</p>
                <p className="text-violet-300 text-xs mt-1">This takes 15–30 seconds. Please wait and do not close the page.</p>
              </div>
            </div>
            <div className="space-y-2 pl-8">
              {[...selected].map(type => {
                const label = { summary: 'Generating summary', risks: 'Detecting risky clauses', legal_terms: 'Explaining legal terms', questions: 'Preparing questions' }[type] || type;
                return (
                  <div key={type} className="flex items-center gap-2 text-xs text-violet-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">

            {/* Error */}
            {result.error && (
              <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-6 flex items-center gap-3 text-red-400">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{result.error}</p>
              </div>
            )}

            {/* Summary */}
            {!result.error && result.summary && (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-violet-400" />
                  <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Contract Summary</h2>
                </div>
                <p className="text-slate-300 leading-relaxed">{result.summary}</p>
              </div>
            )}

            {/* Risks */}
            {!result.error && result.risks?.length > 0 && (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Risky Clauses Detected</h2>
                  <span className="ml-auto bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold px-2.5 py-0.5 rounded-full">{result.risks.length} found</span>
                </div>
                <div className="space-y-4">
                  {result.risks.map((risk, i) => {
                    const cfg = RISK_STYLE[risk.level] || RISK_STYLE.Medium;
                    return (
                      <div key={i} className="bg-slate-800/50 rounded-xl p-5 border border-white/5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                            <h3 className="font-semibold text-white text-sm">{risk.clause}</h3>
                          </div>
                          <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.badge}`}>{risk.level} Risk</span>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed mb-4">{risk.explanation}</p>
                        {risk.steps?.length > 0 && (
                          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">What You Should Do</p>
                            </div>
                            <div className="space-y-2.5">
                              {risk.steps.map((step, si) => (
                                <div key={si} className="flex items-start gap-3">
                                  <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0 mt-0.5">{si + 1}</div>
                                  <p className="text-amber-100/80 text-sm leading-relaxed">{step.replace(/^Step \d+:\s*/i, '')}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legal Terms */}
            {!result.error && result.legal_terms?.length > 0 && (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Legal-Term Explanations</h2>
                </div>
                <div className="space-y-3">
                  {result.legal_terms.map((item, i) => (
                    <div key={i} className="bg-slate-800/50 rounded-xl p-5 border border-white/5">
                      <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">{item.term}</p>
                      <p className="text-slate-300 text-sm leading-relaxed">{item.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions */}
            {!result.error && result.questions?.length > 0 && (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Questions to Ask Before Signing</h2>
                </div>
                <div className="space-y-3">
                  {result.questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 bg-slate-800/50 rounded-xl p-4 border border-white/5">
                      <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">?</span>
                      <p className="text-slate-300 text-sm leading-relaxed">{q}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legal Term Search */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Legal Term Explainer</h2>
              <p className="text-slate-400 text-xs mt-0.5">Type any legal term — AI explains it in plain everyday language</p>
            </div>
          </div>

          <form onSubmit={handleTermSearch} className="flex gap-3 mb-5">
            <input
              ref={termRef}
              type="text"
              value={termInput}
              onChange={e => setTermInput(e.target.value)}
              placeholder='Type a legal term to explain...'
              className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
            />
            <button
              type="submit"
              disabled={termLoading || !termInput.trim()}
              className="shrink-0 px-5 py-3 rounded-xl font-semibold text-white text-sm bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 transition-all"
            >
              {termLoading ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : 'Explain'}
            </button>
          </form>

          {termHistory.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="text-xs text-slate-600 self-center">Recent:</span>
              {termHistory.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTermInput(t); termRef.current?.focus(); }}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 border border-white/5 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {termResult ? (
            <div className="bg-slate-800/50 border border-cyan-500/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <h3 className="text-lg font-bold text-cyan-400 capitalize">{termResult.term}</h3>
              </div>
              {termResult.simple_meaning && (
                <div className="bg-slate-900/60 rounded-xl p-4 border border-white/5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Simple Meaning</p>
                  <p className="text-white text-sm leading-relaxed font-medium">{termResult.simple_meaning}</p>
                </div>
              )}
              {termResult.full_explanation && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">In More Detail</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{termResult.full_explanation}</p>
                </div>
              )}
              {termResult.real_world_example && (
                <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Real World Example</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{termResult.real_world_example}</p>
                </div>
              )}
              {termResult.watch_out_for && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Watch Out For</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{termResult.watch_out_for}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
}
