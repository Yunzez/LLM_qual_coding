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

describe('Codes API', () => {
  async function createProject() {
    const res = await request(app)
      .post('/projects')
      .send({ name: 'Project A' })
      .expect(201);
    return res.body.id as string;
  }

  it('creates and lists codes for a project', async () => {
    const projectId = await createProject();

    const createRes = await request(app)
      .post(`/projects/${projectId}/codes`)
      .send({ name: 'Code 1', description: 'Test code', color: '#ff0000' })
      .expect(201);

    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.projectId).toBe(projectId);

    const listRes = await request(app)
      .get(`/projects/${projectId}/codes`)
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].name).toBe('Code 1');
  });

  it('rejects codes without a name', async () => {
    const projectId = await createProject();
    const res = await request(app)
      .post(`/projects/${projectId}/codes`)
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/name is required/i);
  });

  it('creates a code with flags and updates them', async () => {
    const projectId = await createProject();

    const createRes = await request(app)
      .post(`/projects/${projectId}/codes`)
      .send({ name: 'Code 1', flags: ['theme', ' barrier ', 123] })
      .expect(201);

    expect(createRes.body.flags).toEqual(['theme', 'barrier']);

    const codeId = createRes.body.id as string;

    const updateRes = await request(app)
      .put(`/projects/${projectId}/codes/${codeId}`)
      .send({ flags: ['cycle 1'] })
      .expect(200);

    expect(updateRes.body.flags).toEqual(['cycle 1']);

    const listRes = await request(app)
      .get(`/projects/${projectId}/codes`)
      .expect(200);

    expect(listRes.body[0].flags).toEqual(['cycle 1']);
  });
});
