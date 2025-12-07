import { Router } from 'express';
import { readDb, writeDb } from '../db';

const router = Router();

router.get('/settings', async (_req, res, next) => {
  try {
    const db = await readDb();
    const settings = db.settings.find((s) => s.id === 'default');
    res.json(settings ?? { id: 'default', aiEnabled: false });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const { aiEnabled } = req.body as { aiEnabled?: unknown };

    if (typeof aiEnabled !== 'boolean') {
      return res.status(400).json({ message: 'aiEnabled must be a boolean.' });
    }

    const db = await readDb();
    const existing = db.settings.find((s) => s.id === 'default');

    if (existing) {
      existing.aiEnabled = aiEnabled;
    } else {
      db.settings.push({ id: 'default', aiEnabled });
    }

    await writeDb(db);
    res.json({ id: 'default', aiEnabled });
  } catch (err) {
    next(err);
  }
});

export default router;

