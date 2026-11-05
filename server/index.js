import { database } from './db.js';
import { createApp } from './app.js';
import express from 'express';
import path from 'node:path';
const db = await database();
const app = await createApp(db);
if (process.env.NODE_ENV === 'production') {
  app.use(
    express.static(path.resolve('dist'), {
      index: false,
      setHeaders(res, file) {
        if (
          file.endsWith('sw.js') ||
          file.endsWith('index.html') ||
          file.endsWith('manifest.webmanifest')
        )
          res.setHeader('Cache-Control', 'no-cache');
        else if (file.includes(path.sep + 'assets' + path.sep))
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  app.get('/{*path}', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.resolve('dist/index.html'));
  });
}
const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () =>
  console.log('SL Campo API pronta na porta ' + (process.env.PORT || 3001)),
);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.closeIdleConnections();
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
