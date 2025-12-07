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

describe('Projects API', () => {
  it('creates and lists projects', async () => {
    const createRes = await request(app)
      .post('/projects')
      .send({ name: 'My Project', description: 'Test project' })
      .expect(201);

    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.name).toBe('My Project');

    const listRes = await request(app).get('/projects').expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].name).toBe('My Project');
  });

  it('rejects projects without a name', async () => {
    const res = await request(app).post('/projects').send({}).expect(400);
    expect(res.body.message).toMatch(/name is required/i);
  });
});

