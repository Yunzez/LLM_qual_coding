import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Qualitative Coding Platform</h1>
        <p className="text-sm text-slate-600">
          A minimal workspace for qualitative coding with optional AI suggestions (stubbed).
        </p>
      </header>

      <div className="space-x-3">
        <Link
          href="/projects"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
        >
          View projects
        </Link>
      </div>
    </main>
  );
}

