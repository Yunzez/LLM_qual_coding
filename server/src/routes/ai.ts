import { Router } from 'express';

const router = Router();

type PromptCode = {
  id: string;
  name: string;
  description?: string;
  flags?: string[];
};

router.post('/ai/suggest', async (req, res, next) => {
  try {
    const { text, projectName, projectDescription, codes, limit } = req.body as {
      text?: string;
      projectName?: string;
      projectDescription?: string;
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
    const indexedCodebook = safeCodes.map((c, idx) => ({
      index: idx + 1,
      id: c.id,
      name: c.name,
      description: c.description,
      flags: c.flags
    }));

    const systemPrompt =
      'You are an expert qualitative coding assistant helping human researchers. ' +
      `Given a text segment and a codebook, you suggest up to ${suggestionLimit} candidate codes. ` +
      'Each suggestion must either reference an existing code by index from the provided codebook list, or propose a new code. ' +
      'Respond as plain text using one suggestion per line in exactly one of these formats: ' +
      '\\n' +
      'EXISTING | <codeIndex> | <confidence 0-1 or empty> | <short rationale>' +
      '\\n' +
      'NEW | <name> | <optional description> | <comma-separated flags or empty> | <confidence 0-1 or empty> | <short rationale>' +
      '\\n' +
      'The <codeIndex> must be one of the indices from the codebook list (1, 2, 3, ...). Never invent indices that are not present. ' +
      'Do not include any other commentary, headings, or JSON – only lines in those formats.';

    const userPayload = {
      projectName: projectName ?? null,
      projectDescription: projectDescription ?? null,
      segmentText: text,
      codebook: indexedCodebook
    };

    const upstreamResponse = await fetch('http://828.therealsonicfan.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) }
        ],
        stream: false,
        temperature: 0.1,
        top_p: 0.8
      })
    });

    if (!upstreamResponse.ok) {
      return res.status(502).json({ message: 'Upstream AI service error.' });
    }

    const data = (await upstreamResponse.json()) as {
      message?: { content?: string };
    };

    const content = data.message?.content;
    console.log('Raw AI content:', content);
    if (!content || typeof content !== 'string') {
      return res.status(502).json({ message: 'Invalid response from AI service.' });
    }
    // Normalise escaped newlines/backslashes the model may return
    const normalizedContent = content.replace(/\\n/g, '\n').replace(/\\r/g, '\n');
    const lines = normalizedContent
      .split('\n')
      .map((l) => {
        let line = l.trim();
        if (line.startsWith('\\')) {
          line = line.slice(1).trim();
        }
        return line;
      })
      .filter((l) => l.length > 0);

    const suggestions: any[] = [];

    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length === 0) continue;

      const kind = parts[0]?.toUpperCase();
      if (kind === 'EXISTING' && parts.length >= 4) {
        const indexRaw = parts[1];
        const index = Number(indexRaw);
        if (!Number.isInteger(index) || index < 1 || index > indexedCodebook.length) {
          continue;
        }
        const mapped = indexedCodebook[index - 1];
        if (!mapped) continue;
        const codeId = mapped.id;
        const confidenceRaw = parts[2];
        const rationale = parts.slice(3).join(' | ').trim() || undefined;
        const confidence =
          confidenceRaw && !Number.isNaN(Number(confidenceRaw))
            ? Number(confidenceRaw)
            : undefined;
        suggestions.push({
          type: 'existing',
          codeId,
          rationale,
          confidence
        });
      } else if (kind === 'NEW' && parts.length >= 2) {
        const name = parts[1];
        if (!name) continue;
        const description = parts[2] || undefined;
        const flagsRaw = parts[3] || '';
        const flags = flagsRaw
          ? flagsRaw
              .split(',')
              .map((f) => f.trim())
              .filter((f) => f.length > 0)
          : undefined;
        const confidenceRaw = parts[4] ?? '';
        const rationale =
          parts.length > 5
            ? parts.slice(5).join(' | ').trim() || undefined
            : parts.length > 4
            ? undefined
            : parts.length > 3
            ? parts.slice(3).join(' | ').trim() || undefined
            : undefined;
        const confidence =
          confidenceRaw && !Number.isNaN(Number(confidenceRaw))
            ? Number(confidenceRaw)
            : undefined;
        suggestions.push({
          type: 'new',
          name,
          description,
          flags,
          rationale,
          confidence
        });
      }

      if (suggestions.length >= suggestionLimit) {
        break;
      }
    }
    console.log('AI suggestions:', suggestions);
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

export default router;
