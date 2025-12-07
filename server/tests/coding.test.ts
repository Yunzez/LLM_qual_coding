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

describe('Coding API', () => {
  async function createProject() {
    const res = await request(app)
      .post('/projects')
      .send({ name: 'Project A' })
      .expect(201);
    return res.body.id as string;
  }

  async function createDocument(projectId: string) {
    const res = await request(app)
      .post(`/projects/${projectId}/documents`)
      .send({ name: 'Doc 1', text: 'This is some example text.' })
      .expect(201);
    return res.body.id as string;
  }

  async function createCode(projectId: string, name: string) {
    const res = await request(app)
      .post(`/projects/${projectId}/codes`)
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  it('creates a coded segment and returns coding for a document', async () => {
    const projectId = await createProject();
    const documentId = await createDocument(projectId);
    const codeId1 = await createCode(projectId, 'Code A');
    const codeId2 = await createCode(projectId, 'Code B');

    const textToCode = 'some example';
    const fullText = 'This is some example text.';
    const startOffset = fullText.indexOf(textToCode);
    const endOffset = startOffset + textToCode.length;

    const createSegmentRes = await request(app)
      .post(`/documents/${documentId}/segments`)
      .send({
        startOffset,
        endOffset,
        codeIds: [codeId1, codeId2]
      })
      .expect(201);

    expect(createSegmentRes.body.segment.id).toBeDefined();
    expect(createSegmentRes.body.codes).toHaveLength(2);

    const codingRes = await request(app)
      .get(`/documents/${documentId}/coding`)
      .expect(200);

    expect(codingRes.body.document.id).toBe(documentId);
    expect(Array.isArray(codingRes.body.segments)).toBe(true);
    expect(codingRes.body.segments.length).toBe(1);
    expect(codingRes.body.segments[0].codes).toHaveLength(2);
  });

  it('updates codes on an existing segment', async () => {
    const projectId = await createProject();
    const documentId = await createDocument(projectId);
    const codeId1 = await createCode(projectId, 'Code A');
    const codeId2 = await createCode(projectId, 'Code B');
    const codeId3 = await createCode(projectId, 'Code C');

    const textToCode = 'example';
    const fullText = 'This is some example text.';
    const startOffset = fullText.indexOf(textToCode);
    const endOffset = startOffset + textToCode.length;

    const createSegmentRes = await request(app)
      .post(`/documents/${documentId}/segments`)
      .send({
        startOffset,
        endOffset,
        codeIds: [codeId1, codeId2]
      })
      .expect(201);

    const segmentId = createSegmentRes.body.segment.id as string;

    const updateRes = await request(app)
      .put(`/segments/${segmentId}`)
      .send({ codeIds: [codeId2, codeId3] })
      .expect(200);

    expect(updateRes.body.codes).toHaveLength(2);
    expect(updateRes.body.codes).toContain(codeId2);
    expect(updateRes.body.codes).toContain(codeId3);

    const codingRes = await request(app)
      .get(`/documents/${documentId}/coding`)
      .expect(200);

    expect(codingRes.body.segments[0].codes).toHaveLength(2);
  });

  it('removes a segment when codes are cleared', async () => {
    const projectId = await createProject();
    const documentId = await createDocument(projectId);
    const codeId = await createCode(projectId, 'Code A');

    const textToCode = 'example';
    const fullText = 'This is some example text.';
    const startOffset = fullText.indexOf(textToCode);
    const endOffset = startOffset + textToCode.length;

    const createSegmentRes = await request(app)
      .post(`/documents/${documentId}/segments`)
      .send({
        startOffset,
        endOffset,
        codeIds: [codeId]
      })
      .expect(201);

    const segmentId = createSegmentRes.body.segment.id as string;

    await request(app)
      .put(`/segments/${segmentId}`)
      .send({ codeIds: [] })
      .expect(204);

    const codingRes = await request(app)
      .get(`/documents/${documentId}/coding`)
      .expect(200);

    expect(codingRes.body.segments).toHaveLength(0);
  });

  it('clears all coding for a document', async () => {
    const projectId = await createProject();
    const documentId = await createDocument(projectId);
    const codeId = await createCode(projectId, 'Code A');

    const fullText = 'First segment. Second segment.';
    const first = 'First';
    const second = 'Second';

    const firstStart = fullText.indexOf(first);
    const firstEnd = firstStart + first.length;
    const secondStart = fullText.indexOf(second);
    const secondEnd = secondStart + second.length;

    await request(app)
      .post(`/documents/${documentId}/segments`)
      .send({
        startOffset: firstStart,
        endOffset: firstEnd,
        codeIds: [codeId]
      })
      .expect(201);

    await request(app)
      .post(`/documents/${documentId}/segments`)
      .send({
        startOffset: secondStart,
        endOffset: secondEnd,
        codeIds: [codeId]
      })
      .expect(201);

    const beforeRes = await request(app)
      .get(`/documents/${documentId}/coding`)
      .expect(200);
    expect(beforeRes.body.segments.length).toBe(2);

    await request(app)
      .delete(`/documents/${documentId}/coding`)
      .expect(204);

    const afterRes = await request(app)
      .get(`/documents/${documentId}/coding`)
      .expect(200);
    expect(afterRes.body.segments.length).toBe(0);
  });

  it('replaces overlapping segments when creating a new one', async () => {
    const projectId = await createProject();
    const documentId = await createDocument(projectId);
    const codeId = await createCode(projectId, 'Code A');

    const fullText = 'First sentence.\nSecond sentence.';
    // Overwrite document text directly for this test.
    await request(app)
      .post(`/projects/${projectId}/documents`)
      .send({ name: 'Doc 2', text: fullText });

    // Code the first sentence.
    const firstStart = 0;
    const firstEnd = fullText.indexOf('\n');

    await request(app)
      .post(`/documents/${documentId}/segments`)
      .send({
        startOffset: firstStart,
        endOffset: firstEnd,
        codeIds: [codeId]
      })
      .expect(201);

    // Now code first + second sentence as one range with the same code.
    const expandedStart = 0;
    const expandedEnd = fullText.length;

    await request(app)
      .post(`/documents/${documentId}/segments`)
      .send({
        startOffset: expandedStart,
        endOffset: expandedEnd,
        codeIds: [codeId]
      })
      .expect(201);

    const codingRes = await request(app)
      .get(`/documents/${documentId}/coding`)
      .expect(200);

    expect(codingRes.body.segments.length).toBe(1);
    expect(codingRes.body.segments[0].startOffset).toBe(expandedStart);
    expect(codingRes.body.segments[0].endOffset).toBe(expandedEnd);
  });
});
