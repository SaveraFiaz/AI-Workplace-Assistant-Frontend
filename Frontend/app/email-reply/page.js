'use client';
import { useState } from 'react';

const API = 'https://ai-workplace-assistant-frontend-61n2.onrender.com/api';

const TONES = [
  {
    id:          'formal',
    label:       'Formal',
    description: 'Professional & structured. Best for corporate or official emails.',
    border:      'border-indigo-500/50 bg-indigo-500/5',
    iconBg:      'bg-indigo-600',
    textColor:   'text-indigo-400',
    badge:       'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    btn:         'from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500',
    shadow:      'shadow-indigo-500/20',
  },
  {
    id:          'polite',
    label:       'Polite',
    description: 'Warm & friendly. Best for everyday work emails.',
    border:      'border-emerald-500/50 bg-emerald-500/5',
    iconBg:      'bg-emerald-600',
    textColor:   'text-emerald-400',
    badge:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    btn:         'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500',
    shadow:      'shadow-emerald-500/20',
  },
  {
    id:          'firm',
    label:       'Firm',
    description: 'Direct & assertive. Best for setting clear boundaries.',
    border:      'border-orange-500/50 bg-orange-500/5',
    iconBg:      'bg-orange-600',
    textColor:   'text-orange-400',
    badge:       'bg-orange-500/10 text-orange-400 border-orange-500/20',
    btn:         'from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500',
    shadow:      'shadow-orange-500/20',
  },
];

export default function EmailReply() {
  const [emailText,     setEmailText]     = useState('');
  const [selectedTone,  setSelectedTone]  = useState('formal');
  const [companyFormat, setCompanyFormat] = useState('');
  const [showFormat,    setShowFormat]    = useState(false);
  const [reply,          setReply]          = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [changeRequest,  setChangeRequest]  = useState('');
  const [refining,       setRefining]       = useState(false);

  const activeTone = TONES.find(t => t.id === selectedTone) || TONES[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailText.trim()) return;
    setLoading(true);
    setReply(null);
    try {
      const res  = await fetch(`${API}/email-reply`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:          emailText.trim(),
          tone:           selectedTone,
          company_format: companyFormat.trim() || null,
        }),
      });
      const data = await res.json();
      setReply(!res.ok ? { error: data.detail || 'Failed to generate reply.' } : data);
    } catch {
      setReply({ error: 'Cannot reach backend. Make sure the server is running on port 8000.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!reply?.reply) return;
    navigator.clipboard.writeText(reply.reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefine = async (e) => {
    e.preventDefault();
    if (!changeRequest.trim() || !reply?.reply) return;
    setRefining(true);
    try {
      const res  = await fetch(`${API}/email-reply/refine`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          original_email: emailText.trim(),
          current_reply:  reply.reply,
          tone:           selectedTone,
          change_request: changeRequest.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReply(prev => ({ ...prev, error: data.detail || 'Refinement failed.' }));
      } else {
        setReply(data);
        setChangeRequest('');
      }
    } catch {
      setReply(prev => ({ ...prev, error: 'Cannot reach backend. Make sure the server is running.' }));
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">

      {/* Header */}
      <div className="border-b border-white/5 bg-slate-900/60 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Email Reply Assistant</h1>
            <p className="text-slate-400 text-sm">Select a tone, paste the email, get a professional reply instantly</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Step 1 — Tone Selection */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">1</div>
              <p className="text-sm font-semibold text-slate-300">Choose a Reply Tone</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TONES.map((tone) => {
                const isActive = selectedTone === tone.id;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => setSelectedTone(tone.id)}
                    className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-150 ${
                      isActive
                        ? tone.border
                        : 'border-white/5 bg-slate-800/30 hover:bg-slate-800/60 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full mb-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? tone.iconBg : 'bg-slate-700'}`}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                      <span className={`text-sm font-bold ${isActive ? tone.textColor : 'text-slate-300'}`}>
                        {tone.label}
                      </span>
                      {isActive && (
                        <div className="ml-auto w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{tone.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2 — Paste Email */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">2</div>
                <p className="text-sm font-semibold text-slate-300">Paste the Email</p>
              </div>
              {emailText && (
                <button
                  type="button"
                  onClick={() => setEmailText('')}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Paste the email you received here..."
              rows={6}
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 resize-none transition-all leading-relaxed"
            />
          </div>

          {/* Step 3 — Company Format (optional) */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
            <button
              type="button"
              onClick={() => setShowFormat(!showFormat)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">3</div>
                <span className="text-sm font-semibold text-slate-300">Company Email Format</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-400 border border-white/10">Optional</span>
                {companyFormat.trim() && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Added</span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${showFormat ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFormat && (
              <div className="mt-4">
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  Provide your company preferred email structure. AI will follow this when generating the reply.
                </p>
                <textarea
                  value={companyFormat}
                  onChange={(e) => setCompanyFormat(e.target.value)}
                  placeholder={'Example:\n- Start with: Dear [Name],\n- Department: IT Support Team\n- Close: Best regards, [Name] | CompanyName\n- Max 100 words'}
                  rows={4}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none transition-all leading-relaxed"
                />
                {companyFormat.trim() && (
                  <button
                    type="button"
                    onClick={() => setCompanyFormat('')}
                    className="mt-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Clear format
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            type="submit"
            disabled={loading || !emailText.trim()}
            className={`w-full py-3.5 rounded-xl font-semibold text-white text-sm bg-gradient-to-r ${activeTone.btn} disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 shadow-lg ${activeTone.shadow} transition-all duration-200`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating {activeTone.label} Reply...
              </span>
            ) : `Generate ${activeTone.label} Reply →`}
          </button>
        </form>

        {/* Result */}
        {reply && (
          <div className="mt-8">
            {reply.error ? (
              <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-6 flex items-center gap-3 text-red-400">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{reply.error}</p>
              </div>
            ) : (
              <div className={`bg-slate-900 border ${activeTone.border} rounded-2xl p-7`}>

                {/* Reply header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${activeTone.iconBg}`}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Generated Reply</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${activeTone.badge}`}>
                        {activeTone.label} Tone
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold bg-gradient-to-r ${activeTone.btn} transition-all shadow-lg`}
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Reply
                      </>
                    )}
                  </button>
                </div>

                {/* Reply body */}
                <div className="bg-slate-800/60 rounded-xl p-5 border border-white/5">
                  <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{reply.reply}</p>
                </div>

                {/* Request Changes Section */}
                <div className="mt-5 border-t border-white/5 pt-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Need modifications?
                  </p>

                  {/* Example chips — shown outside textarea, no scrolling */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['Make it shorter', 'Add a deadline', 'Sound more confident', 'Add company name'].map(ex => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setChangeRequest(ex)}
                        className="px-2.5 py-1 rounded-lg text-xs text-slate-400 bg-slate-800 border border-white/5 hover:text-white hover:border-white/20 transition-all"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleRefine} className="space-y-3">
                    <textarea
                      value={changeRequest}
                      onChange={(e) => setChangeRequest(e.target.value)}
                      placeholder="Describe what you want to change..."
                      rows={2}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/40 resize-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={refining || !changeRequest.trim()}
                      className="w-full py-3 rounded-xl font-semibold text-white text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 transition-all flex items-center justify-center gap-2"
                    >
                      {refining ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Applying changes...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Apply Changes
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Try another tone */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Try another tone:</span>
                  {TONES.filter(t => t.id !== selectedTone).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setSelectedTone(t.id); setReply(null); setChangeRequest(''); }}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${t.badge} hover:opacity-80 transition-all`}
                    >
                      {t.label} →
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
