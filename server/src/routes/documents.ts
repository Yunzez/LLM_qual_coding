import { Router } from 'express';
import { nanoid } from 'nanoid';
import { readDb, writeDb } from '../db';
import { Document } from '../types';

const router = Router();

router.get('/projects/:projectId/documents', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const db = await readDb();
    const documents = db.documents.filter((d) => d.projectId === projectId);
    res.json(documents);
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:projectId/documents', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, text } = req.body as { name?: string; text?: string };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Document name is required.' });
    }

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'Document text is required.' });
    }

    const db = await readDb();
    const projectExists = db.projects.some((p) => p.id === projectId);
    if (!projectExists) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    const now = new Date().toISOString();
    const document: Document = {
      id: nanoid(),
      projectId,
      name: name.trim(),
      text,
      createdAt: now
    };

    db.documents.push(document);
    await writeDb(db);

    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
});

router.get('/documents/:documentId', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const db = await readDb();
    const document = db.documents.find((d) => d.id === documentId);

    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const project = db.projects.find((p) => p.id === document.projectId) || null;

    res.json({ document, project });
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/projects/:projectId/documents/:documentId',
  async (req, res, next) => {
    try {
      const { projectId, documentId } = req.params;
      const db = await readDb();

      const documentIndex = db.documents.findIndex(
        (d) => d.id === documentId && d.projectId === projectId
      );
      if (documentIndex === -1) {
        return res.status(404).json({ message: 'Document not found.' });
      }

      // Remove the document.
      db.documents.splice(documentIndex, 1);

      // Remove any segments and codedSegments associated with this document.
      const segmentIds = new Set(
        db.segments
          .filter((s) => s.documentId === documentId)
          .map((s) => s.id)
      );
      db.segments = db.segments.filter((s) => s.documentId !== documentId);
      if (segmentIds.size > 0) {
        db.codedSegments = db.codedSegments.filter(
          (cs) => !segmentIds.has(cs.segmentId)
        );
      }

      await writeDb(db);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
