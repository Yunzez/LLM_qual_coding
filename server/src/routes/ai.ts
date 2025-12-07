import { Router } from 'express';

const router = Router();

router.post('/ai/suggest', (req, res, next) => {
  try {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'text is required.' });
    }

    // Stubbed AI suggestion – this will be replaced by a real LLM call later.
    res.json({
      suggestions: [
        {
          codeName: 'Test suggestion',
          rationale: 'This is a placeholder suggestion because AI is not connected yet.'
        }
      ]
    });
  } catch (err) {
    next(err);
  }
});

export default router;

