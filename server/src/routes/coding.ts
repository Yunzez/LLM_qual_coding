import { Router } from 'express';
import { nanoid } from 'nanoid';
import { readDb, writeDb } from '../db';
import { CodedSegment, Segment } from '../types';

const router = Router();

router.get('/documents/:documentId/coding', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const db = await readDb();
    const document = db.documents.find((d) => d.id === documentId);

    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const segments = db.segments.filter((s) => s.documentId === documentId);
    const codedSegments = db.codedSegments.filter((cs) =>
      segments.some((s) => s.id === cs.segmentId)
    );

    const segmentsWithCodes = segments.map((segment) => {
      const codesForSegment = codedSegments
        .filter((cs) => cs.segmentId === segment.id)
        .map((cs) => cs.codeId);

      return {
        ...segment,
        codes: codesForSegment
      };
    });

    res.json({ document, segments: segmentsWithCodes });
  } catch (err) {
    next(err);
  }
});

router.delete('/documents/:documentId/coding', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const db = await readDb();
    const document = db.documents.find((d) => d.id === documentId);

    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const segmentIdsForDocument = new Set(
      db.segments.filter((s) => s.documentId === documentId).map((s) => s.id)
    );

    if (segmentIdsForDocument.size === 0) {
      return res.status(204).send();
    }

    db.segments = db.segments.filter((s) => !segmentIdsForDocument.has(s.id));
    db.codedSegments = db.codedSegments.filter(
      (cs) => !segmentIdsForDocument.has(cs.segmentId)
    );

    await writeDb(db);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/documents/:documentId/segments', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { startOffset, endOffset, codeIds } = req.body as {
      startOffset?: number;
      endOffset?: number;
      codeIds?: string[];
    };

    const db = await readDb();
    const document = db.documents.find((d) => d.id === documentId);

    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    if (
      typeof startOffset !== 'number' ||
      typeof endOffset !== 'number' ||
      startOffset < 0 ||
      endOffset <= startOffset ||
      endOffset > document.text.length
    ) {
      return res.status(400).json({ message: 'Invalid segment offsets.' });
    }

    const uniqueCodeIds = Array.from(new Set(codeIds || []));

    // Ensure all codes exist and belong to the same project as the document.
    for (const codeId of uniqueCodeIds) {
      const code = db.codes.find((c) => c.id === codeId);
      if (!code || code.projectId !== document.projectId) {
        return res.status(400).json({ message: 'Invalid codeIds for this document.' });
      }
    }

    const now = new Date().toISOString();
    const segmentText = document.text.slice(startOffset, endOffset);

    // For simplicity, we treat coded regions as non-overlapping. Any existing
    // segments that overlap this new range will be removed and replaced by
    // the new segment, along with their codedSegments.
    const overlappingSegments = db.segments.filter(
      (s) =>
        s.documentId === documentId &&
        !(s.endOffset <= startOffset || s.startOffset >= endOffset)
    );
    const overlappingIds = new Set(overlappingSegments.map((s) => s.id));
    if (overlappingIds.size > 0) {
      db.segments = db.segments.filter((s) => !overlappingIds.has(s.id));
      db.codedSegments = db.codedSegments.filter(
        (cs) => !overlappingIds.has(cs.segmentId)
      );
    }

    const segment: Segment = {
      id: nanoid(),
      documentId,
      startOffset,
      endOffset,
      text: segmentText,
      createdBy: 'default-user',
      createdAt: now
    };

    db.segments.push(segment);

    const codedSegments: CodedSegment[] = uniqueCodeIds.map((codeId) => ({
      id: nanoid(),
      segmentId: segment.id,
      codeId,
      createdAt: now
    }));

    db.codedSegments.push(...codedSegments);
    await writeDb(db);

    res.status(201).json({
      segment,
      codes: codedSegments.map((cs) => cs.codeId)
    });
  } catch (err) {
    next(err);
  }
});

router.put('/segments/:segmentId', async (req, res, next) => {
  try {
    const { segmentId } = req.params;
    const { codeIds } = req.body as { codeIds?: string[] };

    if (!Array.isArray(codeIds)) {
      return res.status(400).json({ message: 'codeIds must be an array.' });
    }

    const db = await readDb();
    const segment = db.segments.find((s) => s.id === segmentId);

    if (!segment) {
      return res.status(404).json({ message: 'Segment not found.' });
    }

    const document = db.documents.find((d) => d.id === segment.documentId);
    if (!document) {
      return res.status(500).json({ message: 'Document for segment is missing.' });
    }

    const uniqueCodeIds = Array.from(new Set(codeIds));

    // If no codes remain, remove the segment entirely so the document text
    // is treated as uncoded again.
    if (uniqueCodeIds.length === 0) {
      db.codedSegments = db.codedSegments.filter((cs) => cs.segmentId !== segment.id);
      db.segments = db.segments.filter((s) => s.id !== segment.id);
      await writeDb(db);
      return res.status(204).send();
    }

    for (const codeId of uniqueCodeIds) {
      const code = db.codes.find((c) => c.id === codeId);
      if (!code || code.projectId !== document.projectId) {
        return res.status(400).json({ message: 'Invalid codeIds for this segment.' });
      }
    }

    // Remove existing codedSegments for this segment
    db.codedSegments = db.codedSegments.filter((cs) => cs.segmentId !== segment.id);

    const now = new Date().toISOString();
    const newCodedSegments: CodedSegment[] = uniqueCodeIds.map((codeId) => ({
      id: nanoid(),
      segmentId: segment.id,
      codeId,
      createdAt: now
    }));

    db.codedSegments.push(...newCodedSegments);
    await writeDb(db);

    res.json({
      segment,
      codes: newCodedSegments.map((cs) => cs.codeId)
    });
  } catch (err) {
    next(err);
  }
});

export default router;
