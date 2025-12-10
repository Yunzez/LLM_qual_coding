'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface DocumentRecord {
  id: string;
  projectId: string;
  name: string;
  text: string;
}

interface Code {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  color?: string;
  flags?: string[];
}

interface SegmentWithCodes {
  id: string;
  documentId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  codes: string[];
}

interface CodingResponse {
  document: DocumentRecord;
  segments: SegmentWithCodes[];
}

interface Settings {
  id: 'default';
  aiEnabled: boolean;
}

type AiExistingSuggestion = {
  type: 'existing';
  codeId: string;
  rationale?: string;
  confidence?: number;
};

type AiNewSuggestion = {
  type: 'new';
  name: string;
  description?: string;
  flags?: string[];
  rationale?: string;
  confidence?: number;
};

type AiSuggestion = AiExistingSuggestion | AiNewSuggestion;

type Run =
  | {
      kind: 'plain';
      start: number;
      end: number;
      text: string;
    }
  | {
      kind: 'segment';
      segment: SegmentWithCodes;
    };

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

function getOffsetsWithin(
  container: HTMLElement,
  range: Range
): { start: number; end: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  let start = -1;
  let end = -1;
  let offset = 0;

  for (const node of textNodes) {
    const length = node.textContent?.length ?? 0;

    if (node === range.startContainer) {
      start = offset + range.startOffset;
    }
    if (node === range.endContainer) {
      end = offset + range.endOffset;
      break;
    }

    offset += length;
  }

  if (start >= 0 && end >= start) {
    return { start, end };
  }

  return null;
}

export default function DocumentCodingPage() {
  const params = useParams<{ projectId: string; documentId: string }>();
  const { projectId, documentId } = params;

  const [project, setProject] = useState<Project | null>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [segments, setSegments] = useState<SegmentWithCodes[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
    text: string;
  } | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  const [showCodePicker, setShowCodePicker] = useState(false);
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeDescription, setNewCodeDescription] = useState('');
  const [creatingCode, setCreatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSearch, setCodeSearch] = useState('');

  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number } | null>(
    null
  );

  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    codeIds: string[];
  } | null>(null);

  const codeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const code of codes) {
      map.set(code.id, code.name);
    }
    return map;
  }, [codes]);

  const [sidebarCodeSearch, setSidebarCodeSearch] = useState('');
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingFlagsText, setEditingFlagsText] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  const allFlags = useMemo(() => {
    const set = new Set<string>();
    for (const code of codes) {
      for (const flag of code.flags ?? []) {
        if (flag.trim()) {
          set.add(flag.trim());
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [codes]);

  const documentText = doc?.text ?? '';

  async function fetchInitialData() {
    setError(null);
    try {
      const [projectsRes, codingRes, codesRes, settingsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/projects`),
        fetch(`${BACKEND_URL}/documents/${documentId}/coding`),
        fetch(`${BACKEND_URL}/projects/${projectId}/codes`),
        fetch(`${BACKEND_URL}/settings`)
      ]);

      if (!projectsRes.ok) throw new Error('Failed to load project.');
      if (!codingRes.ok) throw new Error('Failed to load document coding.');
      if (!codesRes.ok) throw new Error('Failed to load codes.');
      if (!settingsRes.ok) throw new Error('Failed to load settings.');

      const projects = (await projectsRes.json()) as Project[];
      const proj = projects.find((p) => p.id === projectId) ?? null;
      const coding = (await codingRes.json()) as CodingResponse;
      const codes = (await codesRes.json()) as Code[];
      const settings = (await settingsRes.json()) as Settings;

      setProject(proj);
      setDoc(coding.document);
      setSegments(coding.segments);
      setCodes(codes);
      setSettings(settings);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void fetchInitialData();
  }, [projectId, documentId]);

  const runs = useMemo<Run[]>(() => {
    if (!documentText) return [];
    if (segments.length === 0) {
      return [
        {
          kind: 'plain',
          start: 0,
          end: documentText.length,
          text: documentText
        }
      ];
    }

    const sortedSegments = [...segments].sort(
      (a, b) => a.startOffset - b.startOffset
    );

    const result: Run[] = [];
    let cursor = 0;

    for (const segment of sortedSegments) {
      if (segment.startOffset > cursor) {
        result.push({
          kind: 'plain',
          start: cursor,
          end: segment.startOffset,
          text: documentText.slice(cursor, segment.startOffset)
        });
      }

      result.push({
        kind: 'segment',
        segment
      });

      cursor = segment.endOffset;
    }

    if (cursor < documentText.length) {
      result.push({
        kind: 'plain',
        start: cursor,
        end: documentText.length,
        text: documentText.slice(cursor)
      });
    }

    return result;
  }, [documentText, segments]);

  function handleMouseUp(e: ReactMouseEvent) {
    // Ignore mouse events while the code picker is open to avoid
    // interfering with the current selection and offsets.
    if (!documentText || showCodePicker) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText.trim()) {
      return;
    }

    const container = document.getElementById('document-text');
    if (!container || !container.contains(range.commonAncestorContainer)) {
      // Ignore selections outside the document text.
      return;
    }

    const offsets = getOffsetsWithin(container, range);
    if (!offsets) {
      return;
    }

    const { start, end } = offsets;

    setSelectionRange({ start, end, text: selectedText });
    setSelectionPopup({ x: e.clientX + 8, y: e.clientY + 8 });

    // If a segment already exists for this exact range, pre-load its codes.
    const existing = segments.find(
      (s) => s.startOffset === start && s.endOffset === end
    );
    if (existing) {
      setActiveSegmentId(existing.id);
      setSelectedCodeIds(existing.codes);
    } else {
      setActiveSegmentId(null);
      setSelectedCodeIds([]);
    }
  }

  function toggleCodeSelection(id: string) {
    setSelectedCodeIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function applyCodesToSelection() {
    if (!selectionRange) return;
    // If there is an existing segment and no codes are selected, treat this as un-coding.
    if (activeSegmentId && selectedCodeIds.length === 0) {
      await clearCodesFromSegment();
      return;
    }
    // For new segments, do nothing if no codes are selected.
    if (!activeSegmentId && selectedCodeIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        startOffset: selectionRange.start,
        endOffset: selectionRange.end,
        codeIds: selectedCodeIds
      };
      const res = activeSegmentId
        ? await fetch(`${BACKEND_URL}/segments/${activeSegmentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codeIds: selectedCodeIds })
          })
        : await fetch(`${BACKEND_URL}/documents/${documentId}/segments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to apply codes.');
      }
      setShowCodePicker(false);
      setSelectedCodeIds([]);
      setSelectionRange(null);
      setActiveSegmentId(null);
      setSelectionPopup(null);
      await fetchInitialData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function clearCodesFromSegment() {
    if (!activeSegmentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/segments/${activeSegmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeIds: [] })
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to remove codes.');
      }
      setShowCodePicker(false);
      setSelectedCodeIds([]);
      setSelectionRange(null);
      setActiveSegmentId(null);
      setSelectionPopup(null);
      await fetchInitialData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function clearAllCodingForDocument() {
    if (
      !window.confirm(
        'Clear all codes from this document? This will remove all coded segments but keep the text and codebook.'
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/documents/${documentId}/coding`, {
        method: 'DELETE'
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to clear coding for this document.');
      }
      setSelectionRange(null);
      setActiveSegmentId(null);
      setSelectedCodeIds([]);
      setSelectionPopup(null);
      setAiSuggestions([]);
      await fetchInitialData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createCodeFromModal() {
    if (!newCodeName.trim()) {
      setCodeError('Code name is required.');
      return;
    }
    setCreatingCode(true);
    setCodeError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/projects/${projectId}/codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCodeName,
          description: newCodeDescription
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create code.');
      }
      const created = (await res.json()) as Code;
      setCodes((prev) => [...prev, created]);
      setSelectedCodeIds((prev) => [...prev, created.id]);
      setNewCodeName('');
      setNewCodeDescription('');
    } catch (err) {
      setCodeError((err as Error).message);
    } finally {
      setCreatingCode(false);
    }
  }

  async function saveCodeEdits() {
    if (!editingCodeId) return;
    const name = editingName.trim();
    if (!name) {
      setError('Code name is required.');
      return;
    }
    const description = editingDescription.trim();
    const flags =
      editingFlagsText
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0) || [];

    setSavingCode(true);
    setError(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/projects/${projectId}/codes/${editingCodeId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            flags
          })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to update code.');
      }
      const updated = (await res.json()) as Code;
      setCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCodeId(null);
      setEditingName('');
      setEditingDescription('');
      setEditingFlagsText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingCode(false);
    }
  }

  async function requestAiSuggestions() {
    if (!selectionRange) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectionRange.text,
          projectId,
          documentId,
          projectName: project?.name ?? null,
          projectDescription: project?.description ?? null,
          codes: codes.map((code) => ({
            id: code.id,
            name: code.name,
            description: code.description,
            flags: code.flags
          })),
          limit: settings?.aiSuggestionLimit
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to get AI suggestions.');
      }
      const data = (await res.json()) as { suggestions?: AiSuggestion[] };
      setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (err) {
      setAiError((err as Error).message);
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!selectionRange) return;
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const isCodeShortcut =
      (isMac && e.metaKey && e.shiftKey && e.key === 'c') ||
      (!isMac && e.ctrlKey && e.shiftKey && e.key === 'c');
    const isAiShortcut =
      (isMac && e.metaKey && e.shiftKey && e.key === 'a') ||
      (!isMac && e.ctrlKey && e.shiftKey && e.key === 'a');

    if (isCodeShortcut) {
      e.preventDefault();
      setShowCodePicker(true);
    } else if (isAiShortcut && settings?.aiEnabled) {
      e.preventDefault();
      void requestAiSuggestions();
    }
  }

  return (
    <main
      className="space-y-4"
      onMouseUp={(e) => handleMouseUp(e)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {doc?.name ?? 'Document'}
          </h1>
          {project && (
            <p className="text-xs text-slate-600">
              Project: <span className="font-medium">{project.name}</span>
            </p>
          )}
        </div>
        <div className="space-x-3 text-sm">
          <Link
            href={`/projects/${projectId}`}
            className="text-blue-600 hover:underline"
          >
            Back to project
          </Link>
          <Link href="/" className="text-slate-600 hover:underline">
            Home
          </Link>
        </div>
      </header>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-slate-800">Document</h2>
              <p className="text-xs text-slate-500">
                Select text in the document, then use the tooltip to add codes or ask
                AI (if enabled).
              </p>
            </div>
            <button
              type="button"
              onClick={() => void clearAllCodingForDocument()}
              disabled={loading}
              className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear all codes
            </button>
          </div>
          <div
            id="document-text"
            className="h-[80vh] whitespace-pre-wrap overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800"
          >
            {runs.map((run, index) => {
              if (run.kind === 'plain') {
                return (
                  <span key={`plain-${run.start}-${run.end}-${index}`}>{run.text}</span>
                );
              }

              const segment = run.segment;
              const hasCodes = segment.codes.length > 0;

              return (
                <span
                  key={`segment-${segment.id}-${index}`}
                  className={
                    hasCodes
                      ? 'bg-yellow-100 underline decoration-yellow-500 decoration-2'
                      : ''
                  }
                  onClick={() => {
                    setActiveSegmentId(segment.id);
                    setSelectedCodeIds(segment.codes);
                    setSelectionRange({
                      start: segment.startOffset,
                      end: segment.endOffset,
                      text: segment.text
                    });
                    setShowCodePicker(true);
                  }}
                  onMouseEnter={(e) => {
                    if (!hasCodes) return;
                    setHoverInfo({
                      x: e.clientX + 8,
                      y: e.clientY + 8,
                      codeIds: segment.codes
                    });
                  }}
                  onMouseLeave={() => setHoverInfo(null)}
                >
                  {segment.text}
                </span>
              );
            })}
          </div>

        </section>

        <section className="space-y-4">
          <div className="card h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Codes</h2>
              <input
                className="w-32 rounded-md border border-slate-300 px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Search…"
                value={sidebarCodeSearch}
                onChange={(e) => setSidebarCodeSearch(e.target.value)}
              />
            </div>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {codes
                .filter((code) => {
                  const query = sidebarCodeSearch.toLowerCase();
                  if (!query) return true;
                  const flags = (code.flags ?? []).join(' ').toLowerCase();
                  return (
                    code.name.toLowerCase().includes(query) ||
                    (code.description ?? '').toLowerCase().includes(query) ||
                    flags.includes(query)
                  );
                })
                .map((code) => (
                  <li key={code.id} className="flex items-start justify-between py-2">
                    <div>
                      <p className="text-xs font-medium text-slate-800">{code.name}</p>
                      {code.description && (
                        <p className="text-[11px] text-slate-500">{code.description}</p>
                      )}
                      {code.flags && code.flags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {code.flags.map((flag) => (
                            <span
                              key={flag}
                              className="badge-flag"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCodeId(code.id);
                        setEditingName(code.name);
                        setEditingDescription(code.description ?? '');
                        setEditingFlagsText((code.flags ?? []).join(', '));
                      }}
                      className="ml-2 mt-1 text-[11px] text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              {codes.length === 0 && (
                <li className="py-2 text-helper">
                  No codes yet. Add codes on the project page or use the code picker while
                  coding to define new codes.
                </li>
              )}
            </ul>
          </div>

          <div className="card h-[30vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Flags</h2>
              <input
                className="w-32 rounded-md border border-slate-300 px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Search…"
                value={sidebarCodeSearch}
                onChange={(e) => setSidebarCodeSearch(e.target.value)}
              />
            </div>
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {allFlags
                .filter((flag) => {
                  const query = sidebarCodeSearch.toLowerCase();
                  if (!query) return true;
                  return flag.toLowerCase().includes(query);
                })
                .map((flag) => {
                  const count = codes.filter((code) =>
                    (code.flags ?? []).includes(flag)
                  ).length;
                  return (
                    <li key={flag} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="badge-flag">{flag}</span>
                        <span className="text-[11px] text-slate-500">
                          {count} code{count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              {allFlags.length === 0 && (
                <li className="py-2 text-helper">
                  No flags yet. Add flags when editing codes to organize your codebook.
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>

      {selectionRange && selectionPopup && (
        <div
          className="fixed z-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 shadow-lg"
          style={{ left: selectionPopup.x, top: selectionPopup.y }}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowCodePicker(true)}
              className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
            >
              Add code
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectionRange(null);
                  setSelectionPopup(null);
                  setAiSuggestions([]);
                  setActiveSegmentId(null);
                }}
                className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
              >
                Clear
              </button>
              {settings?.aiEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCodePicker(true);
                    void requestAiSuggestions();
                  }}
                  className="rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-900"
                >
                  Ask AI
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {hoverInfo && (
        <div
          className="pointer-events-none fixed z-30 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 shadow-lg"
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          <p className="font-medium text-slate-900">Codes</p>
          <p className="text-slate-700">
            {hoverInfo.codeIds
              .map((id) => codeNameById.get(id) ?? id)
              .join(', ')}
          </p>
        </div>
      )}

      {editingCodeId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center modal-backdrop">
          <div className="w-full max-w-md rounded-md bg-white p-4 shadow-lg modal-panel">
            <h2 className="text-sm font-medium text-slate-800">Edit code</h2>
            <p className="mt-1 text-xs text-slate-600">
              Changes apply to this code across the entire project. Review carefully before
              saving.
            </p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-700">
                  Name
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="Code name"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  className="h-20 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  placeholder="Optional inclusion/exclusion criteria, examples, etc."
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-700">
                  Flags / categories
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={editingFlagsText}
                  onChange={(e) => setEditingFlagsText(e.target.value)}
                  placeholder="Flags, comma-separated"
                />
                {allFlags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {allFlags.map((flag) => (
                      <button
                        key={flag}
                        type="button"
                        onClick={() => {
                          const current = editingFlagsText
                            .split(',')
                            .map((f) => f.trim())
                            .filter((f) => f.length > 0);
                          if (current.includes(flag)) return;
                          const next = current.length > 0 ? [...current, flag] : [flag];
                          setEditingFlagsText(next.join(', '));
                        }}
                        className="badge-flag"
                      >
                        {flag}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-500">
                  Flags are lightweight labels attached to this code and used across the
                  project.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingCodeId(null);
                  setEditingName('');
                  setEditingDescription('');
                  setEditingFlagsText('');
                }}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingCode}
                onClick={() => void saveCodeEdits()}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingCode ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCodePicker && selectionRange && (
        <div className="fixed inset-0 z-30 flex items-center justify-center modal-backdrop">
          <div className="w-full max-w-4xl max-h-[80vh] overflow-y-auto rounded-md bg-white p-4 shadow-lg modal-panel">
            <h2 className="text-sm font-medium text-slate-800">Apply codes</h2>
            <p className="mt-1 text-xs text-slate-600">
              Select one or more codes to apply. Existing codes for this segment are
              pre‑selected.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-[2fr,1.5fr]">
              <div className="space-y-3">
                <div className="space-y-2">
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Search codes…"
                    value={codeSearch}
                    onChange={(e) => setCodeSearch(e.target.value)}
                  />
                  <div className="max-h-[50vh] space-y-1 overflow-y-auto border border-slate-200 p-2">
                    {codes
                      .filter((code) => {
                        const query = codeSearch.toLowerCase();
                        if (!query) return true;
                        return (
                          code.name.toLowerCase().includes(query) ||
                          (code.description ?? '').toLowerCase().includes(query)
                        );
                      })
                      .map((code) => (
                        <label
                          key={code.id}
                          className="flex cursor-pointer items-start gap-2 text-xs text-slate-800"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={selectedCodeIds.includes(code.id)}
                            onChange={() => toggleCodeSelection(code.id)}
                          />
                          <span>
                            <span className="font-medium">{code.name}</span>
                            {code.description && (
                              <span className="block text-slate-500">
                                {code.description}
                              </span>
                            )}
                            {code.flags && code.flags.length > 0 && (
                              <span className="mt-0.5 block text-[11px] text-slate-500">
                                {code.flags.join(', ')}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    {codes.length === 0 && (
                      <p className="text-xs text-slate-500">
                        No codes defined yet. Use the form below to add a new code.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs font-medium text-slate-800">New code</p>
                  <div className="space-y-1">
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Code name"
                      value={newCodeName}
                      onChange={(e) => setNewCodeName(e.target.value)}
                    />
                    <textarea
                      className="h-16 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Optional description"
                      value={newCodeDescription}
                      onChange={(e) => setNewCodeDescription(e.target.value)}
                    />
                  </div>
                  {codeError && <p className="text-[11px] text-red-600">{codeError}</p>}
                  <button
                    type="button"
                    disabled={creatingCode}
                    onClick={() => void createCodeFromModal()}
                    className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingCode ? 'Adding…' : 'Add code'}
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2 overflow-y-auto max-h-[60vh]">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-800">AI suggestions</p>
                  <button
                    type="button"
                    disabled={aiLoading || !settings?.aiEnabled}
                    onClick={() => void requestAiSuggestions()}
                    className="btn-secondary"
                  >
                    {aiLoading ? 'Thinking…' : 'Ask AI'}
                  </button>
                </div>
                {!settings?.aiEnabled ? (
                  <p className="text-[11px] text-slate-500">
                    AI suggestions are disabled. Enable them in Settings to get code ideas.
                  </p>
                ) : aiError ? (
                  <p className="text-[11px] text-red-600">{aiError}</p>
                ) : aiSuggestions.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Ask AI to suggest up to five existing or new codes for this segment.
                  </p>
                ) : (
                  <ul className="space-y-2 text-[11px]">
                    {[...aiSuggestions]
                      .sort((a, b) => {
                        if (a.type !== b.type) {
                          return a.type === 'new' ? -1 : 1;
                        }
                        const ac = a.confidence ?? 0;
                        const bc = b.confidence ?? 0;
                        return bc - ac;
                      })
                      .map((s, idx) => {
                        if (s.type === 'existing') {
                          const code = codes.find((c) => c.id === s.codeId);
                          const name = code?.name ?? 'Unknown code';
                          return (
                            <li
                              key={`${s.type}-${s.codeId}-${idx}`}
                              className="rounded border border-slate-200 p-2"
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-slate-800">{name}</p>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => toggleCodeSelection(s.codeId)}
                                >
                                  {selectedCodeIds.includes(s.codeId)
                                    ? 'Remove'
                                    : 'Apply'}
                                </button>
                              </div>
                              {(s.rationale ||
                                (typeof s.confidence === 'number' &&
                                  Number.isFinite(s.confidence))) && (
                                <div className="mt-1 flex items-center justify-between">
                                  {s.rationale && (
                                    <p className="text-slate-600">{s.rationale}</p>
                                  )}
                                  {typeof s.confidence === 'number' &&
                                    Number.isFinite(s.confidence) && (
                                    <p className="ml-2 text-[10px] text-slate-500">
                                      Confidence: {s.confidence.toFixed(2)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        }

                        // New code suggestion
                        return (
                          <li
                            key={`${s.type}-${s.name}-${idx}`}
                            className="rounded border border-slate-200 p-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-slate-800">{s.name}</p>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                  setNewCodeName(s.name);
                                  setNewCodeDescription(s.description ?? '');
                                }}
                              >
                                Use as new code
                              </button>
                            </div>
                            {(s.description ||
                              s.rationale ||
                              (typeof s.confidence === 'number' &&
                                Number.isFinite(s.confidence))) && (
                              <div className="mt-1 space-y-1">
                                {s.description && (
                                  <p className="text-slate-600">{s.description}</p>
                                )}
                                {s.rationale && (
                                  <p className="text-slate-500">{s.rationale}</p>
                                )}
                                {typeof s.confidence === 'number' &&
                                  Number.isFinite(s.confidence) && (
                                  <p className="text-[10px] text-slate-500">
                                    Confidence: {s.confidence.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-3 flex justify-between gap-2">
              <div>
                {activeSegmentId && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void clearCodesFromSegment()}
                    className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove codes
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCodePicker(false);
                    setSelectedCodeIds([]);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading || (!activeSegmentId && selectedCodeIds.length === 0)}
                  onClick={() => void applyCodesToSelection()}
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Applying…' : 'Apply codes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
