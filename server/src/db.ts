import fs from 'fs';
import path from 'path';
import { DbSchema } from './types';

const DEFAULT_DB: DbSchema = {
  users: [],
  projects: [],
  documents: [],
  codes: [],
  segments: [],
  codedSegments: [],
  settings: [{ id: 'default', aiEnabled: false, aiSuggestionLimit: 2 }]
};

const DB_FILE =
  process.env.DB_FILE ||
  path.resolve(__dirname, '..', 'db.json');

let inMemoryDb: DbSchema | null = null;

export async function readDb(): Promise<DbSchema> {
  if (inMemoryDb) {
    return inMemoryDb;
  }

  try {
    const data = await fs.promises.readFile(DB_FILE, 'utf-8');
    inMemoryDb = JSON.parse(data) as DbSchema;
  } catch (err) {
    // If the file does not exist or cannot be parsed, initialize with defaults.
    inMemoryDb = { ...DEFAULT_DB };
    await writeDb(inMemoryDb);
  }

  return inMemoryDb;
}

export async function writeDb(db: DbSchema): Promise<void> {
  inMemoryDb = db;
  const data = JSON.stringify(db, null, 2);
  await fs.promises.writeFile(DB_FILE, data, 'utf-8');
}

export async function resetDb(): Promise<void> {
  inMemoryDb = { ...DEFAULT_DB };
  await writeDb(inMemoryDb);
}
