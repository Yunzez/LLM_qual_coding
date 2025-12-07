import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects';
import documentsRouter from './routes/documents';
import codesRouter from './routes/codes';
import codingRouter from './routes/coding';
import settingsRouter from './routes/settings';
import aiRouter from './routes/ai';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/projects', projectsRouter);
app.use('/', documentsRouter);
app.use('/', codesRouter);
app.use('/', codingRouter);
app.use('/', settingsRouter);
app.use('/', aiRouter);

// Simple error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
