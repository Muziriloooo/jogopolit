import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createId } from '../src/ids.ts';
test('UUID válido e único na rede HTTP sem crypto.randomUUID', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
  });
  try {
    const ids = Array.from({ length: 100 }, createId);
    assert.equal(new Set(ids).size, 100);
    ids.forEach((id) =>
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    );
  } finally {
    Object.defineProperty(globalThis, 'crypto', original);
  }
});
