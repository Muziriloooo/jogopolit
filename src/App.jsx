import React, { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTRIES, EVENTS, POLICIES, METRIC_NAMES } from './data.js';
import {
  SAVE_KEY,
  createGame,
  validateSave,
  advanceMonth,
  resolveEvent,
  enactPolicy,
  interpretProposal,
  countryOf,
  dateOf,
  costOf,
  diplomacy,
} from './engine.js';
import { Icon, Button, Badge, Modal, money, number } from './components.jsx';
import {
  Dashboard,
  Government,
  Economy,
  Congress,
  Development,
  Diplomacy,
  Defense,
  Research,
  News,
  Legacy,
} from './views.jsx';

const NAV = [
  { id: 'overview', name: 'Visão geral', icon: 'LayoutDashboard', section: 'CENTRO DE COMANDO' },
  { id: 'government', name: 'Gabinete', icon: 'Landmark' },
  { id: 'economy', name: 'Economia', icon: 'ChartNoAxesCombined' },
  { id: 'congress', name: 'Congresso', icon: 'Vote' },
  { id: 'development', name: 'Desenvolvimento', icon: 'Building2' },
  { id: 'diplomacy', name: 'Diplomacia', icon: 'Globe2', section: 'ALÉM DAS FRONTEIRAS' },
  { id: 'defense', name: 'Defesa e inteligência', icon: 'Shield' },
  { id: 'research', name: 'Ciência e futuro', icon: 'Orbit' },
  { id: 'news', name: 'Central de notícias', icon: 'Newspaper', section: 'SEU GOVERNO' },
  { id: 'legacy', name: 'Meu legado', icon: 'Fingerprint' },
];

function readInitial() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return { game: raw ? validateSave(JSON.parse(raw)) : createGame(), error: '' };
  } catch {
    return {
      game: createGame(),
      error:
        'Não foi possível restaurar o salvamento. Exporte o arquivo anterior, se disponível, ou inicie uma nova partida.',
    };
  }
}

export default function App() {
  const [initial] = useState(readInitial);
  const [s, setGame] = useState(initial.game);
  const [page, setPage] = useState('overview');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [saveError, setSaveError] = useState(initial.error);
  const [selected, setSelected] = useState(initial.game.country);
  const [noticeRead, setNoticeRead] = useState(initial.game.nextId);
  const importRef = useRef();
  const mainRef = useRef();
  const current = useRef(s);
  current.current = s;
  const closeModal = useCallback(() => setModal(null), []);
  const notify = useCallback(
    (message, error = false) => setToast({ message, error, key: Date.now() }),
    [],
  );
  useEffect(() => {
    if (initial.error && saveError) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      setSaveError('');
    } catch {
      setSaveError(
        'O navegador não conseguiu salvar. Exporte a partida para preservar seu progresso.',
      );
    }
  }, [s, initial.error]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  function go(id) {
    setPage(id);
    setMobileNav(false);
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function act(fn, success = 'Decisão registrada. O país já sente os efeitos.') {
    try {
      const next = fn(current.current);
      current.current = next;
      setGame(next);
      notify(success);
      return true;
    } catch (e) {
      notify(e.message, true);
      return false;
    }
  }
  function nextMonth() {
    if (s.event !== null) {
      setModal({ type: 'event' });
      return;
    }
    act(advanceMonth, `Bem-vindo a ${dateOf(s.month + 1, true)}. O mundo continua em movimento.`);
  }
  function exportGame() {
    const blob = new Blob([JSON.stringify(current.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `soberania-${s.country}-mes-${s.month}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Partida exportada. Guarde o arquivo para continuar depois.');
  }
  async function importGame(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error('O arquivo excede o limite de 2 MB.');
      const game = validateSave(JSON.parse(await file.text()));
      setModal({ type: 'import', game });
    } catch (err) {
      notify(
        err instanceof SyntaxError
          ? 'O arquivo não contém um salvamento JSON válido.'
          : err.message,
        true,
      );
    }
  }
  function replaceGame(game) {
    current.current = game;
    setGame(game);
    setSelected(game.country);
    setNoticeRead(game.nextId);
    setSaveError('');
    setModal(null);
    go('overview');
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    } catch {
      notify(
        'Partida aberta, mas o salvamento local está indisponível. Exporte seu progresso.',
        true,
      );
    }
  }
  const ctx = { s, act, go, setModal, notify, selected, setSelected };
  const country = countryOf(s);
  const active = NAV.find((n) => n.id === page);
  const Views = {
    overview: Dashboard,
    government: Government,
    economy: Economy,
    congress: Congress,
    development: Development,
    diplomacy: Diplomacy,
    defense: Defense,
    research: Research,
    news: News,
    legacy: Legacy,
  };
  const View = Views[page];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
        <button className="brand" onClick={() => go('overview')} aria-label="Soberania, início">
          <span className="brand-symbol">
            <Icon name="Globe2" size={31} />
          </span>
          <span>
            SOBERANIA<small>O PODER TEM CONSEQUÊNCIAS.</small>
          </span>
        </button>
        <button className="country-switch" onClick={() => setModal({ type: 'new' })}>
          <span className="flag">{country.flag}</span>
          <span>
            <strong>{country.name}</strong>
            <small>Governo nacional</small>
          </span>
          <Icon name="ChevronsUpDown" size={15} />
        </button>
        <nav aria-label="Navegação principal">
          {NAV.map((n) => (
            <React.Fragment key={n.id}>
              {n.section && <div className="nav-section">{n.section}</div>}
              <button
                aria-current={page === n.id ? 'page' : undefined}
                className={`nav-item ${page === n.id ? 'active' : ''}`}
                onClick={() => go(n.id)}
              >
                <Icon name={n.icon} size={18} />
                <span>{n.name}</span>
                {n.id === 'news' && s.nextId > noticeRead && <span className="nav-dot" />}
                {page === n.id && <span className="active-mark" />}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="guide-link" onClick={() => setModal({ type: 'guide' })}>
            <Icon name="CircleHelp" size={17} /> Guia de governo{' '}
            <Icon name="ArrowUpRight" size={15} />
          </button>
          <div className="profile">
            <span className="profile-avatar">
              <Icon name="UserRound" size={20} />
            </span>
            <span>
              <strong>{s.name}</strong>
              <small>
                {country.leader} · {s.term}º mandato
              </small>
            </span>
            <button
              className="icon-button"
              aria-label="Gerenciar partida"
              onClick={() => setModal({ type: 'save' })}
            >
              <Icon name="Settings2" size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMobileNav(true)}
            >
              <Icon name="Menu" />
            </button>
            <Icon name={active.icon} size={17} />
            <span>Centro de comando</span>
            <span className="separator">/</span>
            <strong>{active.name}</strong>
          </div>
          <div className="topbar-actions">
            <span className="save-status" title={saveError || 'Progresso salvo neste navegador'}>
              <span className={saveError ? 'status-dot error' : 'status-dot'} />
              {saveError ? 'Salvar manualmente' : 'Progresso salvo'}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Ver notificações"
              onClick={() => {
                setNoticeRead(s.nextId);
                go('news');
              }}
            >
              <Icon name="Bell" size={19} />
              {s.nextId > noticeRead && <i />}
            </button>
            <span className="top-divider" />
            <button className="date-button" onClick={() => setModal({ type: 'guide' })}>
              <Icon name="CalendarDays" size={17} />
              <span>01 {dateOf(s.month).replace(' de ', ' ').replace('.', '').toUpperCase()}</span>
            </button>
          </div>
        </header>
        <main id="main-content" ref={mainRef}>
          {saveError && (
            <div className="warning-banner" role="alert">
              <Icon name="TriangleAlert" size={18} />
              <span>{saveError}</span>
              <button onClick={exportGame}>Exportar partida</button>
            </div>
          )}
          {s.status !== 'active' && (
            <div className="end-banner">
              <Icon name="Flag" />
              <div>
                <strong>
                  {s.status === 'defeated'
                    ? 'Seu mandato chegou ao fim nas urnas.'
                    : 'Uma crise institucional encerrou seu mandato.'}
                </strong>
                <p>Explore o relatório do seu legado ou escreva uma nova história.</p>
              </div>
              <Button onClick={() => setModal({ type: 'new' })}>Nova partida</Button>
            </div>
          )}
          <View {...ctx} />
          <footer className="app-footer">
            <span>
              <Icon name="Globe2" size={13} /> SOBERANIA <i /> Simulação independente
            </span>
            <span>
              Dados e personagens simulados <span className="footer-version">v1.0</span>
            </span>
          </footer>
        </main>
        <div className="turnbar">
          <div className="turn-info">
            <span className="live-dot" />
            <strong>{s.status === 'active' ? 'Governo em exercício' : 'Mandato encerrado'}</strong>
            <span className="turn-month">Mês {(s.month % 48) + 1} de 48</span>
          </div>
          <div className="turn-actions">
            <span className="action-count">
              <span>
                {[0, 1, 2].map((i) => (
                  <i key={i} className={i < s.actions ? 'available' : ''} />
                ))}
              </span>
              {s.actions} decisões disponíveis
            </span>
            <Button variant="primary" onClick={nextMonth} disabled={s.status !== 'active'}>
              Avançar mês <Icon name="ArrowRight" size={17} />
            </Button>
          </div>
        </div>
      </div>
      {toast && (
        <div className={`toast ${toast.error ? 'error' : ''}`} role="status" key={toast.key}>
          <Icon name={toast.error ? 'CircleAlert' : 'CircleCheck'} size={20} />
          <span>{toast.message}</span>
          <button aria-label="Dispensar aviso" onClick={() => setToast(null)}>
            <Icon name="X" size={16} />
          </button>
        </div>
      )}
      <input
        type="file"
        accept="application/json,.json"
        className="sr-only"
        ref={importRef}
        onChange={importGame}
        aria-label="Importar salvamento"
      />
      {modal?.type === 'event' && (
        <Modal title="Uma decisão não pode esperar." eyebrow="SALA DE CRISE" onClose={closeModal}>
          <EventChoices {...ctx} onDone={closeModal} />
        </Modal>
      )}
      {modal?.type === 'decision' && <DecisionModal {...ctx} onClose={closeModal} />}
      {modal?.type === 'policy' && (
        <PolicyModal
          {...ctx}
          policy={POLICIES.find((p) => p.id === modal.id)}
          onClose={closeModal}
        />
      )}
      {modal?.type === 'new' && (
        <NewGameModal s={s} onClose={closeModal} onStart={replaceGame} onExport={exportGame} />
      )}
      {modal?.type === 'guide' && <Guide onClose={closeModal} />}
      {modal?.type === 'save' && (
        <Modal title="Sua história, preservada." eyebrow="GERENCIAR PARTIDA" onClose={closeModal}>
          <p className="modal-intro">
            O progresso é salvo automaticamente neste navegador. Exporte uma cópia para jogar em
            outro dispositivo.
          </p>
          <div className="save-options">
            <Button icon="Download" onClick={exportGame}>
              Exportar partida
            </Button>
            <Button
              icon="Upload"
              onClick={() => {
                closeModal();
                importRef.current.click();
              }}
            >
              Importar partida
            </Button>
            <Button icon="Plus" onClick={() => setModal({ type: 'new' })}>
              Começar novo governo
            </Button>
          </div>
          <p className="fine-print">
            {country.name} · {dateOf(s.month, true)} · {s.name}
          </p>
        </Modal>
      )}
      {modal?.type === 'import' && (
        <Modal title="Continuar esta história?" eyebrow="IMPORTAR PARTIDA" onClose={closeModal}>
          <p className="modal-intro">
            {countryOf(modal.game).flag} {countryOf(modal.game).name} · {modal.game.name} ·{' '}
            {dateOf(modal.game.month, true)}
          </p>
          <p>A partida atual será substituída. Você pode exportá-la antes de continuar.</p>
          <div className="modal-actions">
            <Button onClick={exportGame}>Exportar atual</Button>
            <Button variant="primary" onClick={() => replaceGame(modal.game)}>
              Carregar partida
            </Button>
          </div>
        </Modal>
      )}
      {modal?.type === 'war' && (
        <Modal title="O custo de um conflito." eyebrow="DECISÃO DE ESTADO" onClose={closeModal}>
          <p className="modal-intro">
            Declarar guerra a {COUNTRIES.find((c) => c.id === modal.target).name} custa{' '}
            {money(costOf(s, 10))} e 25 de capital político.
          </p>
          <div className="consequence-box negative">
            −8 aprovação · −12 estabilidade · −0,8 crescimento · +1 inflação
            <br />
            Custo mensal de {money(costOf(s, 3))}, desgaste militar e suspensão do comércio
            bilateral.
          </div>
          <p>
            O conflito é uma simulação estratégica abstrata. Você poderá negociar a paz no painel
            diplomático.
          </p>
          <div className="modal-actions">
            <Button onClick={closeModal}>Voltar à diplomacia</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (
                  act(
                    (x) => diplomacy(x, modal.target, 'war'),
                    'Conflito iniciado. Os custos serão cobrados a cada mês.',
                  )
                )
                  closeModal();
              }}
            >
              Declarar guerra
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function EventChoices({ s, act, onDone }) {
  if (s.event === null) return <p>Nenhuma crise pendente. O gabinete está em dia.</p>;
  const event = EVENTS[s.event];
  return (
    <div className="event-choices">
      <Badge tone="amber">{event.tag}</Badge>
      <h3>{event.title}</h3>
      <p>{event.description}</p>
      {event.choices.map((choice, i) => (
        <button
          key={i}
          className="choice"
          onClick={() => {
            if (act((x) => resolveEvent(x, i), 'Resposta registrada. A crise foi encaminhada.'))
              onDone?.();
          }}
          disabled={s.metrics.treasury < costOf(s, choice.cost)}
        >
          <span>
            <strong>{choice.label}</strong>
            <small>
              {money(costOf(s, choice.cost))} ·{' '}
              {Object.entries(choice.effects)
                .map(
                  ([k, v]) =>
                    `${v > 0 ? '+' : ''}${number(v, Math.abs(v) < 1 ? 1 : 0)} ${METRIC_NAMES[k]}`,
                )
                .join(' · ')}
            </small>
          </span>
          <Icon name="ArrowUpRight" size={17} />
        </button>
      ))}
    </div>
  );
}

function Effects({ effects }) {
  return (
    <div className="effects">
      {Object.entries(effects).map(([key, value]) => (
        <span
          key={key}
          className={
            ['inflation', 'unemployment', 'debt', 'inequality', 'corruption'].includes(key)
              ? value < 0
                ? 'positive'
                : 'negative'
              : value > 0
                ? 'positive'
                : 'negative'
          }
        >
          {value > 0 ? '+' : ''}
          {number(value, value % 1 ? 1 : 0)} {METRIC_NAMES[key]}
        </span>
      ))}
    </div>
  );
}

function PolicyModal({ s, act, policy, onClose, text = '' }) {
  const used = s.enacted.includes(policy.id) || s.laws.some((l) => l.policy === policy.id);
  return (
    <Modal
      title={policy.title}
      eyebrow={policy.law ? 'PROPOSTA LEGISLATIVA' : 'DECISÃO PRESIDENCIAL'}
      onClose={onClose}
    >
      <p className="modal-intro">{policy.description}</p>
      <div className="policy-costs">
        <span>
          <small>INVESTIMENTO</small>
          <strong>{money(costOf(s, policy.cost))}</strong>
        </span>
        <span>
          <small>CAPITAL POLÍTICO</small>
          <strong>{policy.capital} pontos</strong>
        </span>
        <span>
          <small>DECISÕES</small>
          <strong>1 de {s.actions}</strong>
        </span>
      </div>
      <h4>Efeitos previstos {policy.law ? 'após aprovação' : 'imediatos'}</h4>
      <Effects effects={policy.effects} />
      {policy.law && (
        <p className="fine-print">
          {policy.constitutional
            ? 'Exige 3/5 em duas rodadas de votação nas duas casas.'
            : 'Exige maioria absoluta nas casas legislativas.'}{' '}
          Os votos têm uma margem de incerteza. A proposta entra na pauta do próximo mês.
        </p>
      )}
      <div className="modal-actions">
        <Button onClick={onClose}>Voltar</Button>
        <Button
          variant="primary"
          disabled={used || s.status !== 'active'}
          onClick={() => {
            if (
              act(
                (x) => enactPolicy(x, policy.id, text),
                policy.law ? 'Proposta enviada ao Parlamento.' : 'Medida implementada.',
              )
            )
              onClose();
          }}
        >
          {used
            ? 'Medida já registrada'
            : policy.law
              ? 'Enviar ao Congresso'
              : 'Implementar medida'}
          <Icon name="ArrowRight" size={17} />
        </Button>
      </div>
    </Modal>
  );
}

function DecisionModal({ s, act, onClose, setModal }) {
  const [tab, setTab] = useState('agenda');
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState(undefined);
  if (analysis)
    return <PolicyModal s={s} act={act} policy={analysis} text={text} onClose={onClose} />;
  return (
    <Modal
      title="Qual será o próximo passo?"
      eyebrow="SUA AGENDA DE GOVERNO"
      onClose={onClose}
      wide
    >
      <div className="tabs">
        <button className={tab === 'agenda' ? 'selected' : ''} onClick={() => setTab('agenda')}>
          Medidas de governo
        </button>
        <button className={tab === 'custom' ? 'selected' : ''} onClick={() => setTab('custom')}>
          Escrever uma proposta <Icon name="PenLine" size={14} />
        </button>
      </div>
      {tab === 'agenda' ? (
        <div className="policy-grid">
          {POLICIES.map((p) => (
            <button
              className="policy-option"
              key={p.id}
              onClick={() => setModal({ type: 'policy', id: p.id })}
            >
              <span className="tile-icon">
                <Icon name={p.icon} />
              </span>
              <Badge>{p.category}</Badge>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <span className="policy-footer">
                {s.enacted.includes(p.id)
                  ? 'Implementada ✓'
                  : s.laws.some((l) => l.policy === p.id)
                    ? 'Em tramitação'
                    : `${money(costOf(s, p.cost))} · ${p.capital} capital político`}
                <Icon name="ArrowUpRight" size={16} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="proposal-compose">
          <label htmlFor="proposal">Escreva a medida que você quer propor</label>
          <textarea
            id="proposal"
            maxLength={1000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setAnalysis(undefined);
            }}
            placeholder="Ex.: ampliar o atendimento de saúde com mais recursos para hospitais e equipes médicas."
            rows={6}
          />
          <div className="compose-count">{text.length}/1000</div>
          <p className="fine-print">
            <Icon name="Info" size={16} /> A análise local reconhece temas e sugere uma das medidas
            do jogo. Ela não usa IA generativa nem interpreta detalhes como valores, negações ou
            prazos. Confira a proposta e os efeitos antes de confirmar.
          </p>
          {analysis === null && (
            <p className="inline-error" role="alert">
              Não identificamos uma medida. Descreva um tema como saúde, educação, impostos,
              segurança ou energia, ou escolha uma medida da agenda.
            </p>
          )}
          <Button
            variant="primary"
            icon="ScanText"
            disabled={text.trim().length < 15}
            onClick={() => setAnalysis(interpretProposal(text))}
          >
            Analisar proposta
          </Button>
        </div>
      )}
    </Modal>
  );
}

function NewGameModal({ s, onClose, onStart, onExport }) {
  const [country, setCountry] = useState(s.country);
  const [name, setName] = useState('');
  return (
    <Modal
      title="Todo legado tem um começo."
      eyebrow="NOVO GOVERNO · JANEIRO DE 2026"
      onClose={onClose}
      wide
    >
      <p className="modal-intro">
        Escolha uma nação. Enfrente seus desafios. Encontre seu caminho.
      </p>
      <label className="form-label" htmlFor="leader">
        Como devemos chamar você?
      </label>
      <input
        id="leader"
        className="text-input"
        maxLength={50}
        placeholder="Seu nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="country-grid">
        {COUNTRIES.map((c) => (
          <button
            className={`country-option ${country === c.id ? 'selected' : ''}`}
            key={c.id}
            onClick={() => setCountry(c.id)}
          >
            <span>{c.flag}</span>
            <strong>{c.name}</strong>
            <small>{c.capital}</small>
            {country === c.id && <Icon name="CircleCheck" size={16} />}
          </button>
        ))}
      </div>
      <p className="fine-print">
        16 países jogáveis. Indicadores, instituições e personagens são simplificados para a
        simulação. Uma nova partida substitui o progresso atual neste navegador.
      </p>
      <div className="modal-actions">
        <Button onClick={onExport} icon="Download">
          Salvar partida atual
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            onStart(createGame({ country, name: name || 'Seu governo', seed: Date.now() }))
          }
        >
          Tomar posse <Icon name="ArrowRight" size={17} />
        </Button>
      </div>
    </Modal>
  );
}

function Guide({ onClose }) {
  const steps = [
    [
      'MousePointer2',
      'Você decide. O mundo responde.',
      'Cada mês oferece três decisões. Investimentos custam dinheiro; articulação e reformas consomem capital político. Crises urgentes não consomem uma decisão.',
    ],
    [
      'CalendarDays',
      'Um mês de cada vez',
      'Resolva a crise pendente e avance o calendário. A economia evolui, obras e pesquisas progridem, leis são votadas e parceiros internacionais mudam.',
    ],
    [
      'Vote',
      'Governar é construir apoio',
      'Negocie com partidos para formar maiorias. Leis exigem maioria absoluta; a reforma institucional exige 3/5 em duas rodadas. A votação tem uma margem de incerteza.',
    ],
    [
      'Wallet',
      'Toda escolha tem um custo',
      'O orçamento é dividido entre seis setores e precisa somar 100%. Aumentar impostos eleva a arrecadação, mas reduz a aprovação. Juros afetam inflação, crescimento e dívida.',
    ],
    [
      'Flag',
      'Construa um legado duradouro',
      'A cada 48 meses, uma eleição avalia o governo: aprovação de pelo menos 45 e estabilidade de pelo menos 30 renovam o mandato. Aprovação abaixo de 15 e estabilidade abaixo de 25 encerram o governo por crise.',
    ],
    [
      'HardDriveDownload',
      'Sua história fica com você',
      'O salvamento é automático e local. Use a engrenagem junto ao seu perfil para exportar, importar ou iniciar uma nova partida.',
    ],
  ];
  return (
    <Modal title="Seu primeiro dia no poder." eyebrow="GUIA DE GOVERNO" onClose={onClose} wide>
      <div className="guide-intro">
        <Icon name="Globe2" size={40} />
        <p>
          Soberania é um jogo de escolhas e consequências. Não existe uma resposta perfeita — existe
          o país que você decide construir.
        </p>
      </div>
      <div className="guide-grid">
        {steps.map(([icon, title, text], i) => (
          <article key={title}>
            <span className="guide-number">0{i + 1}</span>
            <Icon name={icon} size={22} />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <div className="guide-note">
        Esta versão é individual e funciona offline após ser carregada. O mapa contém o mundo
        inteiro; 16 países têm perfis jogáveis. As instituições são simplificadas, os partidos são
        fictícios e a economia é um modelo de jogo. Defesa usa conflitos abstratos, sem combate
        tático ou conquista territorial. O programa espacial é representado por pesquisas e
        infraestrutura.
      </div>
      <div className="modal-actions">
        <Button variant="primary" onClick={onClose}>
          Vamos governar <Icon name="ArrowRight" size={17} />
        </Button>
      </div>
    </Modal>
  );
}
