import { database } from './db.js';
import { createApp } from './app.js';
import express from 'express';
import path from 'node:path';
const app = await createApp(await database());
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('dist'), { index: false }));
  app.get('/{*path}', (req, res) => res.sendFile(path.resolve('dist/index.html')));
}
app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () =>
  console.log('SL Campo API pronta na porta ' + (process.env.PORT || 3001)),
);
