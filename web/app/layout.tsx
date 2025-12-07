import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Qualitative Coding Platform',
  description: 'Simple qualitative coding workspace'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
