# Server – Qualitative Coding Backend

This folder contains the Express + TypeScript backend for the qualitative coding platform. It uses a lightweight JSON file as a persistence layer instead of a traditional SQL or NoSQL database.

The backend powers the main qualitative coding workflow and the AI assistant **QualiPilot**, which suggests codes for selected text segments.

## Stack

- Node.js + Express
- TypeScript
- Simple JSON file storage (see `src/db.ts`)
- Jest + Supertest for tests

## Getting Started

Install dependencies:

```bash
cd server
npm install
```

Run the development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

The API listens on the port specified by the `PORT` environment variable (default: `4000`).

## Data Storage

Data is stored in a JSON file on disk. By default this is `db.json` in the `server` directory. Tests use a separate file so that test data does not interfere with development data.

The database schema is defined in `src/types.ts` and managed via helper functions in `src/db.ts`. Key concepts:

- **Project** – top‑level container for documents and codes.
- **Document** – plain text to be coded.
- **Code** – a code with `name`, `description`, `color`, and optional `flags` (lightweight categories/tags).
- **Segment** – a non‑overlapping span of text in a document (`startOffset`, `endOffset`).
- **CodedSegment** – association between a `Segment` and a `Code` (supports double coding).
- **Settings** – global settings such as whether AI is enabled and how many suggestions to request.

## Core Routes

The main route groups are implemented under `src/routes`:

- **Projects / Documents**
  - Create/list/delete projects.
  - Create/list/delete documents within a project.
  - Documents store their raw text; coding information lives in `segments` and `codedSegments`.

- **Coding (`coding.ts`)**
  - `GET /documents/:documentId/coding` – returns the document and its segments, with attached codes.
  - `POST /documents/:documentId/segments` – creates a new segment for a selected text span and attaches codes.
    - Validates offsets against the document text.
    - Ensures segments do not overlap by removing conflicting segments and their coded segments before inserting.
  - `PUT /segments/:segmentId` – updates codes on an existing segment (supports double coding).
    - If `codeIds` is empty, the segment and its coded segments are removed (uncoding).
  - `DELETE /documents/:documentId/coding` – clears all coding for a document and restores it to an uncoded state.

- **Codes (`codes.ts`)**
  - `GET /projects/:projectId/codes` – list codes for a project.
  - `POST /projects/:projectId/codes` – create a new code (name, description, color, flags).
  - `PUT /projects/:projectId/codes/:codeId` – update an existing code (including flags).
  - `DELETE /projects/:projectId/codes/:codeId` – delete a code and its coded segments.
  - `GET /projects/:projectId/codes/:codeId/usage` – return where a code is used across documents (snippets + offsets).

- **Settings (`settings.ts`)**
  - `GET /settings` – fetch global settings, ensuring defaults exist.
  - `PUT /settings` – update `aiEnabled` and `aiSuggestionLimit` (1–5 suggestions per request).

- **AI Suggestions (`ai.ts`)**
  - `POST /ai/suggest` – called by the frontend when the user asks **QualiPilot** for suggestions on a selected segment.
    - Request body: `{ text, projectName?, codes?, limit? }`.
    - Uses `limit` (clamped to 1–5) or falls back to 2.
    - Normalizes the codebook and builds a system prompt describing the JSON format for suggestions.
    - Forwards the request to the external LLM endpoint (`llama3`) and expects strict JSON of the form:
      - `{"suggestions":[ { "type":"existing", "codeId": string, ... } | { "type":"new", "name": string, ... } ] }`.
    - Returns parsed suggestions to the frontend, truncated to the requested `limit`.

If the upstream AI service is unavailable or returns invalid data, the route responds with 5xx errors and the frontend surfaces the error near the AI suggestions UI.

