import { COUNTRIES, SECTORS, POLICIES, PROJECTS, RESEARCH, EVENTS, MINISTERS } from './data.js';

export const SAVE_KEY = 'soberania.save.v1';
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const copy = (state) => structuredClone(state);
const round = (n) => Math.round(n * 100) / 100;
export const countryOf = (state) => COUNTRIES.find((c) => c.id === state.country);
export const scale = (state) => countryOf(state).gdp / 2200;
export const costOf = (state, cost) => round(cost * scale(state));
export const dateOf = (month, full = false) =>
  new Intl.DateTimeFormat('pt-BR', {
    month: full ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2026, month, 1)));
export const support = (state) =>
  Math.round(state.parties.reduce((n, p) => n + (p.seats * p.relation) / 100, 0));
export const legacy = (s) =>
  Math.round(
    (s.metrics.approval +
      s.metrics.stability +
      s.metrics.health +
      s.metrics.education +
      s.metrics.environment +
      s.metrics.science +
      (100 - s.metrics.inequality)) *
      2 +
      s.completed.length * 50 +
      Object.values(s.research).reduce((a, b) => a + b, 0) * 35 +
      s.month * 5,
  );

function random(s) {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

function normalize(s) {
  for (const key of [
    'approval',
    'stability',
    'health',
    'education',
    'security',
    'infrastructure',
    'environment',
    'science',
    'defense',
    'inequality',
    'corruption',
  ])
    s.metrics[key] = round(clamp(s.metrics[key], 0, 100));
  for (const [key, low, high] of [
    ['growth', -15, 18],
    ['inflation', 0, 100],
    ['unemployment', 0, 60],
    ['debt', 0, 400],
  ])
    s.metrics[key] = round(clamp(s.metrics[key], low, high));
  s.metrics.treasury = round(s.metrics.treasury);
  s.capital = round(clamp(s.capital, 0, 100));
}

function applyEffects(s, effects) {
  for (const [key, value] of Object.entries(effects))
    s.metrics[key] += key === 'treasury' ? costOf(s, value) : value;
  normalize(s);
}

function news(s, title, description, type = 'government') {
  s.news.unshift({ id: s.nextId++, month: s.month, title, description, type });
  s.news = s.news.slice(0, 100);
}

function spend(s, cost = 0, capital = 0, useAction = true) {
  if (s.status !== 'active')
    throw new Error('Este governo chegou ao fim. Inicie uma nova partida.');
  if (useAction && s.actions < 1)
    throw new Error('Você já usou as três decisões do mês. Avance para o próximo mês.');
  if (s.metrics.treasury + 0.001 < costOf(s, cost))
    throw new Error('O caixa não é suficiente para esta decisão.');
  if (s.capital < capital)
    throw new Error('Capital político insuficiente. Ele se recupera a cada mês.');
  s.metrics.treasury -= costOf(s, cost);
  s.capital -= capital;
  if (useAction) s.actions--;
}

export function createGame({ country = '076', name = 'Seu governo', seed = 2026 } = {}) {
  const c = COUNTRIES.find((item) => item.id === country) || COUNTRIES[0];
  const partyData = [
    ['AN', 'Aliança Nacional', 99, 15, '#b98077'],
    ['FP', 'Frente Popular', 81, 85, '#c4e899'],
    ['UN', 'União Nacional', 59, 65, '#98b9a3'],
    ['PR', 'Progressistas', 47, 45, '#a79d87'],
    ['SD', 'Social Democracia', 44, 65, '#8faabd'],
    ['MD', 'Movimento Democrático', 42, 72, '#a7bb80'],
    ['RE', 'Republicanos', 41, 32, '#b99e80'],
    ['RV', 'Renovação', 18, 50, '#a393bc'],
    ['TR', 'Trabalhistas', 17, 80, '#83ac94'],
    ['SO', 'Socialistas', 14, 84, '#7d9c7e'],
    ['IN', 'Independentes', 51, 50, '#6f7870'],
  ];
  let assigned = 0;
  const parties = partyData.map(([id, label, count, relation, color], i) => {
    const seats =
      i === partyData.length - 1 ? c.seats - assigned : Math.floor((count / 513) * c.seats);
    assigned += seats;
    return { id, name: label, seats, relation, color };
  });
  const s = {
    version: 1,
    country: c.id,
    name: String(name).trim().slice(0, 50) || 'Seu governo',
    seed: seed >>> 0,
    month: 0,
    term: 1,
    status: 'active',
    actions: 3,
    capital: 75,
    nextId: 10,
    metrics: {
      approval: 58,
      stability: 72,
      gdp: c.gdp,
      growth: c.growth,
      inflation: c.inflation,
      unemployment: c.unemployment,
      debt: c.debt,
      treasury: (95 * c.gdp) / 2200,
      health: 54,
      education: 57,
      security: 48,
      infrastructure: 52,
      environment: 46,
      science: 38,
      defense: 52,
      inequality: 53,
      corruption: 42,
    },
    tax: 32,
    interest: 10.5,
    budget: {
      health: 24,
      education: 22,
      security: 18,
      infrastructure: 16,
      environment: 12,
      science: 8,
    },
    parties,
    negotiated: [],
    ministers: MINISTERS.map((m) => ({ id: m.id, mode: 'technical' })),
    relations: Object.fromEntries(
      COUNTRIES.filter((x) => x.id !== c.id).map((x, i) => [
        x.id,
        {
          score: x.region === c.region ? 72 : 48 + ((i * 7) % 25),
          treaty: false,
          alliance: false,
          sanctioned: false,
          war: false,
          tension: 0,
        },
      ]),
    ),
    world: Object.fromEntries(
      COUNTRIES.filter((x) => x.id !== c.id).map((x) => [x.id, { growth: x.growth, gdp: x.gdp }]),
    ),
    projects: [],
    completed: [],
    research: Object.fromEntries(RESEARCH.map((r) => [r.id, 0])),
    studies: [],
    laws: [],
    enacted: [],
    event: 0,
    history: [],
    news: [
      {
        id: 1,
        month: 0,
        title: 'Um novo governo. Um mundo de possibilidades.',
        description: `${c.name} inicia um novo ciclo. As primeiras decisões definirão as prioridades do mandato.`,
        type: 'government',
      },
      {
        id: 2,
        month: 0,
        title: 'Parlamento sinaliza abertura ao diálogo',
        description: 'Lideranças pedem uma agenda de desenvolvimento e responsabilidade fiscal.',
        type: 'politics',
      },
      {
        id: 3,
        month: 0,
        title: 'Mercado internacional acompanha a posse',
        description: 'Parceiros comerciais aguardam a definição da nova política externa.',
        type: 'world',
      },
    ],
  };
  s.history.push({ month: 0, ...s.metrics });
  return s;
}

export function financials(s) {
  const income = ((s.metrics.gdp / 12) * s.tax) / 100;
  const services = (s.metrics.gdp / 12) * 0.3;
  const interest = ((((s.metrics.gdp * s.metrics.debt) / 100) * s.interest) / 100 / 12) * 0.12;
  const war = Object.values(s.relations).filter((r) => r.war).length * costOf(s, 3);
  return {
    income,
    services,
    interest,
    war,
    spending: services + interest + war,
    balance: income - services - interest - war,
  };
}

export function enactPolicy(state, policyId, customText = '') {
  const p = POLICIES.find((x) => x.id === policyId);
  if (!p) throw new Error('Proposta não encontrada.');
  if (state.enacted.includes(p.id) || state.laws.some((l) => l.policy === p.id))
    throw new Error('Esta medida já foi adotada ou está em tramitação.');
  const s = copy(state);
  spend(s, p.cost, p.capital);
  if (p.law) {
    s.laws.push({ id: s.nextId++, policy: p.id, rounds: 0, proposed: s.month });
    news(
      s,
      `${p.title} chega ao Parlamento`,
      'A proposta será votada no próximo mês. Negocie apoio com os partidos.',
      'politics',
    );
  } else {
    applyEffects(s, p.effects);
    s.enacted.push(p.id);
    news(
      s,
      p.title,
      customText ? `Proposta presidencial: ${customText.slice(0, 250)}` : p.description,
    );
  }
  normalize(s);
  return s;
}

export function resolveEvent(state, choiceIndex) {
  if (state.event === null) throw new Error('Não há crise pendente.');
  const event = EVENTS[state.event];
  const choice = event?.choices[choiceIndex];
  if (!choice) throw new Error('Resposta inválida.');
  const s = copy(state);
  spend(s, choice.cost, 0, false);
  applyEffects(s, choice.effects);
  news(s, event.title, `Resposta do governo: ${choice.label}.`, 'event');
  s.event = null;
  return s;
}

export function buildProject(state, projectId, region = 'Nacional') {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error('Projeto não encontrado.');
  if (project.requires && state.research[project.requires] < 1)
    throw new Error('Pesquise satélites nacionais antes de construir um centro espacial.');
  if (state.projects.some((p) => p.type === project.id))
    throw new Error('Já existe uma obra deste tipo em andamento.');
  const s = copy(state);
  spend(s, project.cost, 8);
  s.projects.push({
    id: s.nextId++,
    type: project.id,
    remaining: project.months,
    total: project.months,
    region,
  });
  news(
    s,
    `${project.title}: obras autorizadas`,
    `${region} · conclusão prevista em ${project.months} meses.`,
    'development',
  );
  return s;
}

export function startResearch(state, researchId) {
  const r = RESEARCH.find((x) => x.id === researchId);
  if (!r) throw new Error('Área de pesquisa inválida.');
  const level = state.research[r.id];
  if (level >= 3) throw new Error('Todas as tecnologias desta área já foram pesquisadas.');
  if (state.studies.some((x) => x.type === r.id))
    throw new Error('Esta pesquisa já está em andamento.');
  if (state.studies.length >= 2) throw new Error('Seu país comporta duas pesquisas simultâneas.');
  if (state.metrics.science < 25 + level * 15)
    throw new Error(`Você precisa de ${25 + level * 15} pontos de ciência para esta tecnologia.`);
  const s = copy(state);
  spend(s, 4 + level * 4, 8);
  s.studies.push({
    id: s.nextId++,
    type: r.id,
    level,
    remaining: 3 + level * 2,
    total: 3 + level * 2,
  });
  news(
    s,
    `Pesquisa iniciada: ${r.levels[level]}`,
    'O financiamento foi aprovado. Os resultados chegarão ao longo dos próximos meses.',
    'science',
  );
  return s;
}

export function negotiate(state, partyId) {
  const s = copy(state);
  const p = s.parties.find((x) => x.id === partyId);
  if (!p) throw new Error('Partido não encontrado.');
  if (s.negotiated.includes(partyId))
    throw new Error('Você já negociou com este partido neste mês.');
  if (p.relation >= 95) throw new Error('A relação com este partido já está no nível máximo.');
  spend(s, 1, 8);
  p.relation = clamp(p.relation + 14, 0, 95);
  s.negotiated.push(partyId);
  news(
    s,
    `${p.name} se aproxima do governo`,
    'Uma agenda pública de compromissos ampliou o apoio à coalizão.',
    'politics',
  );
  return s;
}

export function updateFiscal(state, { tax, interest, budget }) {
  if (
    !Number.isFinite(tax) ||
    tax < 20 ||
    tax > 45 ||
    !Number.isFinite(interest) ||
    interest < 1 ||
    interest > 25
  )
    throw new Error('Parâmetros fiscais inválidos.');
  if (
    SECTORS.some((x) => !Number.isFinite(budget[x.id]) || budget[x.id] < 0 || budget[x.id] > 100) ||
    Math.abs(Object.values(budget).reduce((a, b) => a + b, 0) - 100) > 0.01
  )
    throw new Error('Distribua exatamente 100% do orçamento entre os seis setores.');
  if (
    tax === state.tax &&
    interest === state.interest &&
    SECTORS.every((x) => budget[x.id] === state.budget[x.id])
  )
    throw new Error('Altere a política fiscal antes de aplicar.');
  const s = copy(state);
  spend(s, 0, 10);
  applyEffects(s, { approval: (s.tax - tax) * 0.8, growth: (s.interest - interest) * 0.06 });
  s.tax = tax;
  s.interest = interest;
  s.budget = { ...budget };
  news(
    s,
    'Governo apresenta nova política econômica',
    `Carga tributária de ${tax}% e juros de ${interest}% ao ano. A distribuição do orçamento foi atualizada.`,
    'economy',
  );
  return s;
}

export function appointMinister(state, id, mode) {
  if (!['technical', 'political'].includes(mode)) throw new Error('Perfil inválido.');
  const s = copy(state);
  const m = s.ministers.find((x) => x.id === id);
  if (!m || m.mode === mode) throw new Error('Selecione um novo perfil para o ministério.');
  spend(s, 0, 8);
  m.mode = mode;
  news(
    s,
    `Mudança no ministério de ${MINISTERS.find((x) => x.id === id).department}`,
    mode === 'technical'
      ? 'A pasta adotará um perfil técnico, com bônus mensal de desempenho.'
      : 'A pasta adotará um perfil de articulação, com bônus mensal de capital político.',
    'politics',
  );
  return s;
}

export function diplomacy(state, target, action) {
  const s = copy(state);
  const r = s.relations[target];
  const c = COUNTRIES.find((x) => x.id === target);
  if (!r || !c) throw new Error('Escolha um parceiro internacional válido.');
  const descriptions = {
    visit: 'Missão diplomática',
    trade: 'Acordo comercial',
    alliance: 'Aliança de cooperação',
    sanction: 'Sanções econômicas',
    peace: 'Acordo de paz',
    war: 'Estado de guerra',
    intelligence: 'Análise estratégica',
  };
  if (!descriptions[action]) throw new Error('Ação diplomática inválida.');
  if (r.war && !['peace', 'intelligence'].includes(action))
    throw new Error('Negocie a paz antes de retomar relações diplomáticas.');
  if (action === 'trade' && (r.treaty || r.sanctioned || r.score < 60))
    throw new Error('O acordo exige relação mínima de 60, sem sanções e sem tratado vigente.');
  if (action === 'alliance' && (r.alliance || r.score < 75 || r.sanctioned))
    throw new Error('A aliança exige relação mínima de 75, sem sanções e sem aliança vigente.');
  if (action === 'war' && (r.war || r.alliance || r.score > 35))
    throw new Error('O conflito exige relação de até 35 e ausência de aliança.');
  if (action === 'sanction' && r.sanctioned) throw new Error('Já existem sanções em vigor.');
  if (action === 'peace' && !r.war) throw new Error('Não existe conflito ativo com este país.');
  spend(s, action === 'war' ? 10 : action === 'trade' ? 3 : 1, action === 'war' ? 25 : 8);
  if (action === 'visit') r.score = clamp(r.score + 12, 0, 100);
  if (action === 'trade') {
    r.treaty = true;
    r.score = clamp(r.score + 6, 0, 100);
    applyEffects(s, { growth: 0.3, unemployment: -0.2 });
  }
  if (action === 'alliance') {
    r.alliance = true;
    applyEffects(s, { stability: 3, defense: 3 });
  }
  if (action === 'sanction') {
    r.sanctioned = true;
    r.treaty = false;
    r.alliance = false;
    r.score = clamp(r.score - 30, 0, 100);
    applyEffects(s, { growth: -0.2, inflation: 0.3 });
  }
  if (action === 'war') {
    r.war = true;
    r.treaty = false;
    r.score = 0;
    applyEffects(s, { stability: -12, approval: -8, growth: -0.8, inflation: 1 });
  }
  if (action === 'peace') {
    r.war = false;
    r.sanctioned = false;
    r.score = 35;
    applyEffects(s, { approval: 5, stability: 8, growth: 0.4 });
  }
  if (action === 'intelligence') {
    r.tension = Math.round(100 - r.score);
    applyEffects(s, { defense: 2 });
  }
  news(
    s,
    `${descriptions[action]}: ${c.name}`,
    action === 'intelligence'
      ? `Análise concluída. Índice de tensão: ${r.tension}/100. A capacidade de defesa aumentou.`
      : `A decisão altera a relação bilateral e repercute na economia e na estabilidade do país.`,
    'world',
  );
  return s;
}

export function modernizeDefense(state, branch) {
  if (!['Exército', 'Marinha', 'Aeronáutica', 'Inteligência'].includes(branch))
    throw new Error('Área de defesa inválida.');
  const s = copy(state);
  spend(s, 6, 10);
  applyEffects(s, { defense: 6, security: 2, science: 1 });
  news(
    s,
    `${branch}: modernização aprovada`,
    'Equipamentos, treinamento e capacidade de resposta recebem novos recursos.',
    'defense',
  );
  return s;
}

export function advanceMonth(state) {
  if (state.status !== 'active') throw new Error('Este mandato foi encerrado.');
  if (state.event !== null) throw new Error('Responda à situação urgente antes de avançar o mês.');
  const s = copy(state);
  const base = countryOf(s);
  s.month++;
  s.actions = 3;
  s.negotiated = [];
  s.capital += 12 + s.ministers.filter((m) => m.mode === 'political').length * 3;
  const fiscal = financials(s);
  s.metrics.treasury += fiscal.balance;
  if (s.metrics.treasury < 0) {
    s.metrics.debt += (-s.metrics.treasury / s.metrics.gdp) * 100;
    s.metrics.treasury = 0;
    applyEffects(s, { stability: -1, approval: -1 });
    news(
      s,
      'Tesouro emite dívida para cobrir o déficit',
      'Revise a arrecadação e os juros para recuperar o equilíbrio fiscal.',
      'economy',
    );
  }
  const shock = (random(s) - 0.5) * 0.45;
  const trade = Object.values(s.relations).filter((r) => r.treaty).length;
  const wars = Object.values(s.relations).filter((r) => r.war).length;
  s.metrics.growth +=
    (base.growth - s.metrics.growth) * 0.08 +
    shock +
    trade * 0.025 -
    wars * 0.15 +
    (s.metrics.infrastructure - 50) * 0.003;
  s.metrics.inflation +=
    (3 - s.metrics.inflation) * 0.06 +
    (s.metrics.growth - 2) * 0.025 -
    (s.interest - 8) * 0.02 +
    wars * 0.15;
  s.metrics.unemployment += -s.metrics.growth * 0.035 + (random(s) - 0.5) * 0.16;
  const priorGdp = s.metrics.gdp;
  s.metrics.gdp *= 1 + s.metrics.growth / 1200;
  s.metrics.debt *= priorGdp / s.metrics.gdp;
  s.metrics.approval +=
    (s.metrics.growth - 2) * 0.2 -
    Math.max(0, s.metrics.inflation - 6) * 0.08 -
    Math.max(0, s.metrics.unemployment - 9) * 0.06 -
    wars;
  for (const sector of SECTORS) s.metrics[sector.id] += (s.budget[sector.id] - 15) * 0.07 - 0.1;
  for (const m of s.ministers.filter((m) => m.mode === 'technical')) {
    const data = MINISTERS.find((x) => x.id === m.id);
    s.metrics[data.bonus] += data.value;
  }
  for (const project of s.projects) {
    project.remaining--;
    if (project.remaining <= 0) {
      const p = PROJECTS.find((x) => x.id === project.type);
      applyEffects(s, p.effects);
      s.completed.push({ ...project, month: s.month });
      news(
        s,
        `Entregue: ${p.title}`,
        `${project.region} recebe a obra. Os benefícios já aparecem nos indicadores.`,
        'development',
      );
    }
  }
  s.projects = s.projects.filter((p) => p.remaining > 0);
  for (const study of s.studies) {
    study.remaining--;
    if (study.remaining <= 0) {
      s.research[study.type]++;
      applyEffects(s, {
        science: 3,
        growth: 0.15,
        ...(study.type === 'energy' || study.type === 'climate' ? { environment: 4 } : {}),
        ...(study.type === 'defense' ? { defense: 5 } : {}),
        ...(study.type === 'health' ? { health: 5 } : {}),
      });
      news(
        s,
        `Descoberta: ${RESEARCH.find((x) => x.id === study.type).levels[study.level]}`,
        'A tecnologia foi incorporada à capacidade nacional.',
        'science',
      );
    }
  }
  s.studies = s.studies.filter((x) => x.remaining > 0);
  s.laws = s.laws.filter((law) => {
    const p = POLICIES.find((x) => x.id === law.policy);
    const expected = support(s) / base.seats;
    const votes = Math.round(clamp(expected + (random(s) - 0.5) * 0.08, 0, 1) * base.seats);
    const senators = Math.round(clamp(expected + (random(s) - 0.5) * 0.1, 0, 1) * base.senate);
    const threshold = p.constitutional
      ? Math.ceil(base.seats * 0.6)
      : Math.floor(base.seats / 2) + 1;
    const senateThreshold = p.constitutional
      ? Math.ceil(base.senate * 0.6)
      : Math.floor(base.senate / 2) + 1;
    const passed = votes >= threshold && (!base.senate || senators >= senateThreshold);
    const tally = `${votes}/${base.seats} votos na Câmara${base.senate ? ` e ${senators}/${base.senate} no Senado` : ''}.`;
    if (!passed) {
      news(s, `Rejeitada: ${p.title}`, `${tally} Negocie apoio antes de reapresentar.`, 'politics');
      applyEffects(s, { approval: -1 });
      return false;
    }
    law.rounds++;
    if (p.constitutional && law.rounds < 2) {
      news(
        s,
        `${p.title} aprovada em primeiro turno`,
        `${tally} A votação final ocorrerá no próximo mês.`,
        'politics',
      );
      return true;
    }
    s.enacted.push(p.id);
    applyEffects(s, p.effects);
    news(s, `Aprovada: ${p.title}`, `${tally} A lei entra em vigor.`, 'politics');
    return false;
  });
  for (const [id, relation] of Object.entries(s.relations)) {
    if (!relation.war)
      relation.score = round(clamp(relation.score + (random(s) - 0.5) * 2, 0, 100));
    else {
      s.metrics.defense -= 1;
      s.metrics.stability -= 0.5;
    }
    s.world[id].growth = round(clamp(s.world[id].growth + (random(s) - 0.5) * 0.3, -8, 12));
    s.world[id].gdp *= 1 + s.world[id].growth / 1200;
  }
  if (s.month % 3 === 0) {
    s.event = Math.floor(random(s) * EVENTS.length);
    const c = COUNTRIES[Math.floor(random(s) * COUNTRIES.length)];
    if (c.id !== s.country)
      news(
        s,
        `${c.name} anuncia nova agenda econômica`,
        `O crescimento projetado é de ${s.world[c.id].growth.toFixed(1)}%. A diplomacia acompanha os próximos movimentos.`,
        'world',
      );
  }
  if (s.month % 6 === 0)
    news(
      s,
      'Pesquisa nacional avalia o governo',
      `A aprovação chegou a ${Math.round(s.metrics.approval)}%. A população acompanha os resultados.`,
      'politics',
    );
  if (s.month % 48 === 0) {
    if (s.metrics.approval >= 45 && s.metrics.stability >= 30) {
      s.term++;
      news(
        s,
        'Vitória nas urnas: um novo mandato começa',
        'A população renovou a confiança no governo. A simulação continua.',
        'election',
      );
    } else {
      s.status = 'defeated';
      s.event = null;
      news(
        s,
        'As urnas escolheram um novo caminho',
        'O mandato foi encerrado. Seu legado permanece no relatório desta partida.',
        'election',
      );
    }
  }
  if (s.metrics.approval < 15 && s.metrics.stability < 25) {
    s.status = 'impeached';
    s.event = null;
    news(
      s,
      'Crise encerra o mandato',
      'A perda de apoio popular e institucional levou à destituição do governo.',
      'politics',
    );
  }
  normalize(s);
  s.history.push({ month: s.month, ...s.metrics });
  s.history = s.history.slice(-120);
  return s;
}

export function interpretProposal(text) {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const rules = [
    ['constitution', /constitu|institui|fiscaliza|poderes/],
    ['tax', /tribut|imposto|taxa/],
    ['austerity', /cort|auster|deficit|divida/],
    ['health', /saude|hospital|vacina|medic|sus/],
    ['education', /educa|escola|professor|universid/],
    ['green', /ambient|energia|renova|florest|solar|clima/],
    ['security', /seguran|polici|crime|pris/],
    ['labor', /salario|trabalh|empregad|direitos/],
    ['housing', /morad|casa|habit|sanea/],
    ['transparency', /corrup|transpar|auditor/],
    ['business', /empres|industr|credito|empreend/],
    ['income', /renda|pobre|familia|fome|social/],
  ];
  if (normalized.trim().length < 15) return null;
  const found = rules.find(([, regex]) => regex.test(normalized));
  return found ? POLICIES.find((p) => p.id === found[0]) : null;
}

export function validateSave(value) {
  if (!value || value.version !== 1 || !COUNTRIES.some((c) => c.id === value.country))
    throw new Error('Este arquivo não é um salvamento compatível com Soberania.');
  const baseline = createGame({ country: value.country });
  // Saved dictionaries must match the scenario; unknown IDs could break a future turn.
  for (const key of ['metrics', 'budget', 'research', 'relations', 'world']) {
    const actual = value[key];
    const expected = Object.keys(baseline[key]);
    if (
      !actual ||
      Array.isArray(actual) ||
      typeof actual !== 'object' ||
      Object.keys(actual).length !== expected.length ||
      expected.some((id) => !Object.hasOwn(actual, id))
    )
      throw new Error('O arquivo contém uma estrutura incompatível com o cenário.');
  }
  if (
    typeof value.name !== 'string' ||
    value.name.length > 50 ||
    !Number.isInteger(value.month) ||
    value.month < 0 ||
    value.month > 12000 ||
    !['active', 'defeated', 'impeached'].includes(value.status)
  )
    throw new Error('O arquivo contém dados de partida inválidos.');
  for (const key of ['term', 'seed', 'nextId', 'actions', 'capital', 'tax', 'interest'])
    if (!Number.isFinite(value[key])) throw new Error('O arquivo contém parâmetros inválidos.');
  for (const key of Object.keys(baseline.metrics))
    if (!Number.isFinite(value.metrics?.[key]))
      throw new Error('O arquivo contém indicadores inválidos.');
  if (
    value.metrics.gdp <= 0 ||
    value.actions < 0 ||
    value.actions > 3 ||
    value.tax < 20 ||
    value.tax > 45 ||
    value.interest < 1 ||
    value.interest > 25
  )
    throw new Error('Parâmetros fora dos limites da simulação.');
  if (value.event !== null && (!Number.isInteger(value.event) || !EVENTS[value.event]))
    throw new Error('Evento de salvamento inválido.');
  const arrays = [
    'parties',
    'negotiated',
    'ministers',
    'projects',
    'completed',
    'studies',
    'laws',
    'enacted',
    'history',
    'news',
  ];
  for (const key of arrays)
    if (!Array.isArray(value[key]) || value[key].length > 10000)
      throw new Error('Estrutura de salvamento inválida.');
  for (const sector of SECTORS)
    if (
      !Number.isFinite(value.budget?.[sector.id]) ||
      value.budget[sector.id] < 0 ||
      value.budget[sector.id] > 100
    )
      throw new Error('Orçamento inválido.');
  if (Math.abs(SECTORS.reduce((n, x) => n + value.budget[x.id], 0) - 100) > 0.01)
    throw new Error('Orçamento incompleto.');
  if (
    value.parties.length !== baseline.parties.length ||
    value.parties.some(
      (p, i) =>
        p.id !== baseline.parties[i].id ||
        p.seats !== baseline.parties[i].seats ||
        typeof p.name !== 'string' ||
        typeof p.color !== 'string' ||
        !Number.isFinite(p.relation) ||
        p.relation < 0 ||
        p.relation > 100,
    )
  )
    throw new Error('Parlamento inválido.');
  if (
    value.ministers.length !== MINISTERS.length ||
    value.ministers.some(
      (m, i) => m.id !== MINISTERS[i].id || !['technical', 'political'].includes(m.mode),
    )
  )
    throw new Error('Gabinete inválido.');
  for (const r of RESEARCH)
    if (
      !Number.isInteger(value.research?.[r.id]) ||
      value.research[r.id] < 0 ||
      value.research[r.id] > 3
    )
      throw new Error('Pesquisa inválida.');
  for (const [id] of Object.entries(baseline.relations)) {
    const r = value.relations?.[id];
    if (
      !r ||
      !Number.isFinite(r.score) ||
      r.score < 0 ||
      r.score > 100 ||
      ['treaty', 'alliance', 'sanctioned', 'war'].some((k) => typeof r[k] !== 'boolean') ||
      !Number.isFinite(value.world?.[id]?.gdp) ||
      value.world[id].gdp <= 0 ||
      !Number.isFinite(value.world?.[id]?.growth)
    )
      throw new Error('Relação diplomática inválida.');
  }
  for (const p of [...value.projects, ...value.completed])
    if (
      !PROJECTS.some((x) => x.id === p.type) ||
      !Number.isFinite(p.remaining) ||
      !Number.isFinite(p.total) ||
      !Number.isInteger(p.id) ||
      p.total <= 0 ||
      typeof p.region !== 'string'
    )
      throw new Error('Obra inválida.');
  for (const r of value.studies)
    if (
      !RESEARCH.some((x) => x.id === r.type) ||
      !Number.isInteger(r.level) ||
      r.level < 0 ||
      r.level > 2 ||
      !Number.isFinite(r.remaining) ||
      !Number.isFinite(r.total)
    )
      throw new Error('Pesquisa em andamento inválida.');
  for (const l of value.laws)
    if (!POLICIES.some((x) => x.id === l.policy) || !Number.isInteger(l.rounds))
      throw new Error('Lei inválida.');
  if (value.enacted.some((id) => !POLICIES.some((p) => p.id === id)))
    throw new Error('Medida inválida.');
  for (const item of value.news)
    if (
      typeof item.title !== 'string' ||
      typeof item.description !== 'string' ||
      typeof item.type !== 'string' ||
      !Number.isFinite(item.month)
    )
      throw new Error('Notícia inválida.');
  for (const row of value.history)
    if (
      !Number.isInteger(row.month) ||
      Object.keys(baseline.metrics).some((k) => !Number.isFinite(row[k]))
    )
      throw new Error('Histórico inválido.');
  if (!value.history.length) throw new Error('O histórico está vazio.');
  const s = copy(value);
  normalize(s);
  return s;
}
