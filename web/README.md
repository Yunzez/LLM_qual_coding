# Web – Qualitative Coding Frontend

This folder contains the Next.js + TypeScript + Tailwind CSS frontend for the qualitative coding platform.

## Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS for styling

## Getting Started

Install dependencies:

```bash
cd web
npm install
```

Run the development server:

```bash
npm run dev
```

By default the app expects the backend server to be available at the URL specified in `NEXT_PUBLIC_BACKEND_URL`. In development you can set this in a `.env.local` file, for example:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## Testing

Frontend tests can be run with:

```bash
npm test
```

Tests use React Testing Library and Jest to verify core flows and components.

