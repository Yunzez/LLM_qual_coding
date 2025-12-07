import { Router } from 'express';
import { readDb, writeDb } from '../db';

const router = Router();

router.get('/settings', async (_req, res, next) => {
  try {
    const db = await readDb();
    const settings = db.settings.find((s) => s.id === 'default');

    if (!settings) {
      const fresh = { id: 'default', aiEnabled: false, aiSuggestionLimit: 2 };
      db.settings.push(fresh);
      await writeDb(db);
      return res.json(fresh);
    }

    if (typeof settings.aiSuggestionLimit !== 'number') {
      settings.aiSuggestionLimit = 2;
      await writeDb(db);
    }

    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const { aiEnabled, aiSuggestionLimit } = req.body as {
      aiEnabled?: unknown;
      aiSuggestionLimit?: unknown;
    };

    if (typeof aiEnabled !== 'boolean') {
      return res.status(400).json({ message: 'aiEnabled must be a boolean.' });
    }

    if (typeof aiSuggestionLimit !== 'number' || !Number.isFinite(aiSuggestionLimit)) {
      return res
        .status(400)
        .json({ message: 'aiSuggestionLimit must be a number between 1 and 5.' });
    }

    const limitInt = Math.round(aiSuggestionLimit);
    if (limitInt < 1 || limitInt > 5) {
      return res
        .status(400)
        .json({ message: 'aiSuggestionLimit must be between 1 and 5.' });
    }

    const db = await readDb();
    const existing = db.settings.find((s) => s.id === 'default');

    if (existing) {
      existing.aiEnabled = aiEnabled;
      existing.aiSuggestionLimit = limitInt;
    } else {
      db.settings.push({ id: 'default', aiEnabled, aiSuggestionLimit: limitInt });
    }

    await writeDb(db);
    res.json({ id: 'default', aiEnabled, aiSuggestionLimit: limitInt });
  } catch (err) {
    next(err);
  }
});

export default router;
