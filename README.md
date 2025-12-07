# LLM Qualitative Coding Platform

This repository contains a small full‑stack prototype for an LLM‑assisted qualitative coding platform. The current implementation focuses on core qualitative coding workflows without real LLM integration. When AI suggestions are enabled in the UI, the backend returns a stub “test suggestion” instead of calling a real language model.

The codebase is split into two main applications:

- `server`: Express + TypeScript backend with a simple JSON file database.
- `web`: Next.js + TypeScript + Tailwind frontend.

## High‑Level Usage

1. Start the backend in `server` (`npm run dev`) – it will listen on port `4000` by default.
2. Set `NEXT_PUBLIC_BACKEND_URL` in `web/.env.local` to point at the backend (for example `http://localhost:4000`).
3. Start the frontend in `web` (`npm run dev`) and open the application in a browser.
4. Create a project, add documents and codes, then open a document to start selection‑based coding.
5. Optionally enable AI suggestions on the Settings page to see placeholder suggestions powered by the stub API.


See `server/README.md` and `web/README.md` (once created) for setup and development details.
