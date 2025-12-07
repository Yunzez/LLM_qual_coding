import { Router } from 'express';
import { nanoid } from 'nanoid';
import { readDb, writeDb } from '../db';
import { Code } from '../types';

const router = Router();

router.get('/projects/:projectId/codes', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const db = await readDb();
    const codes = db.codes.filter((c) => c.projectId === projectId);
    res.json(codes);
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:projectId/codes', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, description, color, flags } = req.body as {
      name?: string;
      description?: string;
      color?: string;
      flags?: unknown;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Code name is required.' });
    }

    const db = await readDb();
    const projectExists = db.projects.some((p) => p.id === projectId);
    if (!projectExists) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    let normalizedFlags: string[] | undefined;
    if (Array.isArray(flags)) {
      normalizedFlags = flags
        .map((f) => (typeof f === 'string' ? f.trim() : ''))
        .filter((f) => f.length > 0);
    }

    const code: Code = {
      id: nanoid(),
      projectId,
      name: name.trim(),
      description: description?.trim() || undefined,
      color: color?.trim() || undefined,
      flags: normalizedFlags && normalizedFlags.length > 0 ? normalizedFlags : undefined
    };

    db.codes.push(code);
    await writeDb(db);

    res.status(201).json(code);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/projects/:projectId/codes/:codeId',
  async (req, res, next) => {
    try {
      const { projectId, codeId } = req.params;
      const { name, description, color, flags } = req.body as {
        name?: unknown;
        description?: unknown;
        color?: unknown;
        flags?: unknown;
      };

      const db = await readDb();
      const code = db.codes.find(
        (c) => c.id === codeId && c.projectId === projectId
      );
      if (!code) {
        return res.status(404).json({ message: 'Code not found.' });
      }

      if (typeof name === 'string' && name.trim()) {
        code.name = name.trim();
      }

      if (typeof description === 'string') {
        const trimmed = description.trim();
        code.description = trimmed || undefined;
      }

      if (typeof color === 'string') {
        const trimmed = color.trim();
        code.color = trimmed || undefined;
      }

      if (flags !== undefined) {
        if (!Array.isArray(flags)) {
          return res.status(400).json({ message: 'flags must be an array of strings.' });
        }
        const normalizedFlags = flags
          .map((f) => (typeof f === 'string' ? f.trim() : ''))
          .filter((f) => f.length > 0);
        code.flags = normalizedFlags.length > 0 ? normalizedFlags : undefined;
      }

      await writeDb(db);
      res.json(code);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/projects/:projectId/codes/:codeId',
  async (req, res, next) => {
    try {
      const { projectId, codeId } = req.params;
      const db = await readDb();

      const codeIndex = db.codes.findIndex(
        (c) => c.id === codeId && c.projectId === projectId
      );
      if (codeIndex === -1) {
        return res.status(404).json({ message: 'Code not found.' });
      }

      db.codes.splice(codeIndex, 1);
      db.codedSegments = db.codedSegments.filter((cs) => cs.codeId !== codeId);

      await writeDb(db);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
