'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchProjects() {
    try {
      const res = await fetch(`${BACKEND_URL}/projects`);
      if (!res.ok) {
        throw new Error('Failed to load projects');
      }
      const data = (await res.json()) as Project[];
      setProjects(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void fetchProjects();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create project');
      }
      setName('');
      setDescription('');
      await fetchProjects();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-slate-600">Create and manage qualitative coding projects.</p>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Home
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h2 className="card-title">New project</h2>
          <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Name</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Interview Study – Spring 2025"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Description</label>
              <textarea
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description of research questions, participants, etc."
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Creating…' : 'Create project'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="card-title">Existing projects</h2>
          {projects.length === 0 ? (
            <p className="mt-3 text-helper">
              No projects yet. Use the form to start a new study.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {projects.map((project) => (
                <li key={project.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-slate-800">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-slate-500">{project.description}</p>
                    )}
                  </div>
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
