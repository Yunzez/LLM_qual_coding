import Link from 'next/link';
import { FaGithub } from 'react-icons/fa';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen space-y-6 px-4">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Qualitative Coding Platform</h1>
        <p className="text-sm text-slate-600 max-w-md">
          A minimal workspace for qualitative coding with optional AI suggestions (stubbed).
        </p>
      </header>

      <div className="flex space-x-3">
        <Link
          href="/projects"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
        >
          View projects
        </Link>
        <Link
          href="/settings"
          className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700"
        >
          Settings
        </Link>
        <Link
          href="https://github.com/Yunzez/LLM_qual_coding"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow hover:bg-gray-900"
        >
          <FaGithub className="mr-2" />
          GitHub
        </Link>
      </div>
    </main>
  );
}

