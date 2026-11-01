import React, { useEffect, useState } from 'react';
import { COUNTRIES, SECTORS, POLICIES, PROJECTS, RESEARCH, EVENTS, MINISTERS } from './data.js';
import {
  countryOf,
  dateOf,
  support,
  financials,
  costOf,
  legacy,
  buildProject,
  startResearch,
  negotiate,
  updateFiscal,
  appointMinister,
  diplomacy,
  modernizeDefense,
} from './engine.js';
import {
  Icon,
  Button,
  Badge,
  Progress,
  Empty,
  Sparkline,
  Hemicycle,
  Globe,
  number,
  money,
} from './components.jsx';

function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function PanelTitle({ eyebrow, title, children }) {
  return (
    <div className="panel-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
function MiniStat({ label, value, icon, detail, color }) {
  return (
    <div className="mini-stat">
      <span>
        <Icon name={icon || 'Activity'} size={17} />
        {label}
      </span>
      <strong style={{ color }}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function StatCard({ s, metric, title, icon, suffix, invert = false, format }) {
  const value = s.metrics[metric];
  const previous = s.history.length > 1 ? s.history.at(-2)[metric] : s.history[0][metric];
  const delta = value - previous;
  const positive = invert ? delta <= 0 : delta >= 0;
  return (
    <article className="stat-card">
      <div className="stat-label">
        <span>{title}</span>
        <Icon name={icon} size={18} />
      </div>
      <div className="stat-main">
        <strong>
          {format ? format(value) : number(value, metric === 'approval' ? 0 : 1)}
          <small>{suffix}</small>
        </strong>
        <Sparkline
          values={s.history
            .slice(-12)
            .map((h) => h[metric])
            .concat(value)}
          color={metric === 'inflation' ? '#d9b782' : '#b8d7a1'}
        />
      </div>
      <div className="stat-foot">
        {Math.abs(delta) > 0.01 ? (
          <>
            <span className={positive ? 'positive' : 'negative'}>
              <Icon name={delta >= 0 ? 'TrendingUp' : 'TrendingDown'} size={13} />
              {delta >= 0 ? '+' : ''}
              {number(delta, 1)}
              {metric === 'treasury' ? ' bi' : ' p.p.'}
            </span>
            <span>em relação ao mês anterior</span>
          </>
        ) : (
          <>
            <span className="neutral-dot" />{' '}
            <span>{s.month ? 'Estável neste mês' : 'Ponto de partida do mandato'}</span>
          </>
        )}
      </div>
    </article>
  );
}

export function Dashboard({ s, go, setModal, selected, setSelected }) {
  const [mapMode, setMapMode] = useState('political');
  const c = countryOf(s);
  const focus = COUNTRIES.find((x) => x.id === selected) || c;
  const event = s.event !== null ? EVENTS[s.event] : null;
  const seats = support(s);
  return (
    <>
      <div className="dashboard-greeting">
        <span className="eyebrow">
          <span className="tiny-line" /> {c.capital.toUpperCase()} ·{' '}
          {dateOf(s.month, true).toUpperCase()}
        </span>
        <span className="scenario-label">
          <span className="live-dot" /> CENÁRIO GLOBAL · 2026
        </span>
      </div>
      <PageHeading
        title="O futuro está nas suas mãos."
        description="Cada decisão deixa uma marca. Qual será a sua?"
      >
        <Button variant="primary" icon="Plus" onClick={() => setModal({ type: 'decision' })}>
          Tomar uma decisão
        </Button>
      </PageHeading>
      <div className="stats-grid">
        <StatCard s={s} metric="approval" title="Aprovação popular" icon="Users" suffix="%" />
        <StatCard
          s={s}
          metric="growth"
          title="Crescimento do PIB"
          icon="ChartNoAxesCombined"
          suffix="%"
        />
        <StatCard
          s={s}
          metric="inflation"
          title="Inflação anual"
          icon="ChartSpline"
          suffix="%"
          invert
        />
        <StatCard
          s={s}
          metric="treasury"
          title="Reservas do Tesouro"
          icon="Landmark"
          format={(v) => number(v, 1)}
          suffix=" bi"
        />
      </div>
      <div className="command-grid">
        <section className="panel world-panel">
          <PanelTitle eyebrow="UM MUNDO EM MOVIMENTO" title="O tabuleiro global">
            <span className="live-label">
              <span className="live-dot" /> Ao vivo na simulação
            </span>
          </PanelTitle>
          <div className="map-toolbar">
            <div className="segmented-control">
              {[
                ['political', 'Geopolítico'],
                ['relations', 'Relações'],
                ['economy', 'Economia'],
              ].map(([id, label]) => (
                <button
                  className={mapMode === id ? 'selected' : ''}
                  key={id}
                  onClick={() => setMapMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="map-hint">
              <Icon name="MousePointer2" size={13} /> Arraste para explorar
            </span>
          </div>
          <Globe
            country={s.country}
            selected={selected}
            relations={s.relations}
            mode={mapMode}
            onSelect={setSelected}
          />
          <div className="map-country">
            <span className="flag">{focus.flag}</span>
            <div>
              <strong>{focus.name}</strong>
              <small>
                {focus.id === s.country ? 'Sua nação · ' : ''}
                {focus.region}
              </small>
            </div>
            <div className="map-country-stat">
              <small>{focus.id === s.country ? 'ESTABILIDADE' : 'RELAÇÃO BILATERAL'}</small>
              <strong>
                {focus.id === s.country
                  ? Math.round(s.metrics.stability)
                  : Math.round(s.relations[focus.id]?.score || 0)}
                <span>/100</span>
              </strong>
            </div>
            <button
              className="icon-button"
              aria-label={`Ver detalhes de ${focus.name}`}
              onClick={() => go(focus.id === s.country ? 'government' : 'diplomacy')}
            >
              <Icon name="ArrowUpRight" size={19} />
            </button>
          </div>
        </section>
        <div className="command-right">
          <section className="panel agenda-panel">
            <PanelTitle title="Na sua mesa">
              <Badge tone={event ? 'amber' : ''}>{event ? '1 urgente' : 'Em dia'}</Badge>
            </PanelTitle>
            {event ? (
              <>
                <div className="event-art">
                  <Icon name={event.icon} size={46} />
                  <span className="event-art-lines" />
                  <span className="event-category">{event.tag}</span>
                </div>
                <h3>{event.title}</h3>
                <p>{event.description}</p>
                <button className="text-button" onClick={() => setModal({ type: 'event' })}>
                  Analisar situação <Icon name="ArrowRight" size={16} />
                </button>
              </>
            ) : (
              <div className="agenda-clear">
                <span className="tile-icon">
                  <Icon name="CheckCheck" size={28} />
                </span>
                <h3>Uma pausa para planejar.</h3>
                <p>
                  As urgências foram encaminhadas. Use as decisões restantes para construir seu
                  projeto de país.
                </p>
                <button className="text-button" onClick={() => setModal({ type: 'decision' })}>
                  Explorar medidas <Icon name="ArrowRight" size={16} />
                </button>
              </div>
            )}
          </section>
          <section className="panel congress-preview">
            <PanelTitle title="Governabilidade">
              <button
                className="icon-button"
                aria-label="Abrir Congresso"
                onClick={() => go('congress')}
              >
                <Icon name="ArrowUpRight" size={17} />
              </button>
            </PanelTitle>
            <div className="congress-preview-content">
              <Hemicycle parties={s.parties} />
              <div>
                <strong>
                  {seats}
                  <span>/{c.seats}</span>
                </strong>
                <small>votos estimados</small>
                <Badge tone={seats > c.seats / 2 ? 'green' : 'amber'}>
                  {seats > c.seats / 2 ? 'Maioria provável' : 'Apoio em construção'}
                </Badge>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="lower-grid">
        <section className="panel priorities-panel">
          <PanelTitle eyebrow="SEU PROJETO DE PAÍS" title="Construir hoje. Transformar amanhã.">
            <button className="text-button muted" onClick={() => go('development')}>
              Ver projetos <Icon name="ArrowUpRight" size={14} />
            </button>
          </PanelTitle>
          <div className="priority-cards">
            {[
              [
                'GraduationCap',
                'Educação para o futuro',
                'Conhecimento que transforma gerações.',
                'education',
                'education',
              ],
              [
                'Leaf',
                'Uma economia mais verde',
                'Crescer preservando o que importa.',
                'green',
                'environment',
              ],
              [
                'HeartPulse',
                'Cuidar de quem precisa',
                'Mais acesso. Mais qualidade de vida.',
                'health',
                'health',
              ],
            ].map(([icon, title, text, policy, metric]) => (
              <button key={policy} onClick={() => setModal({ type: 'policy', id: policy })}>
                <span className={`priority-icon ${metric}`}>
                  <Icon name={icon} size={23} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                <div>
                  <span>
                    Índice atual <b>{Math.round(s.metrics[metric])}/100</b>
                  </span>
                  <Icon name="ArrowUpRight" size={15} />
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="panel news-preview">
          <PanelTitle title="O país em pauta">
            <button
              className="icon-button"
              aria-label="Ler todas as notícias"
              onClick={() => go('news')}
            >
              <Icon name="ArrowUpRight" size={17} />
            </button>
          </PanelTitle>
          {s.news.slice(0, 3).map((n, i) => (
            <button className="news-preview-row" key={n.id} onClick={() => go('news')}>
              <span className="news-index">0{i + 1}</span>
              <div>
                <small>
                  {dateOf(n.month).toUpperCase()} <i /> {newsType(n.type)}
                </small>
                <h3>{n.title}</h3>
              </div>
            </button>
          ))}
        </section>
      </div>
    </>
  );
}

export function Government({ s, act, setModal }) {
  const c = countryOf(s);
  const goals = [
    { label: 'Uma população que confia', value: s.metrics.approval, goal: 65, icon: 'Users' },
    {
      label: 'Educação como prioridade',
      value: s.metrics.education,
      goal: 70,
      icon: 'GraduationCap',
    },
    { label: 'Um futuro sustentável', value: s.metrics.environment, goal: 65, icon: 'Leaf' },
  ];
  return (
    <>
      <PageHeading
        eyebrow="A ARTE DE GOVERNAR"
        title="Seu gabinete. Seu projeto de país."
        description="Defina prioridades, forme uma equipe e transforme promessas em resultados."
      >
        <Button variant="primary" icon="PenLine" onClick={() => setModal({ type: 'decision' })}>
          Nova decisão
        </Button>
      </PageHeading>
      <div className="government-hero">
        <div>
          <span className="eyebrow">
            {c.flag} GOVERNO DE {c.name.toUpperCase()}
          </span>
          <h2>{s.name}</h2>
          <p>
            {c.leader} · {s.term}º mandato · {dateOf(s.month, true)}
          </p>
          <div className="hero-badges">
            <Badge tone="green">{Math.round(s.metrics.approval)}% de aprovação</Badge>
            <Badge>{s.actions} decisões disponíveis</Badge>
          </div>
        </div>
        <div className="capital-ring" style={{ '--progress': `${s.capital}%` }}>
          <div>
            <strong>{Math.round(s.capital)}</strong>
            <span>capital político</span>
          </div>
        </div>
        <Icon name="Landmark" size={160} className="hero-watermark" />
      </div>
      <div className="section-intro">
        <h2>Quem está ao seu lado</h2>
        <p>
          Perfis técnicos melhoram indicadores. Articuladores recuperam +3 de capital político por
          mês.
        </p>
      </div>
      <div className="minister-grid">
        {MINISTERS.map((m, i) => (
          <article className="panel minister-card" key={m.id}>
            <div className="minister-top">
              <span className="minister-avatar" style={{ '--avatar-color': m.color }}>
                {m.initials}
              </span>
              <Badge>
                {s.ministers[i].mode === 'technical' ? 'Perfil técnico' : 'Articulação'}
              </Badge>
            </div>
            <small>MINISTÉRIO DE {m.department.toUpperCase()}</small>
            <h3>{m.name}</h3>
            <p>{m.specialty}</p>
            <div className="minister-bonus">
              <Icon name="TrendingUp" size={14} />
              {s.ministers[i].mode === 'technical'
                ? `+${number(m.value, 2)} ${m.bonus === 'growth' ? 'crescimento' : m.bonus === 'approval' ? 'aprovação' : m.bonus === 'stability' ? 'estabilidade' : 'ciência'} / mês`
                : '+3 capital político / mês'}
            </div>
            <Button
              variant="subtle"
              onClick={() =>
                act(
                  (x) =>
                    appointMinister(
                      x,
                      m.id,
                      s.ministers[i].mode === 'technical' ? 'political' : 'technical',
                    ),
                  'Perfil ministerial atualizado.',
                )
              }
              icon="RefreshCw"
            >
              Mudar perfil · 8 CP
            </Button>
          </article>
        ))}
      </div>
      <div className="section-intro">
        <h2>Compromissos do mandato</h2>
        <p>Objetivos de referência para acompanhar o desenvolvimento do seu governo.</p>
      </div>
      <div className="three-grid">
        {goals.map((g) => (
          <article className="panel goal-card" key={g.label}>
            <Icon name={g.icon} size={22} />
            <h3>{g.label}</h3>
            <div className="goal-value">
              {Math.round(g.value)}
              <span> / {g.goal}</span>
              {g.value >= g.goal && <Badge tone="green">Meta alcançada</Badge>}
            </div>
            <Progress value={(g.value / g.goal) * 100} />
          </article>
        ))}
      </div>
    </>
  );
}

export function Economy({ s, act }) {
  const [tax, setTax] = useState(s.tax);
  const [interest, setInterest] = useState(s.interest);
  const [budget, setBudget] = useState({ ...s.budget });
  useEffect(() => {
    setTax(s.tax);
    setInterest(s.interest);
    setBudget({ ...s.budget });
  }, [s.tax, s.interest, s.budget]);
  const total = Object.values(budget).reduce((a, b) => a + b, 0);
  const f = financials(s);
  const forecast = financials({ ...s, tax, interest, budget });
  const changed =
    tax !== s.tax ||
    interest !== s.interest ||
    SECTORS.some((x) => budget[x.id] !== s.budget[x.id]);
  return (
    <>
      <PageHeading
        eyebrow="MINISTÉRIO DA ECONOMIA"
        title="Equilibrar para avançar."
        description="O orçamento revela suas prioridades. Os indicadores mostram as consequências."
      />
      <div className="stats-grid">
        <MiniStat
          label="PIB nacional"
          value={money(s.metrics.gdp)}
          detail="Produção anual estimada"
          icon="ChartNoAxesCombined"
        />
        <MiniStat
          label="Inflação"
          value={`${number(s.metrics.inflation, 1)}%`}
          detail="Variação anual de preços"
          icon="ChartSpline"
        />
        <MiniStat
          label="Desemprego"
          value={`${number(s.metrics.unemployment, 1)}%`}
          detail="População economicamente ativa"
          icon="Users"
        />
        <MiniStat
          label="Dívida pública"
          value={`${number(s.metrics.debt, 1)}%`}
          detail="Em relação ao PIB"
          icon="Landmark"
        />
      </div>
      <div className="two-grid economy-grid">
        <section className="panel">
          <PanelTitle title="Política econômica">
            <Badge>1 decisão · 10 CP</Badge>
          </PanelTitle>
          <div className="panel-body">
            <div className="range-field">
              <label htmlFor="tax">
                Carga tributária <strong>{tax}%</strong>
              </label>
              <input
                id="tax"
                type="range"
                min="20"
                max="45"
                value={tax}
                onChange={(e) => setTax(+e.target.value)}
              />
              <div>
                <span>20% · menor arrecadação</span>
                <span>45% · maior pressão popular</span>
              </div>
            </div>
            <div className="range-field">
              <label htmlFor="interest">
                Taxa básica de juros <strong>{number(interest, 1)}%</strong>
              </label>
              <input
                id="interest"
                type="range"
                min="1"
                max="25"
                step="0.5"
                value={interest}
                onChange={(e) => setInterest(+e.target.value)}
              />
              <div>
                <span>1% · estimular a economia</span>
                <span>25% · conter a inflação</span>
              </div>
            </div>
            <div className="fiscal-summary">
              <span>
                Receita mensal atual <strong>{money(f.income)}</strong>
              </span>
              <span>
                Despesas e juros <strong>{money(f.spending)}</strong>
              </span>
              <span className="total">
                Saldo mensal projetado{' '}
                <strong className={forecast.balance >= 0 ? 'positive' : 'negative'}>
                  {forecast.balance >= 0 ? '+' : ''}
                  {money(forecast.balance)}
                </strong>
              </span>
            </div>
            <p className="fine-print">
              As novas alíquotas passam a valer ao confirmar. A movimentação de receitas e despesas
              acontece na virada do mês.
            </p>
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Distribuição do orçamento">
            <Badge tone={total === 100 ? 'green' : 'amber'}>{total}% de 100%</Badge>
          </PanelTitle>
          <div className="panel-body budget-fields">
            {SECTORS.map((sector) => (
              <div className="budget-field" key={sector.id}>
                <label htmlFor={`budget-${sector.id}`}>
                  <Icon name={sector.icon} size={17} style={{ color: sector.color }} />
                  <span>{sector.name}</span>
                  <strong>{budget[sector.id]}%</strong>
                </label>
                <input
                  id={`budget-${sector.id}`}
                  type="range"
                  min="0"
                  max="50"
                  value={budget[sector.id]}
                  onChange={(e) => setBudget((b) => ({ ...b, [sector.id]: +e.target.value }))}
                />
              </div>
            ))}
            <div className="budget-total">
              <span>
                {total === 100
                  ? 'Orçamento equilibrado'
                  : total > 100
                    ? `Reduza ${total - 100} pontos para equilibrar`
                    : `Distribua os ${100 - total} pontos restantes`}
              </span>
              <Icon name={total === 100 ? 'CircleCheck' : 'CircleAlert'} size={18} />
            </div>
          </div>
        </section>
      </div>
      <div className="form-action-bar">
        <p>
          <Icon name="Info" size={17} /> Priorizar um setor acelera seus indicadores e reduz
          recursos disponíveis para os demais.
        </p>
        <Button
          variant="primary"
          icon="Check"
          disabled={total !== 100 || !changed}
          onClick={() =>
            act((x) => updateFiscal(x, { tax, interest, budget }), 'Política econômica atualizada.')
          }
        >
          Aplicar política econômica
        </Button>
      </div>
      <section className="panel chart-panel">
        <PanelTitle title="A economia ao longo do tempo">
          <Badge>{s.history.length} meses registrados</Badge>
        </PanelTitle>
        <div className="chart-large">
          <div className="chart-labels">
            <span>{number(Math.max(...s.history.map((h) => h.growth)), 1)}%</span>
            <span>CRESCIMENTO</span>
            <span>{number(Math.min(...s.history.map((h) => h.growth)), 1)}%</span>
          </div>
          <Sparkline values={s.history.map((h) => h.growth)} filled height={160} />
        </div>
        <div className="chart-dates">
          <span>{dateOf(s.history[0].month)}</span>
          <span>{dateOf(s.month)}</span>
        </div>
      </section>
    </>
  );
}

export function Congress({ s, act, setModal }) {
  const c = countryOf(s);
  const votes = support(s);
  const threshold = Math.floor(c.seats / 2) + 1;
  return (
    <>
      <PageHeading
        eyebrow="ARTICULAÇÃO POLÍTICA"
        title="Nenhum governo governa sozinho."
        description="Construa maiorias, negocie uma agenda e acompanhe suas propostas."
      >
        <Button icon="Plus" variant="primary" onClick={() => setModal({ type: 'decision' })}>
          Propor uma lei
        </Button>
      </PageHeading>
      <div className="two-grid congress-grid">
        <section className="panel chamber">
          <PanelTitle title="Câmara dos representantes">
            <Badge>{c.seats} cadeiras</Badge>
          </PanelTitle>
          <Hemicycle parties={s.parties} size="big" />
          <div className="chamber-stats">
            <div>
              <strong>{votes}</strong>
              <span>votos estimados</span>
            </div>
            <div>
              <strong>{threshold}</strong>
              <span>maioria necessária</span>
            </div>
            <div>
              <strong>{Math.ceil(c.seats * 0.6)}</strong>
              <span>reforma constitucional</span>
            </div>
          </div>
          <p className="fine-print">
            Estimativas refletem a relação com cada bancada; o resultado da votação pode variar.{' '}
            {c.senate > 0
              ? `O Senado possui ${c.senate} cadeiras e também vota as propostas.`
              : 'Este cenário utiliza um Parlamento unicameral.'}
          </p>
        </section>
        <section className="panel">
          <PanelTitle title="Em tramitação">
            <Badge>{s.laws.length} propostas</Badge>
          </PanelTitle>
          {!s.laws.length ? (
            <Empty
              icon="ScrollText"
              title="A pauta está aberta."
              text="Envie uma reforma tributária, proteção ao trabalho ou reforma institucional pela agenda de decisões."
            />
          ) : (
            <div className="panel-body">
              {s.laws.map((l) => {
                const p = POLICIES.find((x) => x.id === l.policy);
                return (
                  <div className="bill-card" key={l.id}>
                    <Badge tone="amber">
                      {p.constitutional ? `${l.rounds + 1}º turno` : 'Votação pendente'}
                    </Badge>
                    <h3>{p.title}</h3>
                    <p>{p.description}</p>
                    <small>
                      Votação no próximo mês ·{' '}
                      {p.constitutional ? 'Quórum de 3/5' : 'Maioria absoluta'}
                    </small>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <section className="panel parties-panel">
        <PanelTitle title="Um diálogo com cada bancada">
          <span className="muted-text">
            Cada negociação: {money(costOf(s, 1))} · 8 CP · 1 decisão
          </span>
        </PanelTitle>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Partido</th>
                <th>Cadeiras</th>
                <th>Relação com o governo</th>
                <th>Posição</th>
                <th>
                  <span className="sr-only">Ação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {s.parties.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span
                      className="party-id"
                      style={{ color: p.color, borderColor: `${p.color}55` }}
                    >
                      {p.id}
                    </span>
                    <strong>{p.name}</strong>
                  </td>
                  <td>{p.seats}</td>
                  <td>
                    <div className="relation-cell">
                      <Progress value={p.relation} color={p.color} />
                      <span>{Math.round(p.relation)}%</span>
                    </div>
                  </td>
                  <td>
                    <Badge tone={p.relation >= 60 ? 'green' : p.relation < 40 ? 'red' : ''}>
                      {p.relation >= 60
                        ? 'Base aliada'
                        : p.relation < 40
                          ? 'Oposição'
                          : 'Independente'}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="small subtle"
                      disabled={s.negotiated.includes(p.id) || p.relation >= 95}
                      onClick={() =>
                        act((x) => negotiate(x, p.id), `Diálogo com ${p.name} concluído.`)
                      }
                    >
                      {s.negotiated.includes(p.id)
                        ? 'Negociado'
                        : p.relation >= 95
                          ? 'Apoio máximo'
                          : 'Negociar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function Development({ s, act }) {
  const [filter, setFilter] = useState('all');
  const [region, setRegion] = useState('Nacional');
  return (
    <>
      <PageHeading
        eyebrow="DESENVOLVIMENTO NACIONAL"
        title="O país que sai do papel."
        description="Obras levam tempo. Seus resultados atravessam gerações."
      />
      <div className="sector-grid">
        {SECTORS.map((sector) => (
          <button
            className={`panel sector-card ${filter === sector.id ? 'selected' : ''}`}
            key={sector.id}
            onClick={() => setFilter(filter === sector.id ? 'all' : sector.id)}
          >
            <Icon name={sector.icon} style={{ color: sector.color }} size={23} />
            <span>{sector.name}</span>
            <strong>
              {Math.round(s.metrics[sector.id])}
              <small>/100</small>
            </strong>
            <Progress value={s.metrics[sector.id]} color={sector.color} />
          </button>
        ))}
      </div>
      {s.projects.length > 0 && (
        <section className="panel progress-panel">
          <PanelTitle title="O futuro está em construção">
            <Badge>{s.projects.length} obras</Badge>
          </PanelTitle>
          <div className="project-progress-grid">
            {s.projects.map((p) => {
              const data = PROJECTS.find((x) => x.id === p.type);
              return (
                <div key={p.id}>
                  <div className="project-progress-title">
                    <Icon name={data.icon} size={20} />
                    <div>
                      <h3>{data.title}</h3>
                      <small>
                        {p.region} · faltam {p.remaining} meses
                      </small>
                    </div>
                    <span>{Math.round((1 - p.remaining / p.total) * 100)}%</span>
                  </div>
                  <Progress value={(1 - p.remaining / p.total) * 100} />
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="section-intro inline">
        <div>
          <h2>Investimentos estratégicos</h2>
          <p>Escolha o próximo projeto e a região beneficiada.</p>
        </div>
        <label className="select-label">
          Região{' '}
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {['Nacional', 'Norte', 'Nordeste', 'Centro', 'Sudeste', 'Sul'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="project-grid">
        {PROJECTS.filter((p) => filter === 'all' || p.sector === filter).map((p) => {
          const sector = SECTORS.find((x) => x.id === p.sector);
          const busy = s.projects.some((x) => x.type === p.id);
          const locked = p.requires && !s.research[p.requires];
          return (
            <article className="panel project-card" key={p.id}>
              <div className={`project-illustration ${p.sector}`}>
                <Icon name={p.icon} size={64} strokeWidth={1} />
                <div className="blueprint-lines" />
                <Badge>{sector.name}</Badge>
              </div>
              <div className="project-details">
                <h3>{p.title}</h3>
                <p>{sector.description}</p>
                <div className="project-meta">
                  <span>
                    <Icon name="Wallet" size={14} />
                    {money(costOf(s, p.cost))}
                  </span>
                  <span>
                    <Icon name="Clock3" size={14} />
                    {p.months} meses
                  </span>
                </div>
                <Button
                  variant="subtle"
                  icon={locked ? 'LockKeyhole' : busy ? 'Clock3' : 'Plus'}
                  disabled={busy || locked}
                  onClick={() =>
                    act(
                      (x) => buildProject(x, p.id, region),
                      'Projeto autorizado. Acompanhe a execução nos próximos meses.',
                    )
                  }
                >
                  {busy
                    ? 'Em construção'
                    : locked
                      ? 'Requer satélites nacionais'
                      : 'Autorizar projeto · 8 CP'}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

export function Diplomacy({ s, act, selected, setSelected, setModal }) {
  const partners = COUNTRIES.filter((c) => c.id !== s.country);
  const target = partners.find((c) => c.id === selected) || partners[0];
  const r = s.relations[target.id];
  const action = (id, message) => act((x) => diplomacy(x, target.id, id), message);
  return (
    <>
      <PageHeading
        eyebrow="RELAÇÕES EXTERIORES"
        title="O diálogo atravessa fronteiras."
        description="Acordos criam oportunidades. Alianças mudam o equilíbrio do mundo."
      />
      <div className="stats-grid">
        <MiniStat
          label="Acordos comerciais"
          value={Object.values(s.relations).filter((x) => x.treaty).length}
          icon="Handshake"
          detail="Parcerias em vigor"
        />
        <MiniStat
          label="Alianças"
          value={Object.values(s.relations).filter((x) => x.alliance).length}
          icon="Globe2"
          detail="Cooperação estratégica"
        />
        <MiniStat
          label="Conflitos ativos"
          value={Object.values(s.relations).filter((x) => x.war).length}
          icon="ShieldAlert"
          detail="Negocie para preservar a paz"
        />
        <MiniStat
          label="Parceiros disponíveis"
          value={partners.length}
          icon="Flag"
          detail="Nações com relações simuladas"
        />
      </div>
      <div className="diplomacy-layout">
        <section className="panel diplomatic-map">
          <PanelTitle title="A comunidade internacional">
            <Badge>Relações bilaterais</Badge>
          </PanelTitle>
          <Globe
            large
            country={s.country}
            selected={target.id}
            relations={s.relations}
            mode="relations"
            onSelect={(id) => id !== s.country && setSelected(id)}
          />
        </section>
        <section className="panel country-detail">
          <label className="country-select-label" htmlFor="diplomatic-country">
            SELECIONE UM PAÍS
          </label>
          <select
            id="diplomatic-country"
            value={target.id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {partners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <div className="diplomat-profile">
            <span>{target.flag}</span>
            <h2>{target.name}</h2>
            <p>
              {target.capital} · {target.region}
            </p>
          </div>
          <div className="relation-heading">
            <span>Relação bilateral</span>
            <strong>
              {Math.round(r.score)}
              <small>/100</small>
            </strong>
          </div>
          <Progress value={r.score} />
          <div className="relation-tags">
            <Badge tone={r.war ? 'red' : r.score >= 60 ? 'green' : 'amber'}>
              {r.war
                ? 'Em conflito'
                : r.score >= 75
                  ? 'Relação estratégica'
                  : r.score >= 60
                    ? 'Relação amistosa'
                    : r.score >= 40
                      ? 'Relação neutra'
                      : 'Relação tensa'}
            </Badge>
            {r.treaty && <Badge>Comércio livre</Badge>}
            {r.alliance && <Badge>Aliado</Badge>}
            {r.sanctioned && <Badge tone="red">Sanções</Badge>}
          </div>
          <div className="diplomatic-actions">
            <Button
              icon="Handshake"
              disabled={r.war}
              onClick={() =>
                action('visit', 'Missão diplomática concluída. Relação bilateral ampliada.')
              }
            >
              Missão diplomática <small>+12 relação</small>
            </Button>
            <Button
              icon="Ship"
              disabled={r.treaty || r.score < 60 || r.sanctioned || r.war}
              onClick={() => action('trade', 'Acordo comercial assinado.')}
            >
              {r.treaty ? 'Acordo em vigor' : 'Acordo comercial'}
              <small>Requer 60 relação</small>
            </Button>
            <Button
              icon="Globe2"
              disabled={r.alliance || r.score < 75 || r.war || r.sanctioned}
              onClick={() => action('alliance', 'Aliança estratégica estabelecida.')}
            >
              {r.alliance ? 'Aliança em vigor' : 'Formar aliança'}
              <small>Requer 75 relação</small>
            </Button>
            <Button
              icon="Ban"
              disabled={r.sanctioned || r.war}
              onClick={() =>
                action('sanction', 'Sanções aplicadas. Relações e crescimento foram afetados.')
              }
            >
              Aplicar sanções <small>−30 relação · −0,2 crescimento</small>
            </Button>
            {r.war ? (
              <Button
                icon="Flag"
                variant="primary"
                onClick={() =>
                  action('peace', 'Paz negociada. O caminho da reconstrução começa agora.')
                }
              >
                Negociar a paz
              </Button>
            ) : (
              <Button
                variant="subtle danger-text"
                icon="Swords"
                disabled={r.score > 35 || r.alliance}
                onClick={() => setModal({ type: 'war', target: target.id })}
              >
                Declarar guerra <small>Relação ≤ 35 · sem aliança</small>
              </Button>
            )}
          </div>
          <p className="fine-print">
            Missões, alianças, sanções e paz custam {money(costOf(s, 1))}; comércio custa{' '}
            {money(costOf(s, 3))}. Cada ação usa 8 CP e uma decisão. A guerra tem custos próprios,
            exibidos antes da confirmação.
          </p>
        </section>
      </div>
      <section className="panel">
        <PanelTitle title="Panorama dos parceiros">
          <Badge>Economias simuladas a cada mês</Badge>
        </PanelTitle>
        <div className="world-economy-grid">
          {partners.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelected(c.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span>{c.flag}</span>
              <strong>{c.name}</strong>
              <small>{number(s.world[c.id].growth, 1)}% PIB</small>
              <span className={s.relations[c.id].score >= 60 ? 'positive' : ''}>
                {Math.round(s.relations[c.id].score)} <Icon name="ArrowUpRight" size={13} />
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

export function Defense({ s, act, go, setSelected }) {
  const [target, setTarget] = useState(COUNTRIES.find((c) => c.id !== s.country).id);
  const wars = Object.entries(s.relations).filter(([, r]) => r.war);
  return (
    <>
      <PageHeading
        eyebrow="SEGURANÇA E SOBERANIA"
        title="Preparar. Proteger. Preservar."
        description="A capacidade de defesa é uma ferramenta de estabilidade e dissuasão."
      />
      <div className="three-grid">
        <MiniStat
          label="Capacidade de defesa"
          value={`${Math.round(s.metrics.defense)}/100`}
          icon="Shield"
          detail="Indicador nacional integrado"
        />
        <MiniStat
          label="Segurança interna"
          value={`${Math.round(s.metrics.security)}/100`}
          icon="ShieldCheck"
          detail="Prevenção e capacidade policial"
        />
        <MiniStat
          label="Custo dos conflitos"
          value={money(financials(s).war)}
          icon="Wallet"
          detail="Despesa adicional por mês"
        />
      </div>
      <div className="section-intro">
        <h2>Modernização das forças</h2>
        <p>
          Cada investimento custa {money(costOf(s, 6))}, 10 CP e uma decisão. Benefícios: +6 defesa,
          +2 segurança e +1 ciência.
        </p>
      </div>
      <div className="minister-grid">
        {[
          ['Exército', 'Shield'],
          ['Marinha', 'Ship'],
          ['Aeronáutica', 'Plane'],
          ['Inteligência', 'Radar'],
        ].map(([name, icon]) => (
          <article className="panel defense-card" key={name}>
            <div className="defense-emblem">
              <Icon name={icon} size={42} strokeWidth={1} />
            </div>
            <h3>{name}</h3>
            <p>Equipamentos, formação e integração de sistemas.</p>
            <Button
              variant="subtle"
              onClick={() =>
                act((x) => modernizeDefense(x, name), `${name}: modernização concluída.`)
              }
            >
              Modernizar <Icon name="ArrowUpRight" size={15} />
            </Button>
          </article>
        ))}
      </div>
      <div className="two-grid">
        <section className="panel">
          <PanelTitle title="Inteligência estratégica">
            <Icon name="Radar" size={20} />
          </PanelTitle>
          <div className="panel-body">
            <p className="muted-text">
              Analise as tensões com outros países e fortaleça a capacidade de observação. A análise
              produz um relatório e +2 de defesa.
            </p>
            <label className="form-label" htmlFor="intel-country">
              País analisado
            </label>
            <select
              id="intel-country"
              className="wide-select"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {COUNTRIES.filter((c) => c.id !== s.country).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              icon="ScanEye"
              onClick={() =>
                act(
                  (x) => diplomacy(x, target, 'intelligence'),
                  'Análise concluída. O relatório está na central de notícias.',
                )
              }
            >
              Produzir análise · {money(costOf(s, 1))} · 8 CP
            </Button>
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Sala de situação">
            <Badge tone={wars.length ? 'red' : 'green'}>
              {wars.length ? 'Conflito ativo' : 'Em paz'}
            </Badge>
          </PanelTitle>
          {!wars.length ? (
            <Empty
              icon="Bird"
              title="A paz também é uma conquista."
              text="Não há conflitos ativos. Invista em diplomacia para preservar a estabilidade."
            />
          ) : (
            <div className="panel-body">
              {wars.map(([id]) => (
                <div className="conflict-row" key={id}>
                  <strong>
                    {COUNTRIES.find((c) => c.id === id).flag}{' '}
                    {COUNTRIES.find((c) => c.id === id).name}
                  </strong>
                  <p>{money(costOf(s, 3))}/mês · desgaste de defesa e estabilidade.</p>
                  <Button
                    variant="subtle"
                    onClick={() => {
                      setSelected(id);
                      go('diplomacy');
                    }}
                  >
                    Abrir negociação de paz
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function Research({ s, act }) {
  const [query, setQuery] = useState('');
  const count = Object.values(s.research).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeading
        eyebrow="CIÊNCIA E TECNOLOGIA"
        title="O amanhã se pesquisa hoje."
        description="19 áreas de conhecimento. 57 tecnologias. Novas possibilidades para sua nação."
      />
      <div className="research-banner">
        <Icon name="Orbit" size={62} strokeWidth={1} />
        <div>
          <span className="eyebrow">A PRÓXIMA FRONTEIRA</span>
          <h2>Do primeiro satélite à presença na Lua.</h2>
          <p>Desenvolva a ciência nacional e avance no programa espacial.</p>
        </div>
        <div className="research-completion">
          <strong>
            {count}
            <span>/57</span>
          </strong>
          <small>tecnologias dominadas</small>
        </div>
      </div>
      <div className="section-intro inline">
        <div>
          <h2>Uma rede de descobertas</h2>
          <p>
            Capacidade científica: {Math.round(s.metrics.science)}/100 · {s.studies.length}/2
            pesquisas simultâneas
          </p>
        </div>
        <label className="search-field">
          <Icon name="Search" size={17} />
          <input
            placeholder="Buscar área ou tecnologia"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar pesquisas"
          />
        </label>
      </div>
      <div className="research-grid">
        {RESEARCH.filter((r) =>
          `${r.name} ${r.levels.join(' ')}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes(
              query
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''),
            ),
        ).map((r) => {
          const level = s.research[r.id];
          const study = s.studies.find((x) => x.type === r.id);
          const locked = s.metrics.science < 25 + level * 15;
          return (
            <article className={`panel research-card ${study ? 'in-progress' : ''}`} key={r.id}>
              <div className="research-top">
                <span className="tile-icon">
                  <Icon name={r.icon} size={23} />
                </span>
                <div className="tech-levels">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={level > i ? 'done' : study?.level === i ? 'current' : ''}
                    />
                  ))}
                </div>
              </div>
              <small>{r.name.toUpperCase()}</small>
              <h3>{r.levels[Math.min(level, 2)]}</h3>
              <p>
                {level === 3
                  ? 'Todos os avanços desta área foram incorporados.'
                  : `Nível ${level + 1} · requer ${25 + level * 15} de ciência · ${3 + level * 2} meses`}
              </p>
              {study ? (
                <div className="study-progress">
                  <span>
                    <i className="live-dot" /> Pesquisa em curso{' '}
                    <strong>{study.remaining} meses restantes</strong>
                  </span>
                  <Progress value={(1 - study.remaining / study.total) * 100} />
                </div>
              ) : (
                <Button
                  variant="subtle"
                  disabled={level === 3 || locked || s.studies.length >= 2}
                  onClick={() =>
                    act(
                      (x) => startResearch(x, r.id),
                      'Pesquisa financiada. Acompanhe os resultados a cada mês.',
                    )
                  }
                  icon={level === 3 ? 'Check' : locked ? 'LockKeyhole' : 'FlaskConical'}
                >
                  {level === 3
                    ? 'Área concluída'
                    : locked
                      ? 'Ciência insuficiente'
                      : `Pesquisar · ${money(costOf(s, 4 + level * 4))}`}
                </Button>
              )}
              {level < 3 && !study && <small className="research-cost">8 CP · 1 decisão</small>}
            </article>
          );
        })}
      </div>
      {RESEARCH.every(
        (r) =>
          !`${r.name} ${r.levels.join(' ')}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes(
              query
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''),
            ),
      ) && (
        <Empty
          icon="Search"
          title="Nenhuma pesquisa encontrada"
          text="Tente outro tema, como energia, espaço ou saúde."
        />
      )}
    </>
  );
}

function newsType(type) {
  return (
    {
      government: 'GOVERNO',
      politics: 'POLÍTICA',
      world: 'INTERNACIONAL',
      economy: 'ECONOMIA',
      event: 'SOCIEDADE',
      development: 'DESENVOLVIMENTO',
      science: 'CIÊNCIA',
      defense: 'DEFESA',
      election: 'ELEIÇÕES',
    }[type] || 'GOVERNO'
  );
}
export function News({ s }) {
  const [filter, setFilter] = useState('all');
  const items = s.news.filter(
    (n) => filter === 'all' || (filter === 'national' ? n.type !== 'world' : n.type === filter),
  );
  return (
    <>
      <PageHeading
        eyebrow="CENTRAL DE NOTÍCIAS"
        title="O mundo acompanha cada movimento."
        description="Decisões, reações e acontecimentos que escrevem a história do seu governo."
      />
      <div className="news-masthead">
        <span>BOLETIM DA REPÚBLICA</span>
        <Icon name="Globe2" size={27} />
        <span>EDIÇÃO DE {dateOf(s.month, true).toUpperCase()}</span>
      </div>
      <div className="tabs news-tabs">
        {[
          ['all', 'Todas as notícias'],
          ['national', 'Nacional'],
          ['world', 'Internacional'],
          ['politics', 'Política'],
          ['economy', 'Economia'],
          ['science', 'Ciência'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={filter === id ? 'selected' : ''}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {!items.length ? (
        <Empty
          icon="Newspaper"
          title="Nenhuma manchete nesta editoria."
          text="Os acontecimentos da simulação aparecerão aqui ao longo do mandato."
        />
      ) : (
        <div className="news-feed">
          {items.map((n, i) => (
            <article className={`panel news-article ${i === 0 ? 'headline' : ''}`} key={n.id}>
              <div className="article-meta">
                <Badge>{newsType(n.type)}</Badge>
                <span>{dateOf(n.month, true)}</span>
              </div>
              <h2>{n.title}</h2>
              <p>{n.description}</p>
              <div className="article-footer">
                <span className="live-dot" /> Agência Soberania · Notícia da simulação
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function Legacy({ s, setModal }) {
  const achievements = [
    {
      title: 'Primeiro passo',
      text: 'Implemente uma medida de governo.',
      done: s.enacted.length > 0,
      icon: 'Footprints',
    },
    {
      title: 'Do papel à realidade',
      text: 'Conclua uma obra pública.',
      done: s.completed.length > 0,
      icon: 'Building2',
    },
    {
      title: 'Pontes, não muros',
      text: 'Assine um acordo comercial.',
      done: Object.values(s.relations).some((r) => r.treaty),
      icon: 'Handshake',
    },
    {
      title: 'Fronteira do conhecimento',
      text: 'Conclua uma pesquisa.',
      done: Object.values(s.research).some((n) => n > 0),
      icon: 'FlaskConical',
    },
    {
      title: 'Voz das ruas',
      text: 'Alcance 75% de aprovação.',
      done: s.history.some((h) => h.approval >= 75) || s.metrics.approval >= 75,
      icon: 'Users',
    },
    {
      title: 'Confiança renovada',
      text: 'Conquiste um segundo mandato.',
      done: s.term > 1,
      icon: 'Award',
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="A MARCA QUE FICA"
        title="Como a história vai lembrar você?"
        description="Seu legado é feito de decisões, entregas e da confiança que você constrói."
      >
        <Button variant="subtle" icon="Settings2" onClick={() => setModal({ type: 'save' })}>
          Gerenciar partida
        </Button>
      </PageHeading>
      <div className="legacy-hero">
        <div>
          <span className="eyebrow">LEGADO DE {s.name.toUpperCase()}</span>
          <h2>
            O poder passa.
            <br />
            <em>As escolhas ficam.</em>
          </h2>
          <p>
            {countryOf(s).flag} {countryOf(s).name} · {s.month} meses de governo
          </p>
        </div>
        <div className="legacy-score">
          <Icon name="Award" size={37} />
          <strong>{number(legacy(s))}</strong>
          <span>PONTOS DE LEGADO</span>
        </div>
      </div>
      <div className="stats-grid">
        <MiniStat
          label="Medidas implementadas"
          value={s.enacted.length}
          icon="ScrollText"
          detail="Decretos e leis aprovadas"
        />
        <MiniStat
          label="Projetos entregues"
          value={s.completed.length}
          icon="Building2"
          detail="Obras concluídas"
        />
        <MiniStat
          label="Tecnologias dominadas"
          value={Object.values(s.research).reduce((a, b) => a + b, 0)}
          icon="FlaskConical"
          detail="Descobertas incorporadas"
        />
        <MiniStat
          label="Mandatos"
          value={s.term}
          icon="Vote"
          detail={`Próxima eleição em ${48 - (s.month % 48)} meses`}
        />
      </div>
      <section className="panel chart-panel">
        <PanelTitle title="A confiança ao longo do mandato">
          <Badge tone="green">{Math.round(s.metrics.approval)}% hoje</Badge>
        </PanelTitle>
        <div className="chart-large">
          <div className="chart-labels">
            <span>{Math.round(Math.max(...s.history.map((h) => h.approval)))}%</span>
            <span>APROVAÇÃO</span>
            <span>{Math.round(Math.min(...s.history.map((h) => h.approval)))}%</span>
          </div>
          <Sparkline values={s.history.map((h) => h.approval)} height={150} filled />
        </div>
        <div className="chart-dates">
          <span>{dateOf(s.history[0].month)}</span>
          <span>{dateOf(s.month)}</span>
        </div>
      </section>
      <div className="section-intro">
        <h2>Marcos de uma trajetória</h2>
        <p>Conquistas locais, registradas nesta partida.</p>
      </div>
      <div className="three-grid">
        {achievements.map((a) => (
          <article key={a.title} className={`panel achievement ${a.done ? 'unlocked' : ''}`}>
            <span className="achievement-icon">
              <Icon name={a.icon} size={26} />
            </span>
            <div>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
              <small>{a.done ? 'CONQUISTADO' : 'A CONQUISTAR'}</small>
            </div>
            <Icon name={a.done ? 'Check' : 'LockKeyhole'} size={15} />
          </article>
        ))}
      </div>
      <p className="fine-print">
        A pontuação combina bem-estar, estabilidade, redução da desigualdade, obras, pesquisa e
        tempo de governo. Rankings online e partidas multijogador não fazem parte desta versão.
      </p>
    </>
  );
}
