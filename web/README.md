# Web – Qualitative Coding Frontend

This folder contains the Next.js + TypeScript + Tailwind CSS frontend for the qualitative coding platform.

The UI exposes the main qualitative coding workflow and integrates with the backend AI assistant **QualiPilot** for optional code suggestions.

## Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS for layout and composition
- Centralized visual styling and transitions in `app/globals.css`

## Getting Started

Install dependencies:

```bash
cd web
npm install
```

Create a `.env.local` file and point the frontend at the backend:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

Run the development server:

```bash
npm run dev
```

Then open the printed URL (usually `http://localhost:3000`) in your browser.

## Main Screens and Workflow

- **Projects**
  - Create new projects and see existing ones.
  - Each project has its own documents, codes, and flags.

- **Project Detail (`/projects/:id`)**
  - Tabs for **Documents**, **Codes**, and **Flags** to keep concerns separate.
  - **Documents tab**
    - Create documents either by pasting text or uploading `.txt` files.
    - List and delete documents with confirmation.
  - **Codes tab**
    - Create, search, edit, and delete codes.
    - Assign flags (lightweight categories) to codes.
    - Inspect where each code is used across documents via a usage dialog.
    - Export codebooks grouped by code or by flag.
  - **Flags tab**
    - Overview of all flags used in the project and how many codes carry each flag.

- **Document Coding (`/projects/:projectId/documents/:documentId`)**
  - Left side shows the document text in a scrollable container.
  - Right side shows:
    - Codes for the project, with search.
    - Flags overview for quick reference.
  - Select text in the document to open a small selection tooltip.
    - Use “Add code” to open the coding modal.
    - Optionally “Ask AI” to request suggestions from **QualiPilot**.
  - Coding modal:
    - Choose one or more existing codes for the selected segment.
    - Create a new code inline (name + description).
    - Apply or remove codes on the active segment.
    - If no codes remain on a segment, it is uncoded.
  - You can clear all coding for a document to restore it to an uncoded state while preserving the raw text.

- **Settings (`/settings`)**
  - Global toggle to enable/disable AI suggestions.
  - Slider to control how many suggestions **QualiPilot** should request per selection (1–5, default 2) to balance speed vs. coverage.

## AI Suggestions in the UI

When AI suggestions are enabled:

- The coding modal includes an “Ask AI” section.
- The frontend sends the selected text, project name, current codebook, and the configured suggestion limit to the backend.
- Suggestions from **QualiPilot** are displayed in two groups:
  - **New codes** (proposed code names/descriptions/flags) sorted by confidence.
  - **Existing codes** (pointing to existing code IDs) also sorted by confidence.
- You can:
  - Use a new suggestion to prefill the “New code” form.
  - Toggle existing code suggestions on/off to select which codes to apply.

All AI actions are strictly human‑in‑the‑loop: no codes are applied until you explicitly confirm via the “Apply codes” button.

## Testing

Frontend tests can be run with:

```bash
npm test
```

Tests use React Testing Library and Jest to verify core flows and components.

