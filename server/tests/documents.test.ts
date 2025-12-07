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

describe('Documents API', () => {
  async function createProject() {
    const res = await request(app)
      .post('/projects')
      .send({ name: 'Project A' })
      .expect(201);
    return res.body.id as string;
  }

  it('creates and lists documents for a project', async () => {
    const projectId = await createProject();

    const createDocRes = await request(app)
      .post(`/projects/${projectId}/documents`)
      .send({ name: 'Doc 1', text: 'Some text' })
      .expect(201);

    expect(createDocRes.body.id).toBeDefined();
    expect(createDocRes.body.projectId).toBe(projectId);

    const listRes = await request(app)
      .get(`/projects/${projectId}/documents`)
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].name).toBe('Doc 1');
  });

  it('returns 404 when creating a document for a missing project', async () => {
    const res = await request(app)
      .post('/projects/missing/documents')
      .send({ name: 'Doc', text: 'Text' })
      .expect(404);

    expect(res.body.message).toMatch(/project not found/i);
  });

  it('returns a document with its project', async () => {
    const projectId = await createProject();
    const createDocRes = await request(app)
      .post(`/projects/${projectId}/documents`)
      .send({ name: 'Doc 1', text: 'Some text' })
      .expect(201);

    const documentId = createDocRes.body.id as string;

    const getRes = await request(app)
      .get(`/documents/${documentId}`)
      .expect(200);

    expect(getRes.body.document.id).toBe(documentId);
    expect(getRes.body.project.id).toBe(projectId);
  });
});

