'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Settings {
  id: 'default';
  aiEnabled: boolean;
  aiSuggestionLimit: number;
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
        body: JSON.stringify({
          aiEnabled: next.aiEnabled,
          aiSuggestionLimit: next.aiSuggestionLimit
        })
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-sm text-slate-600 mt-1">
              Personal preferences for qualitative coding.
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/projects" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Projects
            </Link>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition"
            >
              Back to Home
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <section className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">AI Suggestions</h2>
          <p className="text-sm text-slate-600 mb-4">
            When enabled, selecting text in a document lets you request AI code suggestions
            for that segment.
          </p>

          <div className="flex items-center gap-4 mb-6">
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
            <span className="text-sm font-medium text-slate-800">
              {settings?.aiEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">
              Maximum suggestions per request
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                disabled={!settings || saving}
                value={settings?.aiSuggestionLimit ?? 2}
                onChange={(e) =>
                  settings &&
                  void updateSettings({
                    ...settings,
                    aiSuggestionLimit: Number(e.target.value)
                  })
                }
                className="flex-1"
              />
              <span className="text-sm text-slate-700 font-medium">
                {settings?.aiSuggestionLimit ?? 2}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Fewer suggestions are faster; defaults to 2. You can request between 1 and 5
              suggestions from the model.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
