import test from 'node:test';
import assert from 'node:assert/strict';
import { exchangeOrders, mergeOrders } from '../src/sync-engine.ts';
import { example } from '../server/seed.js';
const clone = structuredClone;
function fixture(records, remote) {
  let local = clone(records),
    server = clone(remote),
    calls = [];
  const io = {
    records: () => local,
    id: () => crypto.randomUUID(),
    flush: async () => {},
    put: async (record) => {
      local = local.map((r) => (r.data.id === record.data.id ? clone(record) : r));
    },
    pull: async () => clone(server),
    commit: async (records) => {
      local = clone(records);
    },
    send: async (command) => {
      calls.push(clone(command));
      const old = server.find((r) => r.data.id === command.data.id);
      if (old?.revision !== command.baseRevision)
        throw Object.assign(Error('Conflito'), { status: 409 });
      const next = { data: clone(command.data), revision: old.revision + 1 };
      server = server.map((r) => (r.data.id === next.data.id ? next : r));
      return clone(next);
    },
  };
  return { io, local: () => local, server: () => server, calls };
}
test('erro em uma OS não impede receber alterações de outra', async () => {
  const a = example(),
    b = { ...example(), id: 'other', status: 'Concluída' };
  const f = fixture(
    [{ data: a, revision: 1, pending: true, commandId: 'bad' }],
    [
      { data: a, revision: 1 },
      { data: b, revision: 4 },
    ],
  );
  f.io.send = async () => {
    throw Object.assign(Error('Revise o laudo'), { status: 400 });
  };
  await exchangeOrders(f.io);
  assert.equal(f.local().find((r) => r.data.id === 'other').revision, 4);
  assert.equal(f.local()[0].pending, true);
  assert.match(f.local()[0].error, /Revise/);
});
test('resposta perdida + nova edição retransmite o comando original antes da próxima edição', async () => {
  const a = example();
  const initial = { data: a, revision: 1, pending: true, commandId: 'first', baseData: clone(a) };
  const f = fixture([initial], [{ data: a, revision: 1 }]);
  const originalSend = f.io.send;
  let committed,
    failed = false;
  f.io.send = async (command) => {
    if (command.commandId === 'first' && failed) return clone(committed);
    const ack = await originalSend(command);
    if (!failed) {
      failed = true;
      committed = ack;
      const current = f.local()[0];
      await f.io.put({
        ...current,
        data: { ...current.data, asset: 'EDITADO DURANTE ENVIO' },
        commandId: 'second',
      });
      throw Error('Resposta perdida');
    }
    return ack;
  };
  await exchangeOrders(f.io);
  assert.equal(f.local()[0].inFlight.commandId, 'first');
  assert.equal(f.local()[0].commandId, 'second');
  await exchangeOrders(f.io);
  assert.equal(Boolean(f.local()[0].pending), false);
  assert.equal(f.local()[0].data.asset, 'EDITADO DURANTE ENVIO');
  assert.deepEqual(
    f.calls.map((c) => [c.commandId, c.baseRevision]),
    [
      ['first', 1],
      ['second', 2],
    ],
  );
});
test('alterações independentes nos dois aparelhos se conciliam após reconectar', async () => {
  const base = example(),
    local = { ...clone(base), asset: 'NOVO PATRIMÔNIO' },
    remote = { ...clone(base), unit: 'UNIDADE ATUALIZADA' };
  const f = fixture(
    [{ data: local, baseData: base, revision: 1, pending: true, commandId: 'old' }],
    [{ data: remote, revision: 2 }],
  );
  const issues = await exchangeOrders(f.io);
  assert.equal(issues.length, 0);
  assert.equal(Boolean(f.local()[0].pending), false);
  assert.equal(f.local()[0].data.asset, local.asset);
  assert.equal(f.local()[0].data.unit, remote.unit);
  assert.equal(f.local()[0].revision, 3);
});
test('edição simultânea do mesmo campo preserva rascunho e exige revisão', async () => {
  const base = example(),
    local = { ...clone(base), unit: 'LOCAL' },
    remote = { ...clone(base), unit: 'SERVIDOR' };
  const f = fixture(
    [{ data: local, baseData: base, revision: 1, pending: true, commandId: 'old' }],
    [{ data: remote, revision: 2 }],
  );
  await exchangeOrders(f.io);
  assert.equal(f.local()[0].pending, true);
  assert.equal(f.local()[0].data.unit, 'LOCAL');
  assert.match(f.local()[0].error, /mesma informação/);
  assert.equal(f.server()[0].data.unit, 'SERVIDOR');
});
test('fotos adicionadas em dispositivos diferentes se mantêm sem duplicação', () => {
  const base = example(),
    local = clone(base),
    remote = clone(base);
  local.visits[0].photos.push({ id: 'photo-local', caption: 'Local' });
  remote.visits[0].photos.push({ id: 'photo-remote', caption: 'Remota' });
  const merged = mergeOrders(base, local, remote);
  assert.deepEqual(
    merged.visits[0].photos.map((p) => p.id),
    ['photo-remote', 'photo-local'],
  );
  remote.visits[0].photos = [];
  base.visits[0].photos = [{ id: 'same', caption: 'Base' }];
  local.visits[0].photos = [{ id: 'same', caption: 'Alterada' }];
  assert.throws(() => mergeOrders(base, local, remote), /mesma informação/);
});
