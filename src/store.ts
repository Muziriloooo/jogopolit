import { openDB } from 'idb';
import { orderIdentifier } from '../shared/order-identifiers.js';
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
    .map((x) => normalizeRecord(x.record));
}
function normalizeRecord(record: RecordOrder): RecordOrder {
  const normalize = (order: import('./types').Order) => ({
    ...order,
    id: orderIdentifier(order.id),
  });
  return {
    ...record,
    data: normalize(record.data),
    baseData: record.baseData ? normalize(record.baseData) : undefined,
    inFlight: record.inFlight
      ? { ...record.inFlight, data: normalize(record.inFlight.data) }
      : undefined,
  };
}
export async function save(user: User, record: RecordOrder) {
  const normalized = normalizeRecord(record);
  await (
    await db
  ).put('orders', { key: user.id + ':' + normalized.data.id, owner: user.id, record: normalized });
}
export async function removeOrder(user: User, id: string) {
  await (await db).delete('orders', user.id + ':' + orderIdentifier(id));
}
export async function clearDevice() {
  const d = await db;
  await d.clear('orders');
  await d.clear('meta');
}
export async function api(url: string, options: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = url === '/sync' ? 60000 : 12000, signal, ...request } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch('/api' + url, {
      ...request,
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        'O servidor não respondeu como API. Confira o endereço e tente sincronizar novamente.',
      );
    }
    if (!response.ok)
      throw Object.assign(new Error(data.error || 'Erro de comunicação.'), {
        status: response.status,
      });
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError')
      throw new Error(
        'O servidor demorou a responder. Os dados foram mantidos para uma nova tentativa automática.',
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
export async function compress(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error(
      'Use uma foto JPG, PNG ou WebP. No iPhone, capture pela câmera ou exporte como JPEG.',
    );
  if (file.size > 25 * 1024 * 1024) throw Error('Imagem maior que 25 MB.');
  const url = URL.createObjectURL(file);
  try {
    return await fitImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Migrate only aliases explicitly authorized by the server after administrator login. */
export async function migrateAccounts(user: User) {
  if (user.role !== 'admin' || !user.mergedUserIds?.length) return;
  const d = await db;
  const tx = d.transaction(['orders', 'meta'], 'readwrite');
  const archive = (await tx.objectStore('meta').get('recovered:' + user.id)) || [];
  const aliases = new Set(user.mergedUserIds);
  for (const entry of await tx.objectStore('orders').getAll()) {
    if (!aliases.has(entry.owner)) continue;
    const key = user.id + ':' + entry.record.data.id;
    const existing = await tx.objectStore('orders').get(key);
    if (!existing || (!existing.record.pending && entry.record.pending)) {
      await tx.objectStore('orders').put({ key, owner: user.id, record: entry.record });
    } else if (
      entry.record.pending &&
      JSON.stringify(existing.record) !== JSON.stringify(entry.record)
    ) {
      archive.push(entry.record);
    }
    await tx.objectStore('orders').delete(entry.key);
  }
  await tx.objectStore('meta').put(archive, 'recovered:' + user.id);
  await tx.done;
}
export async function recoveredDrafts(user: User): Promise<RecordOrder[]> {
  return (await (await db).get('meta', 'recovered:' + user.id)) || [];
}
async function fitImage(src: string, format: 'jpeg' | 'png' = 'jpeg'): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(Error('Não foi possível ler uma imagem. Substitua a foto e tente novamente.'));
    image.src = src;
  });
  let edge = 1400,
    quality = 0.78;
  for (let attempt = 0; attempt < 12; attempt++) {
    const scale = Math.min(1, edge / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const context = canvas.getContext('2d')!;
    if (format === 'jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/' + format, quality);
    if (data.length <= 1400000) return data;
    if (format === 'jpeg' && quality > 0.5) quality -= 0.12;
    else edge = Math.max(200, Math.floor(edge * 0.8));
  }
  throw Error('A imagem continua muito grande. Selecione outra foto. Seu laudo foi preservado.');
}
export async function prepareOrderForSync(order: import('./types').Order) {
  const next = structuredClone(order);
  next.id = orderIdentifier(next.id);
  if (!Array.isArray(next.visits)) return next;
  for (const visit of next.visits) {
    if (!visit || typeof visit !== 'object') continue;
    for (const photo of Array.isArray(visit.photos) ? visit.photos : [])
      if (typeof photo?.data === 'string' && photo.data.length > 1400000)
        photo.data = await fitImage(photo.data);
    if (typeof visit.signature === 'string' && visit.signature.length > 1400000)
      visit.signature = await fitImage(visit.signature, 'png');
  }
  return next;
}
