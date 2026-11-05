import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Only application code and public assets. Never hash/read .env or the database.
export async function localVersion(root) {
  const files = ['index.html', 'package.json', 'package-lock.json', 'vite.config.ts'];
  async function walk(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = relative + '/' + entry.name;
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) files.push(name);
    }
  }
  await Promise.all(['src', 'server', 'public', 'tooling'].map(walk));
  const hash = createHash('sha256');
  for (const file of files.sort()) hash.update(file).update(await readFile(path.join(root, file)));
  return hash.digest('hex').slice(0, 20);
}

export function localUpdates() {
  let root;
  return {
    name: 'sl-campo-local-updates',
    apply: 'serve',
    configResolved(config) {
      root = config.root;
    },
    async transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { name: 'sl-local-version', content: await localVersion(root) },
          injectTo: 'head',
        },
      ];
    },
    configureServer(server) {
      server.middlewares.use('/__sl/version', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json');
        try {
          res.end(JSON.stringify({ version: await localVersion(root) }));
        } catch {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'Atualização em andamento' }));
        }
      });
    },
    // Reloads are coordinated by the application, so an open visit is protected.
    handleHotUpdate() {
      return [];
    },
  };
}
