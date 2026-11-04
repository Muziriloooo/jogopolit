import { openDB } from 'idb';
import type { RecordOrder, User } from './types';
const db = openDB('sl-campo', 1, {
  upgrade(db) {
    db.createObjectStore('orders', { keyPath: 'key' });
    db.createObjectStore('meta');
  },
});
export async function session(user?: User) {
  const d = await db;
  if (user) await d.put('meta', user, 'user');
  return d.get('meta', 'user') as Promise<User | undefined>;
}
export async function load(user: User): Promise<RecordOrder[]> {
  return (await (await db).getAll('orders'))
    .filter((x) => x.owner === user.id)
    .map((x) => x.record);
}
export async function save(user: User, record: RecordOrder) {
  await (await db).put('orders', { key: user.id + ':' + record.data.id, owner: user.id, record });
}
export async function clearDevice() {
  const d = await db;
  await d.clear('orders');
  await d.clear('meta');
}
export async function api(url: string, options?: RequestInit) {
  const response = await fetch('/api' + url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error || 'Erro de comunicação.'), {
      status: response.status,
    });
  return data;
}
export async function compress(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error(
      'Use uma foto JPG, PNG ou WebP. No iPhone, capture pela câmera ou exporte como JPEG.',
    );
  if (file.size > 25 * 1024 * 1024) throw Error('Imagem maior que 25 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(Error('Não foi possível abrir a imagem.'));
      i.src = url;
    });
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}
