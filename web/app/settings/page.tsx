'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Settings {
  id: 'default';
  aiEnabled: boolean;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchSettings() {
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/settings`);
      if (!res.ok) {
        throw new Error('Failed to load settings.');
      }
      const data = (await res.json()) as Settings;
      setSettings(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void fetchSettings();
  }, []);

  async function updateSettings(next: Settings) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiEnabled: next.aiEnabled })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to update settings.');
      }
      setSettings(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-slate-600">
            Personal preferences for qualitative coding.
          </p>
        </div>
        <div className="space-x-3 text-sm">
          <Link href="/projects" className="text-blue-600 hover:underline">
            Projects
          </Link>
          <Link href="/" className="text-slate-600 hover:underline">
            Home
          </Link>
        </div>
      </header>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <section className="card">
        <h2 className="card-title">AI suggestions</h2>
        <p className="mt-1 text-xs text-slate-600">
          When enabled, selecting text in a document lets you request placeholder AI code
          suggestions. No real LLM is called yet.
        </p>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={!settings || saving}
            onClick={() =>
              settings &&
              void updateSettings({ ...settings, aiEnabled: !settings.aiEnabled })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
              settings?.aiEnabled
                ? 'border-blue-600 bg-blue-600'
                : 'border-slate-300 bg-slate-200'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                settings?.aiEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-xs text-slate-800">
            {settings?.aiEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </section>
    </main>
  );
}
