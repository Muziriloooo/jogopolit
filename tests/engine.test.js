import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, RESEARCH } from '../src/data.js';
import {
  createGame,
  resolveEvent,
  advanceMonth,
  enactPolicy,
  buildProject,
  startResearch,
  negotiate,
  updateFiscal,
  diplomacy,
  modernizeDefense,
  appointMinister,
  validateSave,
  financials,
  costOf,
  support,
  interpretProposal,
  legacy,
} from '../src/engine.js';

function tick(s) {
  return advanceMonth(s.event === null ? s : resolveEvent(s, 2));
}

test('all 16 nations initialize with exact chamber totals and valid saves', () => {
  for (const c of COUNTRIES) {
    const s = createGame({ country: c.id });
    assert.equal(
      s.parties.reduce((n, p) => n + p.seats, 0),
      c.seats,
    );
    assert.equal(Object.keys(s.relations).length, 15);
    assert.equal(validateSave(JSON.parse(JSON.stringify(s))).country, c.id);
    assert.equal(s.metrics.gdp, c.gdp);
  }
});

test('policies consume resources, change indicators and never mutate their input', () => {
  const s = createGame();
  const snapshot = structuredClone(s);
  const next = enactPolicy(s, 'health');
  assert.deepEqual(s, snapshot);
  assert.equal(next.actions, 2);
  assert.equal(next.capital, 63);
  assert.equal(next.metrics.treasury, 90);
  assert.equal(next.metrics.health, 61);
  assert.ok(next.enacted.includes('health'));
  assert.throws(() => enactPolicy(next, 'health'), /já foi adotada/);
});

test('cash and political limits reject actions without spending anything', () => {
  const s = createGame();
  s.metrics.treasury = 0;
  assert.throws(() => buildProject(s, 'hospital'), /caixa/);
  assert.equal(s.actions, 3);
  s.metrics.treasury = 100;
  s.capital = 0;
  assert.throws(() => enactPolicy(s, 'health'), /Capital político/);
  assert.equal(s.metrics.treasury, 100);
});

test('three decisions per month and crisis responses remain available after exhaustion', () => {
  let s = createGame();
  for (const policy of ['health', 'education', 'green']) s = enactPolicy(s, policy);
  assert.equal(s.actions, 0);
  assert.throws(() => enactPolicy(s, 'income'), /três decisões/);
  s = resolveEvent(s, 0);
  assert.equal(s.actions, 0);
  assert.equal(s.event, null);
  s = advanceMonth(s);
  assert.equal(s.actions, 3);
  assert.equal(s.month, 1);
});

test('unresolved events prevent time advancement and cannot be answered twice', () => {
  const s = createGame();
  assert.throws(() => advanceMonth(s), /urgente/);
  const next = resolveEvent(s, 1);
  assert.equal(next.metrics.approval, 59);
  assert.throws(() => resolveEvent(next, 1), /Não há crise/);
});

test('project benefits arrive exactly at completion, never when authorized', () => {
  let s = buildProject(createGame(), 'hospital', 'Sul');
  assert.equal(s.metrics.health, 54);
  assert.equal(s.projects[0].remaining, 4);
  for (let i = 0; i < 3; i++) s = tick(s);
  assert.equal(s.completed.length, 0);
  assert.equal(s.projects[0].remaining, 1);
  if (s.event !== null) s = resolveEvent(s, 2);
  const before = s.metrics.health;
  s = advanceMonth(s);
  assert.equal(s.projects.length, 0);
  assert.equal(s.completed.length, 1);
  assert.equal(s.completed[0].region, 'Sul');
  assert.ok(s.metrics.health > before + 11);
});

test('research takes time, has capacity limits, and unlocks the spaceport', () => {
  let s = createGame();
  assert.throws(() => buildProject(s, 'spaceport'), /satélites/);
  s = startResearch(s, 'space');
  s = startResearch(s, 'energy');
  assert.throws(() => startResearch(s, 'health'), /duas pesquisas/);
  assert.equal(s.research.space, 0);
  for (let i = 0; i < 3; i++) s = tick(s);
  assert.equal(s.research.space, 1);
  assert.equal(s.research.energy, 1);
  assert.equal(s.studies.length, 0);
  assert.equal(buildProject(s, 'spaceport').projects[0].type, 'spaceport');
});

test('ordinary legislation requires votes in both chambers', () => {
  let s = createGame();
  s.parties.forEach((p) => (p.relation = 95));
  s = enactPolicy(s, 'tax');
  assert.equal(s.metrics.growth, 2.4);
  s = tick(s);
  assert.ok(s.enacted.includes('tax'));
  assert.equal(s.laws.length, 0);
  assert.match(
    s.news.find((n) => n.title === 'Aprovada: Reforma tributária').description,
    /Senado/,
  );
});

test('unsupported proposals fail and can be proposed again', () => {
  let s = createGame();
  s.parties.forEach((p) => (p.relation = 0));
  s = tick(enactPolicy(s, 'tax'));
  assert.equal(s.enacted.includes('tax'), false);
  assert.equal(s.laws.length, 0);
  assert.ok(s.news.some((n) => n.title.startsWith('Rejeitada')));
  assert.equal(enactPolicy(s, 'tax').laws.length, 1);
});

test('constitutional reform needs two successful three-fifths votes', () => {
  let s = createGame();
  s.parties.forEach((p) => (p.relation = 95));
  s = tick(enactPolicy(s, 'constitution'));
  assert.equal(s.laws[0].rounds, 1);
  assert.equal(s.enacted.includes('constitution'), false);
  s = tick(s);
  assert.equal(s.laws.length, 0);
  assert.ok(s.enacted.includes('constitution'));
  let minority = createGame();
  minority.parties.forEach((p) => (p.relation = 52));
  minority = tick(enactPolicy(minority, 'constitution'));
  assert.equal(minority.enacted.includes('constitution'), false);
});

test('negotiation changes expected votes and cannot repeat during the same month', () => {
  const s = createGame();
  const next = negotiate(s, 'AN');
  assert.ok(support(next) > support(s));
  assert.throws(() => negotiate(next, 'AN'), /neste mês/);
  assert.equal(negotiate(tick(next), 'AN').parties[0].relation, 43);
});

test('budget must total 100 and changing taxes affects approval and projected revenue', () => {
  const s = createGame();
  assert.throws(
    () => updateFiscal(s, { tax: 34, interest: 10.5, budget: { ...s.budget, health: 40 } }),
    /100%/,
  );
  const next = updateFiscal(s, { tax: 34, interest: 12, budget: s.budget });
  assert.ok(next.metrics.approval < s.metrics.approval);
  assert.ok(financials(next).income > financials(s).income);
  assert.throws(() => updateFiscal(s, { tax: 80, interest: 12, budget: s.budget }), /inválidos/);
});

test('monthly deficit issues debt and leaves a nonnegative treasury', () => {
  let s = createGame();
  s.tax = 20;
  s.interest = 25;
  s.metrics.treasury = 0;
  const debt = s.metrics.debt;
  s = tick(s);
  assert.equal(s.metrics.treasury, 0);
  assert.ok(s.metrics.debt > debt);
  assert.ok(s.news.some((n) => n.title.includes('emite dívida')));
});

test('international agreements require relationship thresholds and apply economic effects', () => {
  let s = createGame();
  s.relations['840'].score = 48;
  assert.throws(() => diplomacy(s, '840', 'trade'), /mínima de 60/);
  s = diplomacy(s, '840', 'visit');
  assert.equal(s.relations['840'].score, 60);
  const growth = s.metrics.growth;
  s = diplomacy(s, '840', 'trade');
  assert.ok(s.relations['840'].treaty);
  assert.ok(s.metrics.growth > growth);
  assert.throws(() => diplomacy(s, '840', 'trade'), /tratado vigente/);
});

test('war has recurring costs and peace ends the conflict', () => {
  let s = createGame();
  s.relations['840'].score = 30;
  const spending = financials(s).spending;
  s = diplomacy(s, '840', 'war');
  assert.ok(s.relations['840'].war);
  assert.ok(financials(s).spending >= spending + 3);
  assert.throws(() => diplomacy(s, '840', 'visit'), /paz/);
  s = diplomacy(s, '840', 'peace');
  assert.equal(s.relations['840'].war, false);
  assert.equal(financials(s).war, 0);
});

test('allies cannot be attacked and sanctions end trade and alliance', () => {
  let s = createGame();
  s.relations['840'].score = 90;
  s = diplomacy(s, '840', 'alliance');
  assert.throws(() => diplomacy(s, '840', 'war'), /aliança/);
  s = diplomacy(s, '840', 'sanction');
  assert.equal(s.relations['840'].alliance, false);
  assert.equal(s.relations['840'].sanctioned, true);
});

test('costs scale with the selected economy', () => {
  const s = createGame({ country: '840' });
  assert.equal(costOf(s, 5), 65.91);
  const after = enactPolicy(s, 'health');
  assert.equal(Math.round((s.metrics.treasury - after.metrics.treasury) * 100), 6591);
});

test('minister profiles have distinct monthly consequences', () => {
  const s = createGame();
  const political = appointMinister(s, 'economy', 'political');
  const a = tick(s);
  const b = tick(political);
  assert.ok(a.metrics.growth > b.metrics.growth);
  assert.equal(b.capital, political.capital + 15);
});

test('defense upgrades and intelligence reports are stateful', () => {
  let s = modernizeDefense(createGame(), 'Marinha');
  assert.equal(s.metrics.defense, 58);
  s = diplomacy(s, '840', 'intelligence');
  assert.equal(s.metrics.defense, 60);
  assert.match(s.news[0].description, /Índice de tensão/);
});

test('elections either renew the term or end the government', () => {
  let s = createGame();
  s.month = 47;
  s.event = null;
  const winner = advanceMonth(s);
  assert.equal(winner.term, 2);
  assert.equal(winner.status, 'active');
  s.metrics.approval = 30;
  const loser = advanceMonth(s);
  assert.equal(loser.status, 'defeated');
  assert.equal(loser.event, null);
  assert.throws(() => enactPolicy(loser, 'health'), /chegou ao fim/);
  assert.throws(() => advanceMonth(loser), /encerrado/);
});

test('institutional collapse ends the game and preserves the legacy report', () => {
  const s = createGame();
  s.metrics.approval = 5;
  s.metrics.stability = 10;
  s.event = null;
  const next = advanceMonth(s);
  assert.equal(next.status, 'impeached');
  assert.ok(legacy(next) > 0);
});

test('saved RNG state gives reproducible future events', () => {
  let a = createGame({ seed: 44 });
  let b = validateSave(JSON.parse(JSON.stringify(a)));
  for (let i = 0; i < 24; i++) {
    a = tick(a);
    b = tick(b);
  }
  assert.deepEqual(a, b);
});

test('a ten-year simulation stays finite, capped, and serializable', () => {
  let s = createGame();
  for (let i = 0; i < 120; i++) {
    if (s.event !== null) s = resolveEvent(s, 0);
    s = advanceMonth(s);
    if (s.status !== 'active') break;
  }
  for (const value of Object.values(s.metrics)) assert.ok(Number.isFinite(value));
  assert.ok(s.history.length <= 120);
  assert.ok(s.news.length <= 100);
  assert.ok(s.metrics.approval >= 0 && s.metrics.approval <= 100);
  validateSave(JSON.parse(JSON.stringify(s)));
});

test('text proposals are explicit rule matches; unsupported text returns no suggestion', () => {
  assert.equal(interpretProposal('Investir em hospitais e unidades de saúde.').id, 'health');
  assert.equal(interpretProposal('Revisar impostos e simplificar a tributação.').id, 'tax');
  assert.equal(interpretProposal('Vamos mudar tudo de uma forma completamente nova.'), null);
  assert.equal(interpretProposal('oi'), null);
});

test('save validation rejects damaged files instead of crashing during a turn', () => {
  assert.throws(() => validateSave({ version: 99 }), /compatível/);
  const mutations = [
    (s) => delete s.metrics,
    (s) => s.projects.push({ type: 'missing' }),
    (s) => (s.event = 55),
    (s) => (s.relations = {}),
    (s) => (s.research = {}),
    (s) => (s.history = []),
    (s) => (s.parties[0].seats = 999),
    (s) => (s.ministers = []),
    (s) => (s.relations.unknown = { score: 50 }),
    (s) => (s.parties[0].name = { invalid: true }),
    (s) => (s.budget.unknown = 0),
  ];
  for (const mutate of mutations) {
    const s = createGame();
    mutate(s);
    assert.throws(() => validateSave(s));
  }
});

test('every research area has three named levels', () => {
  assert.equal(RESEARCH.length, 19);
  assert.equal(RESEARCH.flatMap((r) => r.levels).length, 57);
});
