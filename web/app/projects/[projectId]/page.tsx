'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Document {
  id: string;
  projectId: string;
  name: string;
  text: string;
  createdAt: string;
}

interface Code {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  color?: string;
  flags?: string[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);

  const [docName, setDocName] = useState('');
  const [docText, setDocText] = useState('');

  const [codeName, setCodeName] = useState('');
  const [codeDescription, setCodeDescription] = useState('');
  const [codeFlagsText, setCodeFlagsText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'codes'>('documents');

  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingFlagsText, setEditingFlagsText] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  interface CodeUsageEntry {
    segmentId: string;
    documentId: string;
    documentName: string;
    text: string;
    startOffset: number;
    endOffset: number;
  }

  const [usageCode, setUsageCode] = useState<Code | null>(null);
  const [usageEntries, setUsageEntries] = useState<CodeUsageEntry[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const [flagsSearch, setFlagsSearch] = useState('');

  const allFlags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const code of codes) {
      for (const flag of code.flags ?? []) {
        const trimmed = flag.trim();
        if (!trimmed) continue;
        counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [codes]);

  function downloadJson(filename: string, data: unknown) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExportByCode() {
    if (codes.length === 0) {
      window.alert('There are no codes to export yet.');
      return;
    }
    const payload = codes.map((code) => ({
      id: code.id,
      name: code.name,
      description: code.description ?? '',
      flags: code.flags ?? []
    }));
    const nameSlug = (project?.name || 'project').toLowerCase().replace(/\s+/g, '-');
    downloadJson(`${nameSlug}-codes-by-code.json`, { projectId, projectName: project?.name, codes: payload });
  }

  function handleExportByFlag() {
    if (codes.length === 0) {
      window.alert('There are no codes to export yet.');
      return;
    }
    const groups = new Map<string, Code[]>();
    const unflagged: Code[] = [];

    for (const code of codes) {
      if (!code.flags || code.flags.length === 0) {
        unflagged.push(code);
        continue;
      }
      for (const flag of code.flags) {
        const key = flag.trim();
        if (!key) continue;
        const existing = groups.get(key) ?? [];
        existing.push(code);
        groups.set(key, existing);
      }
    }

    const grouped = Array.from(groups.entries()).map(([flag, codesForFlag]) => ({
      flag,
      codes: codesForFlag.map((code) => ({
        id: code.id,
        name: code.name,
        description: code.description ?? '',
        flags: code.flags ?? []
      }))
    }));

    if (unflagged.length > 0) {
      grouped.push({
        flag: 'Unflagged',
        codes: unflagged.map((code) => ({
          id: code.id,
          name: code.name,
          description: code.description ?? '',
          flags: code.flags ?? []
        }))
      });
    }

    const nameSlug = (project?.name || 'project').toLowerCase().replace(/\s+/g, '-');
    downloadJson(`${nameSlug}-codes-by-flag.json`, {
      projectId,
      projectName: project?.name,
      groups: grouped
    });
  }

  async function fetchProjectAndData() {
    setError(null);
    try {
      // We do not have a dedicated project-by-id endpoint; reuse list + filter.
      const [projectsRes, docsRes, codesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/projects`),
        fetch(`${BACKEND_URL}/projects/${projectId}/documents`),
        fetch(`${BACKEND_URL}/projects/${projectId}/codes`)
      ]);

      if (!projectsRes.ok) throw new Error('Failed to load project.');
      if (!docsRes.ok) throw new Error('Failed to load documents.');
      if (!codesRes.ok) throw new Error('Failed to load codes.');

      const projects = (await projectsRes.json()) as Project[];
      const project = projects.find((p) => p.id === projectId) ?? null;
      const documents = (await docsRes.json()) as Document[];
      const codes = (await codesRes.json()) as Code[];

      setProject(project);
      setDocuments(documents);
      setCodes(codes);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void fetchProjectAndData();
  }, [projectId]);

  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!docName.trim() || !docText.trim()) {
      setError('Document name and text are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: docName, text: docText })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create document.');
      }
      setDocName('');
      setDocText('');
      await fetchProjectAndData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleDocumentFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setError('Only .txt files are supported for upload.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setDocName((current) => (current.trim() ? current : file.name.replace(/\.txt$/i, '')));
      setDocText(text);
    };
    reader.readAsText(file);
  }

  async function handleCreateCode(e: React.FormEvent) {
    e.preventDefault();
    if (!codeName.trim()) {
      setError('Code name is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const flags =
        codeFlagsText
          .split(',')
          .map((f) => f.trim())
          .filter((f) => f.length > 0) || [];

      const res = await fetch(`${BACKEND_URL}/projects/${projectId}/codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: codeName, description: codeDescription, flags })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create code.');
      }
      setCodeName('');
      setCodeDescription('');
      setCodeFlagsText('');
      await fetchProjectAndData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function openUsageModal(code: Code) {
    setUsageCode(code);
    setUsageEntries([]);
    setUsageError(null);
    setUsageLoading(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/projects/${projectId}/codes/${code.id}/usage`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to load code usage.');
      }
      const data = (await res.json()) as { usage: CodeUsageEntry[] };
      setUsageEntries(data.usage);
    } catch (err) {
      setUsageError((err as Error).message);
    } finally {
      setUsageLoading(false);
    }
  }

  async function handleDeleteDocument(id: string) {
    if (
      !window.confirm(
        'Delete this document and all its coding? This cannot be undone.'
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/projects/${projectId}/documents/${id}`,
        {
          method: 'DELETE'
        }
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to delete document.');
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteCode(id: string) {
    if (
      !window.confirm(
        'Delete this code from the project and remove it from all segments? This cannot be undone.'
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/projects/${projectId}/codes/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to delete code.');
      }
      setCodes((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError((err as Error).message);
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

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {project?.name ?? 'Project'}
          </h1>
          {project?.description && (
            <p className="text-sm text-slate-600">{project.description}</p>
          )}
        </div>
        <div className="space-x-3 text-sm">
          <Link href="/projects" className="text-blue-600 hover:underline">
            All projects
          </Link>
          <Link href="/" className="text-slate-600 hover:underline">
            Home
          </Link>
        </div>
      </header>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="mb-3 inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`rounded px-3 py-1 font-medium ${
            activeTab === 'documents'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Documents
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('codes')}
          className={`rounded px-3 py-1 font-medium ${
            activeTab === 'codes'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Codes
        </button>
      </div>

      {activeTab === 'documents' && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card">
            <h2 className="card-title">New document</h2>

            <form className="mt-3 space-y-3" onSubmit={handleCreateDocument}>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Name</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Interview 1"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Text (.txt)
                </label>
                <textarea
                  className="h-32 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={docText}
                  onChange={(e) => setDocText(e.target.value)}
                  placeholder="Paste transcript text here..."
                />
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[11px] font-medium text-slate-700">
                    Or upload .txt file
                  </label>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleDocumentFileChange}
                    className="text-[11px] text-slate-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Uploading a file will populate the text field so you can review or edit
                  before saving.
                </p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Saving…' : 'Add document'}
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="card-title">Documents</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-slate-800">{doc.name}</p>
                    <p className="text-xs text-slate-500">
                      Created {new Date(doc.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/projects/${projectId}/documents/${doc.id}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDocument(doc.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
              {documents.length === 0 && (
                <li className="py-2 text-xs text-slate-500">No documents yet.</li>
              )}
            </ul>
          </section>
        </div>
      )}

      {activeTab === 'codes' && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="card-title">New code</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportByCode}
                  className="btn-secondary"
                >
                  Export by code
                </button>
                <button
                  type="button"
                  onClick={handleExportByFlag}
                  className="btn-secondary"
                >
                  Export by flag
                </button>
              </div>
            </div>

            <form className="mt-3 space-y-3" onSubmit={handleCreateCode}>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Name</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={codeName}
                  onChange={(e) => setCodeName(e.target.value)}
                  placeholder="Barrier"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  className="h-24 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={codeDescription}
                  onChange={(e) => setCodeDescription(e.target.value)}
                  placeholder="Optional inclusion/exclusion criteria, examples, etc."
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Flags / categories
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={codeFlagsText}
                  onChange={(e) => setCodeFlagsText(e.target.value)}
                  placeholder="Comma-separated labels (e.g., cycle 1, emotion, barrier)"
                />
                <p className="text-[11px] text-slate-500">
                  Flags are lightweight labels (e.g., level, type) attached to this code.
                </p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Saving…' : 'Add code'}
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="card-title">Codes</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {codes.map((code) => (
                <li key={code.id} className="flex items-start justify-between py-2">
                  <div>
                    <p className="font-medium text-slate-800">{code.name}</p>
                    {code.description && (
                      <p className="text-xs text-slate-500">{code.description}</p>
                    )}
                    {code.flags && code.flags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {code.flags.map((flag) => (
                          <span key={flag} className="badge-flag">
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openUsageModal(code)}
                      className="text-xs text-slate-600 hover:underline"
                    >
                      Usage
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCodeId(code.id);
                        setEditingName(code.name);
                        setEditingDescription(code.description ?? '');
                        setEditingFlagsText((code.flags ?? []).join(', '));
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCode(code.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
              {codes.length === 0 && (
                <li className="py-2 text-xs text-slate-500">No codes yet.</li>
              )}
            </ul>
          </section>

          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Flags</h2>
              <input
                className="w-32 rounded-md border border-slate-300 px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Search…"
                value={flagsSearch}
                onChange={(e) => setFlagsSearch(e.target.value)}
              />
            </div>
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {allFlags
                .filter((flag) => {
                  const query = flagsSearch.toLowerCase();
                  if (!query) return true;
                  return flag.name.toLowerCase().includes(query);
                })
                .map((flag) => (
                  <li key={flag.name} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="badge-flag">{flag.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {flag.count} code{flag.count === 1 ? '' : 's'}
                      </span>
                    </div>
                  </li>
                ))}
              {allFlags.length === 0 && (
                <li className="py-2 text-xs text-slate-500">
                  No flags yet. Add flags when editing codes to organize your codebook.
                </li>
              )}
            </ul>
          </section>
        </div>
      )}

      {editingCodeId && (
        <div className="fixed inset-0 z-30 flex items-center justify-center modal-backdrop">
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
                  placeholder="Comma-separated labels (e.g., cycle 1, emotion, barrier)"
                />
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

      {usageCode && (
        <div className="fixed inset-0 z-20 flex items-center justify-center modal-backdrop">
          <div className="w-full max-w-2xl rounded-md bg-white p-4 shadow-lg modal-panel">
            <h2 className="text-sm font-medium text-slate-800">
              Usage of <span className="font-semibold">{usageCode.name}</span>
            </h2>
            {usageError && <p className="mt-1 text-xs text-red-600">{usageError}</p>}
            <p className="mt-1 text-xs text-slate-600">
              Showing where this code has been applied across documents.
            </p>
            <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto text-xs">
              {usageLoading ? (
                <p className="text-slate-500">Loading…</p>
              ) : usageEntries.length === 0 ? (
                <p className="text-slate-500">This code has not been applied yet.</p>
              ) : (
                Object.entries(
                  usageEntries.reduce<Record<string, CodeUsageEntry[]>>((acc, entry) => {
                    if (!acc[entry.documentId]) acc[entry.documentId] = [];
                    acc[entry.documentId].push(entry);
                    return acc;
                  }, {})
                ).map(([documentId, entries]) => (
                  <div key={documentId} className="rounded border border-slate-200 p-2">
                    <p className="text-xs font-medium text-slate-900">
                      {
                        entries[0]?.documentName
                      }{' '}
                      <span className="text-[11px] text-slate-500">
                        ({entries.length} segment{entries.length === 1 ? '' : 's'})
                      </span>
                    </p>
                    <ul className="mt-2 space-y-1">
                      {entries.map((entry) => (
                        <li
                          key={entry.segmentId}
                          className="rounded bg-slate-50 p-2 text-[11px] text-slate-800"
                        >
                          {entry.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setUsageCode(null);
                  setUsageEntries([]);
                  setUsageError(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
