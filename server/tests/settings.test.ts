import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/index';
import { resetDb } from '../src/db';

const testDbPath = path.resolve(__dirname, '..', 'db.test.json');

beforeEach(async () => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  await resetDb();
});

describe('Settings API', () => {
  it('returns default settings when none are set', async () => {
    const res = await request(app).get('/settings').expect(200);
    expect(res.body.id).toBe('default');
    expect(res.body.aiEnabled).toBe(false);
  });

  it('updates and returns settings', async () => {
    const updateRes = await request(app)
      .put('/settings')
      .send({ aiEnabled: true })
      .expect(200);

    expect(updateRes.body.aiEnabled).toBe(true);

    const getRes = await request(app).get('/settings').expect(200);
    expect(getRes.body.aiEnabled).toBe(true);
  });

  it('rejects invalid aiEnabled values', async () => {
    const res = await request(app)
      .put('/settings')
      .send({ aiEnabled: 'yes' })
      .expect(400);

    expect(res.body.message).toMatch(/aiEnabled must be a boolean/i);
  });
});

