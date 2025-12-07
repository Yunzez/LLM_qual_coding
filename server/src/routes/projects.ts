import { Router } from 'express';
import { nanoid } from 'nanoid';
import { readDb, writeDb } from '../db';
import { Project } from '../types';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const db = await readDb();
    res.json(db.projects);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body as {
      name?: string;
      description?: string;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Project name is required.' });
    }

    const db = await readDb();
    const now = new Date().toISOString();
    const project: Project = {
      id: nanoid(),
      name: name.trim(),
      description: description?.trim() || undefined,
      createdAt: now
    };

    db.projects.push(project);
    await writeDb(db);

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

export default router;

