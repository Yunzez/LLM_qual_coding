# Rhizome: A bottom-up LLM assisted Qualitative Coding Platform
![Rhizome Logo](rizome.png)
This repository contains a full‑stack prototype for an LLM‑assisted qualitative coding platform. It is designed for small research teams who want a lightweight environment for doing line‑by‑line coding, double coding, and exploratory analysis with optional AI assistance.

The in‑app qualitative coding assistant (the AI that suggests codes) is referred to as **QualiPilot** throughout the documentation.

The codebase is split into two main applications:

- `server`: Express + TypeScript backend with a simple JSON file database.
- `web`: Next.js + TypeScript + Tailwind frontend, with global visual styling consolidated in `globals.css`.

## High‑Level Usage

1. Start the backend in `server` (`npm run dev`) – it listens on port `4000` by default.
2. Set `NEXT_PUBLIC_BACKEND_URL` in `web/.env.local` to point at the backend (for example `http://localhost:4000`).
3. Start the frontend in `web` (`npm run dev`) and open the application in a browser.
4. Create a project, add documents (paste text or upload `.txt` files), and define codes.
5. Open a document to start selection‑based coding:
   - Select text to create or update segments and apply one or more codes.
   - View, edit, and manage codes and their flags (lightweight categories).
   - Inspect usage of each code across documents.
6. Optionally enable AI suggestions on the Settings page to let **QualiPilot** suggest existing or new codes for a selected segment. You can control how many suggestions are requested (to trade off speed vs coverage).

## Architecture Overview

- **Backend (`server`)**
  - Express + TypeScript API.
  - JSON file database (no external DB required).
  - Endpoints for projects, documents, codes, coded segments, flags, settings, and AI suggestions.
  - See `server/README.md` for details.

- **Frontend (`web`)**
  - Next.js App Router + TypeScript.
  - Tailwind for layout/composition, with shared colors and transitions in `globals.css`.
  - Project dashboard, document view with interactive coding, codebook/flags management, export utilities, and settings for AI behavior.
  - See `web/README.md` for details.
