import test from 'node:test';
import assert from 'node:assert/strict';
import { example } from '../server/seed.js';
import { orderSchema, validateTransition, sanitize } from '../server/domain.js';
const tech = { id: 'tec-demo', role: 'tecnico' },
  manager = { role: 'admin' };
test('referência: R$ 1.566,56 solicitados; nenhuma instalação; duração 153 min', () => {
  const o = orderSchema.parse(example());
  assert.equal(
    o.parts.reduce((n, p) => n + p.quantity * p.unitCents, 0),
    156656,
  );
  assert.equal(o.laborCents + o.travelCents, 20360);
  assert.ok(o.parts.every((p) => p.status === 'Solicitada'));
  assert.equal((Date.parse(o.visits[0].checkOut) - Date.parse(o.visits[0].checkIn)) / 60000, 153);
});
test('valores nunca chegam ao técnico', () => {
  const o = sanitize(example(), 'tecnico');
  assert.equal(o.parts[0].unitCents, undefined);
  assert.equal(o.laborCents, undefined);
});
test('visita finalizada é imutável, independente da ordenação JSONB', () => {
  const o = example(),
    n = structuredClone(o);
  n.visits[0] = Object.fromEntries(Object.entries(n.visits[0]).reverse());
  assert.doesNotThrow(() => validateTransition(n, o, tech));
  n.visits[0].diagnosis = 'Alterado';
  assert.throws(() => validateTransition(n, o, tech), /imutável/);
});
test('técnico não aprova nem instala solicitação', () => {
  const o = example(),
    n = structuredClone(o);
  n.parts[0].status = 'Aprovada';
  assert.throws(() => validateTransition(n, o, tech), /administrador/);
  n.parts[0].status = 'Instalada';
  assert.throws(() => validateTransition(n, o, manager), /entregues/);
});
test('técnico instala apenas peça entregue em visita aberta', () => {
  const o = example();
  o.parts[0].status = 'Entregue';
  const n = structuredClone(o);
  n.visits.push({ ...n.visits[0], id: 'retorno', checkOut: undefined });
  n.parts[0].status = 'Instalada';
  n.parts[0].installedVisitId = 'retorno';
  assert.doesNotThrow(() => validateTransition(n, o, tech));
});
test('não encerra OS com retorno e solicitações', () => {
  const o = example(),
    n = structuredClone(o);
  n.status = 'Concluída';
  assert.throws(() => validateTransition(n, o, manager), /pendentes/);
});
test('assinatura ausente exige justificativa e laudo', () => {
  const o = example(),
    n = structuredClone(o);
  n.visits.push({ ...n.visits[0], id: 'retorno', signatureReason: '' });
  assert.throws(() => validateTransition(n, o, tech), /Justifique/);
});
test('validação rejeita imagem externa e quantidade negativa', () => {
  const o = example();
  o.parts[0].quantity = -1;
  assert.equal(orderSchema.safeParse(o).success, false);
  o.parts[0].quantity = 1;
  o.visits[0].photos = [
    { id: 'x', category: 'Antes', caption: '', data: 'https://example.com/foto.jpg' },
  ];
  assert.equal(orderSchema.safeParse(o).success, false);
});
test('campos elétricos antigos são opcionais e validação informa o campo incorreto', async () => {
  const { validationMessage } = await import('../server/domain.js');
  const data = example();
  delete data.visits[0].voltage;
  delete data.visits[0].battery;
  assert.equal(orderSchema.safeParse(data).success, true);
  data.hours = 'inválido';
  const parsed = orderSchema.safeParse(data);
  assert.equal(parsed.success, false);
  assert.match(validationMessage(parsed.error), /Horímetro/);
});
test('nome do técnico pode ficar vazio enquanto a contratação está pendente', () => {
  const data = example();
  data.technicianName = '';
  const parsed = orderSchema.parse(data);
  assert.equal(parsed.technicianName, '');
});
test('instalação e saída enviadas juntas preservam a instalação feita durante visita aberta', () => {
  const before = example();
  before.parts[0].status = 'Entregue';
  delete before.visits[0].checkOut;
  const next = structuredClone(before);
  next.parts[0].status = 'Instalada';
  next.parts[0].installedVisitId = next.visits[0].id;
  next.visits[0].checkOut = '2026-10-27T16:07:00-03:00';
  assert.doesNotThrow(() => validateTransition(next, before, { role: 'admin' }));
});
