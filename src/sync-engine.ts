import type { Order, RecordOrder } from './types';

type WireCommand = { commandId: string; baseRevision: number; data: Order };
export type Exchange = {
  records: () => RecordOrder[];
  deleted?: () => Promise<string[]>;
  remove?: (id: string) => Promise<void>;
  id: () => string;
  put: (record: RecordOrder) => Promise<void>;
  flush: () => Promise<unknown>;
  send: (command: WireCommand) => Promise<RecordOrder>;
  pull: () => Promise<RecordOrder[]>;
  commit: (records: RecordOrder[]) => Promise<void>;
};
/** Durable commands survive edits, lost responses and a device restart. */
export async function exchangeOrders(io: Exchange): Promise<string[]> {
  const issues: string[] = [];
  await io.flush();
  // Retry validation failures once after compatibility fixes are installed.
  for (const record of io.records()) {
    if (
      record.pending &&
      record.error &&
      record.recoveryVersion !== 3 &&
      /Nova OS deve começar pendente|Dados inválidos\. Revise os campos e limites de imagens|Número da OS: valor inválido ou não preenchido/.test(
        record.error,
      )
    ) {
      await io.put({ ...record, error: undefined, recoveryVersion: 3 });
    }
  }
  if (io.deleted && io.remove) {
    const deleted = new Set(await io.deleted());
    for (const record of io.records())
      if (deleted.has(record.data.id)) await io.remove(record.data.id);
  }
  for (const id of io
    .records()
    .filter((r) => r.pending && !r.error)
    .map((r) => r.data.id)) {
    // A second pass immediately sends edits made while an earlier command was in flight.
    for (let pass = 0; pass < 2; pass++) {
      const current = io.records().find((r) => r.data.id === id);
      if (!current?.pending || current.error) break;
      const flight: WireCommand = current.inFlight || {
        commandId: current.commandId!,
        baseRevision: current.revision,
        data: current.data,
      };
      if (!current.inFlight) await io.put({ ...current, inFlight: flight });
      try {
        const ack = await io.send(flight);
        const latest = io.records().find((r) => r.data.id === id);
        if (!latest) break;
        await io.put(
          latest.commandId === flight.commandId
            ? { ...ack, pending: false }
            : { ...latest, revision: ack.revision, baseData: ack.data, inFlight: undefined },
        );
      } catch (error: any) {
        if (error.status === 401) throw error;
        if (error.status === 410 && io.remove) {
          await io.remove(id);
          break;
        }
        const latest = io.records().find((r) => r.data.id === id);
        if (!latest) break;
        if (error.status === 409 && latest.baseData) {
          try {
            const remote = (await io.pull()).find((r) => r.data.id === id);
            if (remote) {
              const merged = mergeOrders(latest.baseData, latest.data, remote.data);
              await io.put({
                ...latest,
                data: merged,
                revision: remote.revision,
                baseData: remote.data,
                commandId: io.id(),
                inFlight: undefined,
                error: undefined,
              });
              continue;
            }
          } catch (mergeError: any) {
            error.message = mergeError.message;
          }
        }
        const permanent =
          error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status);
        if (permanent) {
          // Never let one invalid/conflicting order stop other orders or inbound changes.
          const changedSinceSend = latest.commandId !== flight.commandId;
          const message = error.message || 'Revise os dados desta OS.';
          await io.put({
            ...latest,
            inFlight: undefined,
            error: changedSinceSend && error.status !== 409 ? undefined : message,
          });
          issues.push(`OS ${id}: ${message}`);
        } else {
          // Keep the exact UUID + payload until acknowledged. The server can safely replay it.
          issues.push(error.message || 'Envio pendente. Nova tentativa automática em instantes.');
        }
        break;
      }
    }
  }
  const remote = await io.pull();
  await io.flush();
  const local = io.records();
  const merged = remote.map((r) => local.find((x) => x.data.id === r.data.id && x.pending) || r);
  for (const r of local)
    if (r.pending && !merged.some((x) => x.data.id === r.data.id)) merged.push(r);
  await io.commit(merged);
  return issues;
}

/** Three-way merge: unrelated fields/UUID additions combine; real collisions are rejected. */
export function mergeOrders(base: Order, local: Order, remote: Order): Order {
  const missing = Symbol('missing');
  const object = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  const equal = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) return true;
    if (Array.isArray(a) && Array.isArray(b))
      return a.length === b.length && a.every((v, i) => equal(v, b[i]));
    if (object(a) && object(b)) {
      const ak = Object.keys(a).filter((k) => a[k] !== undefined),
        bk = Object.keys(b).filter((k) => b[k] !== undefined);
      return ak.length === bk.length && ak.every((k) => bk.includes(k) && equal(a[k], b[k]));
    }
    return false;
  };
  const merge = (b: any, l: any, r: any): any => {
    if (equal(l, r) || equal(b, r)) return l;
    if (equal(b, l)) return r;
    if (object(l) && object(r) && (object(b) || b === missing)) {
      const result: Record<string, unknown> = {};
      for (const k of new Set([
        ...Object.keys(b === missing ? {} : b),
        ...Object.keys(l),
        ...Object.keys(r),
      ])) {
        const value = merge(
          b !== missing && Object.hasOwn(b, k) ? b[k] : missing,
          Object.hasOwn(l, k) ? l[k] : missing,
          Object.hasOwn(r, k) ? r[k] : missing,
        );
        if (value !== missing && value !== undefined) result[k] = value;
      }
      return result;
    }
    if (Array.isArray(l) && Array.isArray(r) && (Array.isArray(b) || b === missing)) {
      const arrays = [b === missing ? [] : b, l, r];
      if (
        arrays.every(
          (a) =>
            a.every((v: any) => object(v) && typeof v.id === 'string') &&
            new Set(a.map((v: any) => v.id)).size === a.length,
        )
      ) {
        const [bm, lm, rm] = arrays.map((a) => new Map(a.map((v: any) => [v.id, v])));
        const result = [];
        for (const id of new Set([...rm.keys(), ...lm.keys(), ...bm.keys()])) {
          const value = merge(
            bm.has(id) ? bm.get(id) : missing,
            lm.has(id) ? lm.get(id) : missing,
            rm.has(id) ? rm.get(id) : missing,
          );
          if (value !== missing) result.push(value);
        }
        return result;
      }
    }
    throw new Error(
      'A mesma informação foi alterada nos dois aparelhos. Revise esta OS; seu rascunho foi preservado.',
    );
  };
  return merge(base, local, remote);
}
