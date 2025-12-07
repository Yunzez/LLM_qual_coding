# Server – Qualitative Coding Backend

This folder contains the Express + TypeScript backend for the qualitative coding platform. It uses a lightweight JSON file as a persistence layer instead of a traditional SQL or NoSQL database.

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

The API will listen on the port specified by the `PORT` environment variable (default: `4000`).

## Data Storage

Data is stored in a JSON file on disk. By default this is `db.json` in the `server` directory. Tests use a separate file so that test data does not interfere with development data.

The database schema is defined in `src/types.ts` and managed via helper functions in `src/db.ts`.

