'use client';
import { useState, useEffect, useRef } from 'react';

const getAPI = () => 'https://ai-workplace-assistant-frontend-61n2.onrender.com/api';

export default function KnowledgeSearch() {
  const [view,        setView]        = useState('library'); // 'library' | 'qa'
  const [docs,        setDocs]        = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [uploadFile,  setUploadFile]  = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [processing,  setProcessing]  = useState(false);
  const [question,    setQuestion]    = useState('');
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);

  useEffect(() => { fetchDocs(); }, []);

  useEffect(() => {
    if (history.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    if (!processing && view === 'qa') inputRef.current?.focus();
  }, [processing, view]);

  // Native file input listener
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const handler = () => {
      const f = input.files && input.files[0];
      if (f) setUploadFile(f);
    };
    input.addEventListener('change', handler);
    return () => input.removeEventListener('change', handler);
  }, []);

  const fetchDocs = async () => {
    setDocsLoading(true);
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${getAPI()}/knowledge-search/docs`, { signal: controller.signal });
      clearTimeout(t);
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  // Select an already-indexed document → Q&A instantly
  const handleSelectDoc = (doc) => {
    setSelectedDoc({ id: doc.id, document_name: doc.filename });
    setHistory([]);
    setProcessing(false);
    setView('qa');
  };

  // Upload new file → index → Q&A
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setProcessing(true);
    setHistory([]);
    setView('qa');

    const fd = new FormData();
    fd.append('file', uploadFile);
    try {
      // 3 minute timeout — large docs with many chunks need time to embed
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);

      const res  = await fetch(`${getAPI()}/knowledge-search/upload`, {
        method: 'POST',
        body:   fd,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok) {
        setHistory([{ error: data.detail || 'Upload failed. Make sure the backend is running on port 8000.' }]);
        setProcessing(false);
        return;
      }
      setSelectedDoc({ id: data.document_id, document_name: data.document_name });
      await fetchDocs();
    } catch (err) {
      if (err.name === 'AbortError') {
        setHistory([{ error: 'Indexing is taking too long. Try uploading a smaller document or check your internet connection.' }]);
      } else {
        setHistory([{ error: 'Cannot connect to backend. Make sure the server is running on port 8000 with: python -m uvicorn main:app --host 0.0.0.0 --port 8000' }]);
      }
    } finally {
      setUploading(false);
      setProcessing(false);
      setUploadFile(null);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim() || !selectedDoc || processing) return;
    const asked = question.trim();

    // Step 1: show question immediately + typing indicator — ChatGPT style
    const idx = Date.now(); // unique id for this message
    setHistory(prev => [...prev, { id: idx, question: asked, answer: null, loading: true }]);
    setQuestion('');       // clear input right away
    setLoading(true);

    try {
      const res  = await fetch(`${getAPI()}/knowledge-search/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ document_id: selectedDoc.id, question: asked }),
      });
      const data = await res.json();

      if (!res.ok) {
        let errMsg = data.detail || 'Server error. Please try again.';
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
          errMsg = 'Gemini API daily quota exceeded (20 requests/day on free tier). Please wait until tomorrow or upgrade your plan.';
        }
        // Step 2a: replace loading state with error
        setHistory(prev => prev.map(h =>
          h.id === idx ? { ...h, loading: false, error: errMsg } : h
        ));
      } else {
        // Step 2b: replace loading state with real answer
        setHistory(prev => prev.map(h =>
          h.id === idx ? { ...h, loading: false, answer: data.answer, source: data.source, pages: data.pages || [] } : h
        ));
      }
    } catch {
      setHistory(prev => prev.map(h =>
        h.id === idx ? { ...h, loading: false, error: 'Cannot reach backend. Make sure the server is running.' } : h
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (doc, e) => {
    e.stopPropagation(); // prevent row click
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${getAPI()}/knowledge-search/docs/${doc.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocs(prev => prev.filter(d => d.id !== doc.id));
      } else {
        alert('Failed to delete. Please try again.');
      }
    } catch {
      alert('Cannot connect to backend.');
    }
  };

  const goToLibrary = () => {
    setView('library');
    setSelectedDoc(null);
    setHistory([]);
    setQuestion('');
    fetchDocs();
  };

  // ── DOCUMENT LIBRARY SCREEN ──────────────────────────────────────────────
  if (view === 'library') {
    return (
      <div className="min-h-screen bg-slate-950">

        {/* Header */}
        <div className="border-b border-white/5 bg-slate-900/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-6 py-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Knowledge Search</h1>
              <p className="text-slate-400 text-sm">Select a document from your library or upload a new one</p>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">

          {/* ── Document Library ── */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Document Library</h2>
              </div>
              {docs.length > 0 && (
                <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-1 rounded-full border border-white/5">
                  {docs.length} document{docs.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {docsLoading ? (
              <div className="flex items-center justify-center py-10 gap-3 text-slate-500">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading library...</span>
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm font-medium">No documents yet</p>
                <p className="text-slate-600 text-xs mt-1">Upload your first document below</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc, i) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-4 bg-slate-800/40 border border-white/5 rounded-xl px-4 py-3.5 hover:bg-slate-800 hover:border-indigo-500/30 transition-all group cursor-pointer"
                    onClick={() => handleSelectDoc(doc)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* File type icon */}
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate group-hover:text-indigo-300 transition-colors">
                          {doc.filename}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {doc.chunk_count} chunks · {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
                        Ask Questions
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <button
                        onClick={(e) => handleDelete(doc, e)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete document"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Upload New Document ── */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Upload New Document</p>
                <p className="text-xs text-slate-500">HR policies, onboarding guides, technical docs, training materials</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Select File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="w-full text-sm text-slate-300 cursor-pointer
                  file:mr-4 file:py-2.5 file:px-5
                  file:rounded-xl file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-600 file:text-white
                  file:cursor-pointer hover:file:bg-indigo-500
                  bg-slate-800 border border-white/10 rounded-xl px-3 py-2
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            {uploadFile && (
              <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 mt-4">
                <svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-indigo-300 font-semibold text-sm truncate">{uploadFile.name}</p>
                  <p className="text-slate-500 text-xs">{(uploadFile.size / 1024).toFixed(1)} KB · Ready to index</p>
                </div>
                <button type="button" onClick={() => setUploadFile(null)} className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="w-full py-3.5 mt-5 rounded-xl font-semibold text-white text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 transition-all shadow-lg shadow-indigo-500/20"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Indexing document...
                </span>
              ) : uploadFile ? 'Start Searching →' : 'Select a file above first'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Q&A SCREEN ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* Sticky header */}
      <div className="border-b border-white/5 bg-slate-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">Searching in</p>
            <p className="text-white font-semibold text-sm truncate">
              {selectedDoc?.document_name || 'Processing...'}
            </p>
          </div>
          <button
            onClick={goToLibrary}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 text-xs font-medium transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Document Library
          </button>
        </div>
      </div>

      {/* Q&A Area */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">

        {/* Empty / processing state */}
        {history.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              {processing ? (
                <svg className="w-8 h-8 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            {processing ? (
              <>
                <p className="text-white font-semibold mb-1">Indexing your document...</p>
                <p className="text-slate-500 text-sm">Almost ready. You can start typing below.</p>
              </>
            ) : (
              <>
                <p className="text-white font-semibold mb-1">Ask your first question</p>
                <p className="text-slate-500 text-sm">e.g. "What is the leave policy?" or "How many sick days do I get?"</p>
              </>
            )}
          </div>
        )}

        {/* Q&A history — ChatGPT style */}
        <div className="space-y-6 mb-6">
          {history.map((item) => (
            <div key={item.id}>

              {/* User question — right aligned */}
              <div className="flex justify-end mb-3">
                <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm font-medium shadow-lg shadow-indigo-500/10">
                  {item.question}
                </div>
              </div>

              {/* AI answer — left aligned */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  {item.loading ? (
                    /* Typing indicator while waiting */
                    <div className="bg-slate-900 border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4 inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : item.error ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl rounded-tl-sm px-5 py-4 text-red-400 text-sm">
                      {item.error}
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4">
                      <p className="text-white text-sm leading-relaxed">{item.answer}</p>

                      {/* Source reference — only shown when answer found info */}
                      {item.source && item.pages && item.pages.length > 0 && (
                        <div className="mt-4 flex items-start gap-2 bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3">
                          <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-0.5">Source Reference</p>
                            <p className="text-slate-300 text-sm">{item.source}</p>
                            {item.pages && item.pages.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {item.pages.map(p => (
                                  <span key={p} className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-md border border-indigo-500/30">
                                    Page {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Sticky question input */}
      <div className="border-t border-white/5 bg-slate-950 sticky bottom-0">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <form onSubmit={handleAsk} className="flex items-center gap-3 bg-slate-900 border border-white/10 rounded-2xl p-3 shadow-2xl">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              disabled={processing}
              placeholder={processing ? 'Preparing document...' : 'Ask a question about this document...'}
              className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none px-2 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !question.trim() || processing || !selectedDoc}
              className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 flex items-center justify-center text-white transition-all"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>
          {processing && (
            <p className="text-center text-xs text-indigo-400 mt-2 animate-pulse">Indexing in background...</p>
          )}
        </div>
      </div>
    </div>
  );
}
