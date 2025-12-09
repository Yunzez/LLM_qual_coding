import { Router } from 'express';

const router = Router();

router.post('/ai/suggest', async (req, res, next) => {
  try {
    const { text, projectName, codes, limit } = req.body as {
      text?: string;
      projectName?: string;
      codes?: {
        id: string;
        name: string;
        description?: string;
        flags?: string[];
      }[];
      limit?: unknown;
    };

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'text is required.' });
    }

    let suggestionLimit = 2;
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      const rounded = Math.round(limit);
      if (rounded >= 1 && rounded <= 5) {
        suggestionLimit = rounded;
      }
    }

    const safeCodes = Array.isArray(codes)
      ? codes
          .filter(
            (c): c is PromptCode =>
              typeof c === 'object' &&
              c !== null &&
              typeof c.id === 'string' &&
              typeof c.name === 'string'
          )
          .map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            flags: Array.isArray(c.flags)
              ? c.flags
                  .map((f) => (typeof f === 'string' ? f.trim() : ''))
                  .filter((f) => f.length > 0)
              : undefined
          }))
      : [];

    const systemPrompt =
      'You are an expert qualitative coding assistant helping human researchers. ' +
      `Given a text segment and a codebook, you suggest up to ${suggestionLimit} candidate codes. ` +
      'Each suggestion must either reference an existing code by id, or propose a new code. ' +
      'You MUST NOT return more than that number. Always respond with strict JSON in the shape: ' +
      '{ "suggestions": [ { "type": "existing", "codeId": string, "rationale": string, "confidence": number? } ' +
      'or { "type": "new", "name": string, "description": string?, "flags": string[]?, "rationale": string, "confidence": number? } ] }. ' +
      'Do not include any commentary outside the JSON.';

    const userPayload = {
      projectName: projectName ?? null,
      segmentText: text,
      codebook: safeCodes
    };

    const upstreamResponse = await fetch('http://828.therealsonicfan.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) }
        ],
        stream: false
      })
    });

    if (!upstreamResponse.ok) {
      return res.status(502).json({ message: 'Upstream AI service error.' });
    }

    const data = (await upstreamResponse.json()) as {
      message?: { content?: string };
    };

    const content = data.message?.content;
    if (!content || typeof content !== 'string') {
      return res.status(502).json({ message: 'Invalid response from AI service.' });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({ message: 'AI response was not valid JSON.' });
    }

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.suggestions)) {
      parsed.suggestions = parsed.suggestions.slice(0, suggestionLimit);
    }

    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

export default router;
