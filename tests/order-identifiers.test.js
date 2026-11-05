import test from 'node:test';
import assert from 'node:assert/strict';
import { orderIdentifier, deletionIdentifiers } from '../shared/order-identifiers.js';
test('exclusão reconhece números e IDs antigos sem renomear a chave', () => {
  assert.equal(orderIdentifier(5544), '5544');
  for (const id of ['5544', 'OS 5544/2026', 'legacy_5544.svg', ' Chamado 5544 '])
    assert.equal(orderIdentifier(id), id);
  assert.deepEqual(deletionIdentifiers([5544, '5544', 'OS 2/2026']), ['5544', 'OS 2/2026']);
  for (const bad of [null, undefined, {}, '', NaN, Infinity, '\n', 'id\u0000'])
    assert.throws(() => orderIdentifier(bad));
  assert.throws(() => deletionIdentifiers({ id: '5544' }));
});
