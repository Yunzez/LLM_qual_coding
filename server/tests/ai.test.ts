import request from 'supertest';
import app from '../src/index';

describe('AI stub API', () => {
  it('returns a test suggestion when text is provided', async () => {
    const res = await request(app)
      .post('/ai/suggest')
      .send({ text: 'Example text', projectId: 'p1', documentId: 'd1' })
      .expect(200);

    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
    expect(res.body.suggestions[0].codeName).toBe('Test suggestion');
  });

  it('rejects requests without text', async () => {
    const res = await request(app).post('/ai/suggest').send({}).expect(400);
    expect(res.body.message).toMatch(/text is required/i);
  });
});

