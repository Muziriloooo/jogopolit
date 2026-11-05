import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Package,
  Users,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Clock,
  CheckCircle2,
  MapPin,
  ChevronRight,
  Wifi,
  WifiOff,
  RefreshCw,
  Camera,
  ImagePlus,
  Trash2,
  FileDown,
  LogOut,
  Menu,
  X,
  Check,
  AlertCircle,
  ShieldCheck,
  Download,
  PenLine,
  Truck,
  Activity,
} from 'lucide-react';
import type { Order, User, RecordOrder, Visit, Part } from './types';
import { api, load, save, session, clearDevice, compress, removeOrder } from './store';
import { report, money, date } from './pdf';
import { watchUpdates } from './updates';
import { watchLocalUpdates } from './local-updates';
import { createId } from './ids';
import { migrateAccounts, recoveredDrafts, prepareOrderForSync } from './store';
import { exchangeOrders } from './sync-engine';
import './styles.css';
const uid = createId;
const day = () => new Date().toLocaleDateString('en-CA');
const statuses = ['Todas', 'Pendente', 'Em andamento', 'Aguardando peças', 'Concluída'];
function Badge({ status }: { status: string }) {
  return (
    <span
      className={
        'badge ' +
        (status === 'Concluída' || status === 'Instalada'
          ? 'green'
          : status === 'Aguardando peças' || status === 'Solicitada'
            ? 'amber'
            : status === 'Em andamento'
              ? 'blue'
              : 'gray')
      }
    >
      <i />
      {status}
    </span>
  );
}
function Brand() {
  return (
    <>
      <img className="brand-symbol" src="/souza-lima-symbol.svg" alt="" />
      <span className="brand-wordmark">
        SOUZA LIMA<small>SL CAMPO · MANUTENÇÃO</small>
      </span>
    </>
  );
}
function App() {
  const [user, setUser] = useState<User>();
  const [boot, setBoot] = useState(true);
  const [orders, setOrders] = useState<RecordOrder[]>([]);
  const ordersRef = useRef(orders);
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>();
  const [notice, setNotice] = useState('');
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const updateSafe = useRef<() => boolean>(() => false);
  const [page, setPage] = useState('overview');
  const [selected, setSelected] = useState<string>();
  const [tab, setTab] = useState('Resumo');
  const [filter, setFilter] = useState('Todas');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [demo, setDemo] = useState(false);
  const [loginNeeded, setLoginNeeded] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [range, setRange] = useState({
    from: '',
    to: '',
    tech: '',
    client: '',
    unit: '',
    equipment: '',
  });
  const syncLock = useRef(false);
  const syncAgain = useRef(false);
  const deletedIds = useRef(new Set<string>());
  const [deleting, setDeletingState] = useState(false);
  const deleteLock = useRef(false);
  const setDeleting = (value: boolean) => {
    deleteLock.current = value;
    setDeletingState(value);
  };
  const [recoveredCount, setRecoveredCount] = useState(0);
  const syncNotice = useRef<string | undefined>(undefined);
  const localWrites = useRef(Promise.resolve());
  const replace = (rows: RecordOrder[]) => {
    ordersRef.current = rows;
    setOrders(rows);
  };
  useEffect(() => {
    (async () => {
      const cached = await session();
      if (cached) {
        replace(await load(cached));
        setUser(cached);
      }
      try {
        const me = await api('/me');
        await migrateAccounts(me.user);
        await session(me.user);
        replace(await load(me.user));
        setRecoveredCount((await recoveredDrafts(me.user)).length);
        setUser(me.user);
        setDemo(me.demo);
      } catch {}
      setBoot(false);
    })();
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    window.addEventListener('online', yes);
    window.addEventListener('offline', no);
    return () => {
      window.removeEventListener('online', yes);
      window.removeEventListener('offline', no);
    };
  }, []);
  async function sync() {
    if (boot || !user || !navigator.onLine || syncLock.current || deleteLock.current) return;
    syncLock.current = true;
    setBusy(true);
    try {
      const issues = await exchangeOrders({
        records: () => ordersRef.current,
        deleted: async () => {
          const ids: string[] = await api('/order-deletions');
          deletedIds.current = new Set(ids);
          return ids;
        },
        remove: async (id) => {
          replace(ordersRef.current.filter((r) => r.data.id !== id));
          setSelected((current) => (current === id ? undefined : current));
          localWrites.current = localWrites.current.then(() => removeOrder(user, id));
          await localWrites.current;
        },
        id: uid,
        flush: () => localWrites.current,
        put: async (record) => {
          replace(ordersRef.current.map((r) => (r.data.id === record.data.id ? record : r)));
          localWrites.current = localWrites.current.then(() => save(user, record));
          await localWrites.current;
        },
        send: async (command) =>
          api('/sync', {
            method: 'POST',
            body: JSON.stringify({ ...command, data: await prepareOrderForSync(command.data) }),
          }),
        pull: () => api('/orders'),
        commit: async (merged) => {
          replace(merged);
          for (const r of merged)
            localWrites.current = localWrites.current.then(() => save(user, r));
          await localWrites.current;
        },
      });
      setLastSynced(new Date().toLocaleTimeString('pt-BR'));
      const unresolved = ordersRef.current
        .filter((r) => r.pending && r.error)
        .map((r) => `OS ${r.data.id}: ${r.error}`);
      const warning = [...new Set([...issues, ...unresolved])].join(' · ');
      if (warning) {
        syncNotice.current = warning;
        setNotice(warning);
      } else if (syncNotice.current) {
        const previous = syncNotice.current;
        syncNotice.current = undefined;
        setNotice((current) => (current === previous ? '' : current));
      }
      setUsers(await api('/users'));
    } catch (e: any) {
      if (e.status === 401) setLoginNeeded(true);
      const message = e.message || 'Sem conexão. Dados mantidos no dispositivo.';
      syncNotice.current = message;
      setNotice(message);
    } finally {
      setBusy(false);
      syncLock.current = false;
      if (syncAgain.current) {
        syncAgain.current = false;
        setTimeout(() => void sync(), 0);
      }
    }
  }
  useEffect(() => {
    if (user && online) {
      sync();
      const timer = setInterval(sync, live ? 30000 : 3000);
      return () => clearInterval(timer);
    }
  }, [user?.id, online, live, boot]);
  useEffect(() => {
    if (!user || !online || loginNeeded) {
      setLive(false);
      return;
    }
    const stream = new EventSource('/api/events');
    stream.onopen = () => {
      setLive(true);
      void sync();
    };
    stream.onmessage = () => {
      if (syncLock.current) syncAgain.current = true;
      else void sync();
    };
    stream.onerror = () => setLive(false);
    return () => {
      stream.close();
      setLive(false);
    };
  }, [user?.id, online, loginNeeded]);
  // Resume promptly when a phone returns from the lock screen or another app.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void sync();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.id, online]);
  // Send completed local edits promptly; the regular poll still fetches remote edits.
  useEffect(() => {
    if (!user || !online || !orders.some((r) => r.pending && !r.error)) return;
    const timer = setTimeout(() => void sync(), 600);
    return () => clearTimeout(timer);
  }, [orders, user?.id, online]);
  useEffect(() => {
    const watch = import.meta.env.DEV ? watchLocalUpdates : watchUpdates;
    if (import.meta.env.PROD && !('serviceWorker' in navigator)) return;
    return watch({
      safeToReload: () => updateSafe.current(),
      flush: () => localWrites.current,
      onWaiting: setUpdateWaiting,
    });
  }, []);
  function update(data: Order) {
    if (!user) return;
    const old = ordersRef.current.find((r) => r.data.id === data.id);
    const next: RecordOrder = {
      data,
      revision: old?.revision || 0,
      inFlight: old?.inFlight,
      baseData: old?.pending ? old.baseData : old?.data,
      pending: true,
      commandId: uid(),
    };
    replace(
      old
        ? ordersRef.current.map((r) => (r.data.id === data.id ? next : r))
        : [next, ...ordersRef.current],
    );
    localWrites.current = localWrites.current
      .then(() => save(user, next))
      .catch(() => {
        setNotice(
          'Falha ao salvar no dispositivo. Libere espaço e exporte seu rascunho antes de sair.',
        );
      });
  }
  function go(p: string) {
    setPage(p);
    setSelected(undefined);
    setMenu(false);
  }
  function open(id: string) {
    setSelected(id);
    setTab('Resumo');
    setMenu(false);
  }
  function flash(text: string) {
    setNotice(text);
  }
  const current = orders.find((r) => r.data.id === selected);
  const pending = orders.filter((x) => x.pending).length;
  const activeVisit = current?.data.visits.find((v) => !v.checkOut);
  updateSafe.current = () =>
    !boot &&
    !syncLock.current &&
    !ordersRef.current.some((r) => r.pending) &&
    !activeVisit &&
    !modal &&
    !userModal &&
    !(selected && ['Peças', 'Atendimento'].includes(tab)) &&
    !document.activeElement?.matches('input, textarea, select, canvas, [contenteditable="true"]');
  const list = orders.filter(
    ({ data: o }) =>
      (filter === 'Todas' || o.status === filter) &&
      (!range.from || o.scheduled >= range.from) &&
      (!range.to || o.scheduled <= range.to) &&
      (!range.tech || o.technicianId === range.tech) &&
      (!range.client || o.client === range.client) &&
      (!range.unit || o.unit === range.unit) &&
      (!range.equipment || o.equipment === range.equipment) &&
      `${o.id} ${o.unit} ${o.equipment} ${o.client}`.toLowerCase().includes(search.toLowerCase()),
  );
  const all = orders.map((r) => r.data);
  const cost = (o: Order) =>
    o.parts.reduce((a, p) => a + p.quantity * (p.unitCents || 0), 0) +
    (o.laborCents || 0) +
    (o.travelCents || 0) +
    (o.extraCents || 0);
  const manager = user?.role === 'admin';
  const responsibleUsers =
    user?.role === 'admin' ? [{ id: user.id, name: user.name, role: 'admin' }, ...users] : users;
  async function deleteAttendance(id: string) {
    if (!user || user.role !== 'admin' || !online || busy || deleting) return;
    if (!confirm(`Excluir o atendimento #${id}, incluindo visitas, fotos, assinatura e peças?`))
      return;
    setDeleting(true);
    try {
      await localWrites.current;
      await api('/orders/' + encodeURIComponent(id), { method: 'DELETE' });
      deletedIds.current.add(id);
      replace(ordersRef.current.filter((r) => r.data.id !== id));
      localWrites.current = localWrites.current.then(() => removeOrder(user, id));
      await localWrites.current;
      setSelected((current) => (current === id ? undefined : current));
      flash(`Atendimento #${id} excluído.`);
    } catch (error: any) {
      flash(error.message);
    } finally {
      setDeleting(false);
    }
  }
  async function logout() {
    if (pending) {
      flash('Sincronize ou exporte os rascunhos antes de sair.');
      return;
    }
    try {
      await api('/logout', { method: 'POST' });
    } catch {
      flash('Conecte-se para encerrar a sessão com segurança.');
      return;
    }
    await clearDevice();
    replace([]);
    setUser(undefined);
    setSelected(undefined);
    setLoginNeeded(false);
  }
  if (boot)
    return (
      <div className="splash">
        <div className="brand-mark">SL</div>
        <h2>Preparando seu espaço de trabalho…</h2>
      </div>
    );
  if (!user || loginNeeded)
    return (
      <Login
        onLogin={async (u, d) => {
          if (user && u.id !== user.id && pending && !u.mergedUserIds?.includes(user.id)) {
            flash('Entre com a mesma conta para preservar seus rascunhos.');
            return;
          }
          await migrateAccounts(u);
          await session(u);
          replace(await load(u));
          setRecoveredCount((await recoveredDrafts(u)).length);
          setDemo(d);
          setLoginNeeded(false);
          setUser(u);
        }}
        notice={notice}
      />
    );
  return (
    <div className="app">
      <aside className={menu ? 'sidebar visible' : 'sidebar'}>
        <a className="brand" href="#" onClick={() => go('overview')}>
          <Brand />
        </a>
        <div className="workspace-tag">
          <span className="tiny-dot" /> Operação de manutenção <ChevronRight size={15} />
        </div>
        <p className="nav-caption">ESPAÇO DE TRABALHO</p>
        <nav>
          {[
            ['overview', 'Visão geral', LayoutDashboard],
            ['orders', 'Ordens de serviço', ClipboardList],
            ['equipment', 'Equipamentos', Wrench],
            ['parts', 'Peças e materiais', Package],
            ...(manager ? [['team', 'Equipe técnica', Users]] : []),
          ].map(([id, label, Icon]: any) => (
            <button
              key={id}
              className={page === id ? 'nav-item active' : 'nav-item'}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              {label}
              {id === 'orders' && <span className="nav-count">{orders.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card">
            <ShieldCheck size={20} />
            <b>Seu trabalho, protegido.</b>
            <p>Registros salvos no dispositivo, mesmo quando o sinal não ajuda.</p>
            <span>
              <span className="tiny-dot" /> Salvamento automático
            </span>
          </div>
          <button className="nav-item" onClick={() => go('settings')}>
            <Settings size={19} />
            Configurações
          </button>
          <button className="user-block" onClick={logout}>
            <span className="avatar">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span>
              <b>{user.name}</b>
              <small>{manager ? 'Administrador' : 'Técnico de manutenção'}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMenu(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </button>
            <span className="mobile-brand">
              <img src="/souza-lima-symbol.svg" alt="" />
              SL CAMPO
            </span>
            <span>Operação</span>
            <ChevronRight size={14} />
            <strong>
              {selected
                ? 'OS ' + selected
                : (
                    {
                      overview: 'Visão geral',
                      orders: 'Ordens de serviço',
                      equipment: 'Equipamentos',
                      parts: 'Peças e materiais',
                      team: 'Equipe técnica',
                      settings: 'Configurações',
                    } as any
                  )[page]}
            </strong>
          </div>
          <div className="top-actions">
            <span className={'connection ' + (!online ? 'offline' : '')}>
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{online ? 'Conectado' : 'Offline'}</span>
            </span>
            <button
              className="sync-button"
              onClick={sync}
              disabled={busy || !online}
              aria-label="Sincronizar"
              title={lastSynced ? `Última sincronização: ${lastSynced}` : 'Sincronizar'}
            >
              <RefreshCw size={15} className={busy ? 'spin' : ''} />
              <span>
                {busy
                  ? 'Sincronizando'
                  : pending
                    ? `${pending} pendente${pending > 1 ? 's' : ''}`
                    : 'Sincronizado'}
              </span>
            </button>
            <span className="avatar small">{user.name[0]}</span>
          </div>
        </header>
        <main>
          {updateWaiting && (
            <div className="notice" role="status">
              <RefreshCw size={18} />
              <span>
                Nova versão pronta. A atualização será aplicada automaticamente quando você terminar
                o preenchimento e os dados estiverem sincronizados.
              </span>
            </div>
          )}
          <div className="sync-status" role="status">
            <span className={live ? 'live-dot connected' : 'live-dot'} />
            <span>
              {!online
                ? 'Offline · registros salvos neste aparelho'
                : live
                  ? 'Atualizações em tempo real'
                  : 'Consultando alterações automaticamente'}
              {lastSynced ? ` · ${lastSynced}` : ''}
            </span>
            {pending > 0 && (
              <strong>
                {pending} OS pendente{pending > 1 ? 's' : ''} de envio
              </strong>
            )}
          </div>
          {notice && (
            <div className="notice" role="status">
              <AlertCircle size={18} />
              <span>{notice}</span>
              <button className="icon-btn" onClick={() => setNotice('')} aria-label="Fechar aviso">
                <X size={17} />
              </button>
            </div>
          )}
          {demo && (
            <div className="demo-strip">
              AMBIENTE DEMONSTRATIVO{' '}
              <span>Dados fictícios · documentos de referência anonimizados</span>
            </div>
          )}
          {current ? (
            <>
              <button className="back-link" onClick={() => setSelected(undefined)}>
                <ArrowLeft size={16} />
                Voltar para as ordens
              </button>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">ATENDIMENTO EM CAMPO</div>
                  <h1>
                    Ordem de serviço <span className="muted">#{current.data.id}</span>
                  </h1>
                  <p>
                    {current.data.client} · {current.data.unit}
                  </p>
                </div>
                <div className="heading-actions">
                  <Badge status={current.data.status} />
                  {user.role === 'admin' && (
                    <button
                      className="btn danger"
                      disabled={busy || deleting || !online}
                      onClick={() => deleteAttendance(current.data.id)}
                    >
                      <Trash2 size={17} />
                      Excluir atendimento
                    </button>
                  )}
                </div>
              </div>
              {current.error && (
                <div className="conflict">
                  <h3>Sincronização precisa de atenção</h3>
                  <p>{current.error}</p>
                  <button
                    className="btn"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(current)], {
                        type: 'application/json',
                      });
                      download(blob, `rascunho-${selected}.json`);
                    }}
                  >
                    Exportar rascunho
                  </button>
                  <button
                    className="btn"
                    onClick={async () => {
                      if (
                        !confirm(
                          'Seu rascunho local será substituído. Exporte-o primeiro. Continuar?',
                        )
                      )
                        return;
                      try {
                        const remote: RecordOrder[] = await api('/orders');
                        const fresh = remote.find((x) => x.data.id === selected);
                        if (fresh) {
                          await save(user, fresh);
                          replace(
                            ordersRef.current.map((x) => (x.data.id === selected ? fresh : x)),
                          );
                        }
                      } catch (e: any) {
                        flash(e.message);
                      }
                    }}
                  >
                    Carregar versão do servidor
                  </button>
                  <button className="btn" onClick={() => update(current.data)}>
                    Tentar novamente
                  </button>
                </div>
              )}
              <div className="tabs detail-tabs">
                {['Resumo', 'Atendimento', 'Fotografias', 'Peças', 'Documentos'].map((t) => (
                  <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>
                    {t}
                    {t === 'Fotografias' && (
                      <small>{current.data.visits.reduce((n, v) => n + v.photos.length, 0)}</small>
                    )}
                  </button>
                ))}
              </div>
              {tab === 'Resumo' && (
                <div className="detail-grid">
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Dados do atendimento</h2>
                      <Wrench size={20} />
                    </div>
                    <dl className="facts">
                      {[
                        ['Cliente', current.data.client],
                        ['Unidade', current.data.unit],
                        ['Endereço', current.data.address],
                        ['Equipamento', current.data.equipment],
                        ['Marca / modelo', current.data.brand + ' / ' + current.data.model],
                        ['Número de série', current.data.serial],
                        ['Patrimônio', current.data.asset],
                        ['Horímetro', current.data.hours.toLocaleString('pt-BR') + ' h'],
                        ['Tipo', current.data.type],
                        ['Prioridade', current.data.priority],
                        ['Agendamento', current.data.scheduled.split('-').reverse().join('/')],
                        [
                          'Responsável',
                          responsibleUsers.find((u) => u.id === current.data.technicianId)?.name ||
                            current.data.technicianId,
                        ],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v || 'Não informado'}</dd>
                        </div>
                      ))}
                    </dl>
                    {manager && (
                      <label>
                        Alterar responsável
                        <select
                          value={current.data.technicianId}
                          onChange={(e) =>
                            update({ ...current.data, technicianId: e.target.value })
                          }
                        >
                          {responsibleUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </section>
                  <div>
                    <section className="panel next-action">
                      <span className="feature-icon">
                        <Wrench />
                      </span>
                      <h2>
                        {activeVisit
                          ? 'Atendimento em andamento'
                          : current.data.status === 'Concluída'
                            ? 'Ordem concluída'
                            : 'Pronto para ir a campo?'}
                      </h2>
                      <p>
                        {activeVisit
                          ? 'Continue de onde parou. Os registros são salvos automaticamente.'
                          : 'Cada visita tem seu próprio laudo, horários, fotos e assinatura.'}
                      </p>
                      {current.data.status !== 'Concluída' && (
                        <button
                          className="btn primary full"
                          onClick={() => {
                            if (!activeVisit) {
                              const v: Visit = {
                                id: uid(),
                                technicianId: user.id,
                                technicianName: user.name,
                                checkIn: new Date().toISOString(),
                                hours: current.data.hours,
                                defect: '',
                                diagnosis: '',
                                services: '',
                                operational: true,
                                misuse: false,
                                misuseNotes: '',
                                returnNeeded: false,
                                notes: '',
                                mechanical: '',
                                photos: [],
                                signature: null,
                                signatureReason: '',
                                signer: '',
                                signerRole: '',
                                signatureMode: 'Assinada',
                              };
                              update({
                                ...current.data,
                                status: 'Em andamento',
                                visits: [...current.data.visits, v],
                              });
                            }
                            setTab('Atendimento');
                          }}
                        >
                          <Plus size={17} />
                          {activeVisit ? 'Continuar atendimento' : 'INICIAR ATENDIMENTO'}
                        </button>
                      )}
                    </section>
                    <section className="panel">
                      <h2>Histórico de visitas</h2>
                      {current.data.visits.length === 0 ? (
                        <p className="empty-inline">A primeira visita começa com o check-in.</p>
                      ) : (
                        current.data.visits.map((v, i) => (
                          <div className="timeline-item" key={v.id}>
                            <span className="timeline-dot" />
                            <div>
                              <b>
                                Visita {i + 1} · {v.checkOut ? 'Finalizada' : 'Em andamento'}
                              </b>
                              <p>{date(v.checkIn)}</p>
                              <span className="muted">
                                {v.checkOut
                                  ? Math.round(
                                      (+new Date(v.checkOut) - +new Date(v.checkIn)) / 60000,
                                    ) +
                                    ' min · ' +
                                    (v.returnNeeded ? 'Retorno necessário' : 'Sem retorno previsto')
                                  : 'Check-in registrado'}
                              </span>
                              <button
                                className="text-link"
                                onClick={() => report(current.data, user, 'Relatório técnico', v)}
                              >
                                Baixar relatório <FileDown size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </section>
                    {manager && (
                      <section className="panel">
                        <h2>Encerramento da ordem</h2>
                        <p className="muted">
                          Encerre após todas as visitas e instalações. Finalizar uma visita não
                          encerra a OS.
                        </p>
                        <button
                          className="btn full"
                          disabled={
                            current.data.status === 'Concluída' ||
                            current.data.visits.length === 0 ||
                            current.data.visits.some((v) => !v.checkOut) ||
                            !!current.data.visits.at(-1)?.returnNeeded ||
                            current.data.parts.some((p) => p.status !== 'Instalada')
                          }
                          onClick={() => update({ ...current.data, status: 'Concluída' })}
                        >
                          <CheckCircle2 size={17} />
                          Encerrar OS
                        </button>
                      </section>
                    )}
                  </div>
                </div>
              )}
              {tab === 'Atendimento' &&
                (activeVisit ? (
                  <VisitForm
                    order={current.data}
                    visit={activeVisit}
                    change={update}
                    flash={flash}
                    finished={() => setTab('Resumo')}
                  />
                ) : (
                  <div className="panel empty">
                    <CheckCircle2 size={38} />
                    <h2>Nenhuma visita em andamento</h2>
                    <p>Inicie um atendimento na aba Resumo para preencher o laudo.</p>
                    <button className="btn primary" onClick={() => setTab('Resumo')}>
                      Ir para o resumo
                    </button>
                  </div>
                ))}
              {tab === 'Fotografias' && (
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Registro fotográfico</h2>
                      <p>Antes, depois e evidências vinculadas a cada visita.</p>
                    </div>
                    <Camera size={24} />
                  </div>
                  {current.data.visits.every((v) => !v.photos.length) && (
                    <div className="empty">
                      <Camera size={36} />
                      <h3>Nenhuma fotografia registrada</h3>
                      <p>Adicione fotos no atendimento em andamento.</p>
                    </div>
                  )}
                  <div className="photo-grid">
                    {current.data.visits.flatMap((v, i) =>
                      v.photos.map((p) => (
                        <figure key={p.id}>
                          <img src={p.data} alt={p.caption || p.category} />
                          <figcaption>
                            <Badge status={p.category} />
                            <p>{p.caption || 'Sem legenda'}</p>
                            <small>
                              Visita {i + 1} · {date(v.checkIn)}
                            </small>
                          </figcaption>
                        </figure>
                      )),
                    )}
                  </div>
                  {activeVisit && (
                    <button className="btn primary" onClick={() => setTab('Atendimento')}>
                      <ImagePlus size={18} />
                      Adicionar ao atendimento
                    </button>
                  )}
                </section>
              )}
              {tab === 'Peças' && (
                <Parts
                  order={current.data}
                  manager={manager}
                  change={update}
                  activeVisit={activeVisit}
                />
              )}
              {tab === 'Documentos' && (
                <section className="panel">
                  <h2>Documentos do atendimento</h2>
                  <p className="muted">
                    Fotos, assinaturas e peças são incorporadas automaticamente. Valores seguem as
                    permissões do seu perfil.
                  </p>
                  <div className="document-grid">
                    {(['OS', 'Relatório técnico'] as const).map((kind) => (
                      <div className="document-card" key={kind}>
                        <span className="feature-icon">
                          <FileDown />
                        </span>
                        <h3>{kind === 'OS' ? 'Ordem de serviço' : kind}</h3>
                        <p>
                          {kind === 'OS'
                            ? 'Identificação, visitas, serviços e materiais.'
                            : 'Diagnóstico, testes, evidências e assinatura.'}
                        </p>
                        <button className="btn" onClick={() => report(current.data, user, kind)}>
                          <Download size={16} />
                          Baixar PDF
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="info-note">
                    {current.pending
                      ? 'Rascunho local: há alterações ainda não sincronizadas.'
                      : 'Dados sincronizados.'}{' '}
                    PDFs gerados durante uma visita aberta exibem o atendimento em andamento.
                  </p>
                  {manager && <Audit id={current.data.id} />}
                </section>
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {page === 'overview'
                      ? 'CUIDADO QUE MANTÉM TUDO EM MOVIMENTO'
                      : 'OPERAÇÃO DE MANUTENÇÃO'}
                  </div>
                  <h1>
                    {page === 'overview'
                      ? `Olá, ${user.name.split(' ')[0]}.`
                      : {
                          orders: 'Ordens de serviço',
                          equipment: 'Equipamentos',
                          parts: 'Peças e materiais',
                          team: 'Equipe técnica',
                          settings: 'Configurações',
                        }[page]}
                  </h1>
                  <p>
                    {page === 'overview'
                      ? 'Sua operação em campo, conectada de ponta a ponta.'
                      : page === 'orders'
                        ? 'Acompanhe cada atendimento, da chegada à conclusão.'
                        : page === 'equipment'
                          ? 'Uma visão do estado e do histórico de cada máquina.'
                          : page === 'parts'
                            ? 'Da solicitação à instalação, com rastreabilidade.'
                            : page === 'team'
                              ? 'Pessoas que fazem a operação acontecer.'
                              : 'Seu dispositivo, seus dados e suas preferências.'}
                  </p>
                </div>
                {page !== 'settings' && (
                  <div className="heading-actions">
                    {manager ? (
                      <button className="btn primary" onClick={() => setModal(true)}>
                        <Plus size={18} />
                        Nova ordem de serviço
                      </button>
                    ) : (
                      <button
                        className="btn primary"
                        onClick={() => {
                          const r = orders.find((r) => r.data.status !== 'Concluída');
                          if (r) open(r.data.id);
                          else flash('Nenhuma OS pendente atribuída.');
                        }}
                      >
                        <Plus size={18} />
                        Iniciar atendimento
                      </button>
                    )}
                  </div>
                )}
              </div>
              {page === 'overview' && (
                <>
                  <div className="overview-banner">
                    <div>
                      <span className="banner-kicker">
                        <span className="tiny-dot" /> VISÃO DA OPERAÇÃO
                      </span>
                      <h2>
                        Cuidando
                        <br />
                        <span>do que importa.</span>
                      </h2>
                      <p>
                        Tecnologia e cuidado em cada atendimento.
                        <br className="desktop-only" /> A manutenção da sua operação começa aqui.
                      </p>
                      <button onClick={() => go('orders')}>
                        Acompanhar atendimentos <ArrowUpRight size={18} />
                      </button>
                    </div>
                    <div className="banner-art" aria-hidden="true">
                      <div className="orbit one" />
                      <div className="orbit two" />
                      <div className="art-center">
                        <Wrench size={57} strokeWidth={1.4} />
                      </div>
                      <span className="art-badge badge-a">
                        <CheckCircle2 size={19} />
                        Tudo sob controle
                      </span>
                      <span className="art-badge badge-b">
                        <Activity size={20} />
                        Operação em movimento
                      </span>
                      <span className="art-plus">+</span>
                    </div>
                  </div>
                  <div className="stats-grid">
                    {[
                      [
                        ClipboardList,
                        'Ordens de serviço',
                        all.length,
                        'Toda a operação',
                        'neutral',
                      ],
                      [
                        Clock,
                        'Em andamento',
                        all.filter((o) => o.status === 'Em andamento').length,
                        'Atendimentos ativos',
                        'blue',
                      ],
                      [
                        Package,
                        'Aguardando peças',
                        all.filter((o) => o.status === 'Aguardando peças').length,
                        'Atenção aos próximos passos',
                        'amber',
                      ],
                      [
                        CheckCircle2,
                        'Concluídas',
                        all.filter((o) => o.status === 'Concluída').length,
                        'Ciclo de manutenção finalizado',
                        'green',
                      ],
                    ].map(([Icon, label, note, sub, color]: any) => (
                      <div className="stat-card" key={label}>
                        <div className="stat-top">
                          <span>{label}</span>
                          <span className={'stat-icon ' + color}>
                            <Icon size={19} />
                          </span>
                        </div>
                        <strong>{note.toString().padStart(2, '0')}</strong>
                        <small>{sub}</small>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {(page === 'overview' || page === 'orders') && (
                <section className="panel orders-panel">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {page === 'overview' ? 'Acompanhe os atendimentos' : 'Todas as ordens'}{' '}
                        <span className="count-chip">{list.length}</span>
                      </h2>
                      <p>
                        {page === 'overview'
                          ? 'O que precisa da sua atenção, em tempo real.'
                          : 'Encontre e consulte suas ordens de serviço.'}
                      </p>
                    </div>
                    {page === 'overview' && (
                      <button className="text-link" onClick={() => go('orders')}>
                        Ver todas <ArrowUpRight size={16} />
                      </button>
                    )}
                  </div>
                  <div className="toolbar">
                    <div className="tabs status-tabs">
                      {statuses.map((s) => (
                        <button
                          className={filter === s ? 'active' : ''}
                          key={s}
                          onClick={() => setFilter(s)}
                        >
                          {s === 'Pendente' ? 'Pendentes' : s === 'Concluída' ? 'Concluídas' : s}
                          {s === 'Todas' && <small>{orders.length}</small>}
                        </button>
                      ))}
                    </div>
                    <div className="search">
                      <Search size={17} />
                      <input
                        aria-label="Buscar ordem"
                        placeholder="Buscar OS, cliente ou equipamento"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  {page === 'orders' && (
                    <div className="filters">
                      <label>
                        De
                        <input
                          aria-label="Período inicial"
                          type="date"
                          value={range.from}
                          onChange={(e) => setRange({ ...range, from: e.target.value })}
                        />
                      </label>
                      <label>
                        Até
                        <input
                          type="date"
                          value={range.to}
                          onChange={(e) => setRange({ ...range, to: e.target.value })}
                        />
                      </label>
                      {manager && (
                        <label>
                          Técnico
                          <select
                            value={range.tech}
                            onChange={(e) => setRange({ ...range, tech: e.target.value })}
                          >
                            <option value="">Todos</option>
                            {users.map((u) => (
                              <option value={u.id} key={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {(['client', 'unit', 'equipment'] as const).map((k, i) => (
                        <label key={k}>
                          {['Cliente', 'Unidade', 'Equipamento'][i]}
                          <select
                            value={range[k]}
                            onChange={(e) => setRange({ ...range, [k]: e.target.value })}
                          >
                            <option value="">Todos</option>
                            {[...new Set(all.map((o) => o[k]))].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="orders-table">
                    <div className="table-head">
                      <span>ORDEM / CLIENTE</span>
                      <span>EQUIPAMENTO</span>
                      <span>MANUTENÇÃO</span>
                      <span>SITUAÇÃO</span>
                      <span>RESPONSÁVEL</span>
                      <span />
                    </div>
                    {list.map(({ data: o, pending }) => (
                      <button key={o.id} className="order-row" onClick={() => open(o.id)}>
                        <div className="order-client">
                          <span className="building-icon">
                            <ClipboardList size={21} />
                          </span>
                          <div>
                            <b>
                              #{o.id} <span className="pending-dot">{pending ? '•' : ''}</span>
                            </b>
                            <strong>{o.unit}</strong>
                            <small>{o.client}</small>
                          </div>
                        </div>
                        <div className="equipment-cell">
                          <strong>{o.equipment}</strong>
                          <small>
                            {o.asset} · {o.hours.toLocaleString('pt-BR')} h
                          </small>
                        </div>
                        <div className="maintenance-cell">
                          <span className="type-pill">
                            <Wrench size={12} />
                            {o.type}
                          </span>
                          <small>
                            <span
                              className={
                                'priority-dot ' +
                                (o.priority === 'Alta' || o.priority === 'Urgente' ? 'red' : '')
                              }
                            />
                            Prioridade {o.priority.toLowerCase()}
                          </small>
                        </div>
                        <div className="status-cell">
                          <Badge status={o.status} />
                        </div>
                        <div className="assignee">
                          <span className="avatar tiny">
                            {
                              (responsibleUsers.find((u) => u.id === o.technicianId)?.name ||
                                'T')[0]
                            }
                          </span>
                          <span>
                            {responsibleUsers.find((u) => u.id === o.technicianId)?.name ||
                              o.technicianId}
                          </span>
                        </div>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                    {!list.length && (
                      <div className="empty">
                        <ClipboardList size={36} />
                        <h3>Nenhuma ordem por aqui</h3>
                        <p>Altere os filtros ou cadastre uma nova ordem de serviço.</p>
                      </div>
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      {list.length} atendimento{list.length !== 1 ? 's' : ''} encontrado
                      {list.length !== 1 ? 's' : ''}
                    </span>
                    <span>
                      <ShieldCheck size={14} /> Registros protegidos e rastreáveis
                    </span>
                  </div>
                </section>
              )}
              {page === 'overview' && (
                <div className="bottom-grid">
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Próximos passos</h2>
                      <span className="mini-label">NA SUA OPERAÇÃO</span>
                    </div>
                    {all.some((o) => o.parts.some((p) => p.status === 'Solicitada')) ? (
                      <button className="action-row" onClick={() => go('parts')}>
                        <span className="square-icon amber">
                          <Package size={20} />
                        </span>
                        <span>
                          <b>Peças aguardando análise</b>
                          <small>Revise as solicitações para manter a operação em dia.</small>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ) : (
                      <p className="empty-inline">Nenhuma solicitação aguardando análise.</p>
                    )}
                    <button className="action-row" onClick={() => go('orders')}>
                      <span className="square-icon green">
                        <ClipboardList size={20} />
                      </span>
                      <span>
                        <b>Histórico sempre à mão</b>
                        <small>Consulte laudos e relatórios de cada atendimento.</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  </section>
                  <section className="field-tip">
                    <span className="feature-icon">
                      <WifiOff size={24} />
                    </span>
                    <div>
                      <span className="mini-label">FEITO PARA O CAMPO</span>
                      <h3>
                        O sinal pode parar.
                        <br />
                        Seu trabalho, não.
                      </h3>
                      <p>
                        Após o primeiro acesso e sincronização, registre laudos, fotos e assinaturas
                        offline.
                      </p>
                      <span>
                        Sincronização ao reconectar <ArrowUpRight size={14} />
                      </span>
                    </div>
                  </section>
                </div>
              )}
              {page === 'equipment' && (
                <div className="equipment-grid">
                  {all.map((o) => (
                    <section className="panel" key={o.id}>
                      <div className="section-heading">
                        <span className="feature-icon">
                          <Wrench />
                        </span>
                        <Badge
                          status={
                            o.visits.at(-1)?.operational
                              ? 'Funcionando'
                              : o.visits.length
                                ? 'Parada'
                                : 'Não verificada'
                          }
                        />
                      </div>
                      <h2>{o.equipment}</h2>
                      <p>{o.unit}</p>
                      <dl className="facts">
                        <div>
                          <dt>Patrimônio</dt>
                          <dd>{o.asset || 'Não informado'}</dd>
                        </div>
                        <div>
                          <dt>Horímetro</dt>
                          <dd>{o.hours.toLocaleString('pt-BR')} h</dd>
                        </div>
                        <div>
                          <dt>Visitas</dt>
                          <dd>{o.visits.length}</dd>
                        </div>
                      </dl>
                      <button className="btn full" onClick={() => open(o.id)}>
                        Consultar histórico <ArrowUpRight size={16} />
                      </button>
                    </section>
                  ))}
                </div>
              )}
              {page === 'parts' && (
                <section className="panel">
                  <h2>Solicitações da operação</h2>
                  <p className="muted">Solicitada → Aprovada → Entregue → Instalada</p>
                  {all.flatMap((o) =>
                    o.parts.map((p) => (
                      <button
                        className="part-list-row"
                        key={o.id + p.id}
                        onClick={() => {
                          open(o.id);
                          setTab('Peças');
                        }}
                      >
                        <span className="square-icon">
                          <Package size={20} />
                        </span>
                        <span>
                          <b>{p.description}</b>
                          <small>
                            {p.code} · {p.quantity} un. · {o.unit} · OS #{o.id}
                          </small>
                        </span>
                        <Badge status={p.status} />
                        <ChevronRight size={16} />
                      </button>
                    )),
                  )}
                  {!all.some((o) => o.parts.length) && (
                    <p className="empty-inline">Nenhuma peça solicitada.</p>
                  )}
                </section>
              )}
              {page === 'team' && (
                <>
                  <div className="section-heading">
                    <h2>Equipe e indicadores</h2>
                    {user.role === 'admin' && (
                      <button className="btn" onClick={() => setUserModal(true)}>
                        <Plus size={16} />
                        Adicionar usuário
                      </button>
                    )}
                  </div>
                  <div className="equipment-grid">
                    {users.map((u) => (
                      <section className="panel" key={u.id}>
                        <span className="avatar">{u.name[0]}</span>
                        <h2>{u.name}</h2>
                        <p>Técnico de manutenção</p>
                        <dl className="facts">
                          <div>
                            <dt>Ordens atribuídas</dt>
                            <dd>{all.filter((o) => o.technicianId === u.id).length}</dd>
                          </div>
                          <div>
                            <dt>Concluídas</dt>
                            <dd>
                              {
                                all.filter(
                                  (o) => o.technicianId === u.id && o.status === 'Concluída',
                                ).length
                              }
                            </dd>
                          </div>
                          <div>
                            <dt>Valor registrado</dt>
                            <dd>
                              {money(
                                all
                                  .filter((o) => o.technicianId === u.id)
                                  .reduce((n, o) => n + cost(o), 0),
                              )}
                            </dd>
                          </div>
                        </dl>
                      </section>
                    ))}
                  </div>
                  <Metrics orders={all} cost={cost} />
                </>
              )}
              {page === 'settings' && (
                <section className="panel settings">
                  <h2>Pronto para acompanhar você</h2>
                  <p>
                    Instale o SL Campo pelo menu do Chrome no Android ou por Compartilhar →
                    Adicionar à Tela de Início no Safari do iPhone. HTTPS é necessário fora deste
                    dispositivo.
                  </p>
                  <h3>Armazenamento offline</h3>
                  <p>
                    O acesso inicial exige conexão e login. Somente ordens sincronizadas ficam
                    disponíveis offline. Dados locais pertencem a esta conta e a este navegador; não
                    use dispositivos compartilhados sem encerrar a sessão.
                  </p>
                  <button
                    className="btn"
                    onClick={async () => {
                      if (navigator.storage?.persist) {
                        const ok = await navigator.storage.persist();
                        flash(
                          ok
                            ? 'Armazenamento persistente concedido.'
                            : 'O navegador decide a persistência. Sincronize regularmente.',
                        );
                      }
                    }}
                  >
                    <ShieldCheck size={17} />
                    Solicitar armazenamento persistente
                  </button>
                  <h3>Backup local de segurança</h3>
                  <p>
                    O arquivo contém dados pessoais e fotos. Guarde-o em local privado. Não
                    substitui o backup do banco.
                  </p>
                  <button
                    className="btn"
                    onClick={() =>
                      download(
                        new Blob([JSON.stringify({ version: 1, orders: ordersRef.current })], {
                          type: 'application/json',
                        }),
                        'SL-Campo-backup.json',
                      )
                    }
                  >
                    <Download size={17} />
                    Exportar registros deste dispositivo
                  </button>
                  {recoveredCount > 0 && (
                    <div className="info-note">
                      <p>
                        {recoveredCount} rascunhos da conta administrativa anterior foram
                        preservados separadamente porque havia outra edição da mesma OS.
                      </p>
                      <button
                        className="btn"
                        onClick={async () =>
                          download(
                            new Blob(
                              [JSON.stringify({ version: 1, orders: await recoveredDrafts(user) })],
                              { type: 'application/json' },
                            ),
                            'SL-Campo-rascunhos-recuperados.json',
                          )
                        }
                      >
                        Exportar rascunhos recuperados
                      </button>
                    </div>
                  )}
                  <h3>Restaurar rascunho</h3>
                  <p>
                    Importe um rascunho da mesma conta. A versão será validada pelo servidor na
                    sincronização.
                  </p>
                  <input
                    aria-label="Importar rascunho"
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      try {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const parsed = JSON.parse(await f.text());
                        const records = parsed.orders || [parsed];
                        if (!Array.isArray(records)) throw Error('Arquivo inválido.');
                        for (const r of records) {
                          if (
                            !r.data?.id ||
                            !Array.isArray(r.data.visits) ||
                            !Array.isArray(r.data.parts)
                          )
                            throw Error('Estrutura inválida.');
                          if (user.role === 'tecnico' && r.data.technicianId !== user.id)
                            throw Error('OS de outra conta.');
                        }
                        if (!confirm('Importar e substituir rascunhos com o mesmo número de OS?'))
                          return;
                        for (const r of records) update(r.data);
                        flash('Rascunhos importados. Sincronize para validar.');
                      } catch (e: any) {
                        flash(e.message);
                      }
                    }}
                  />
                  {user.role === 'admin' && (
                    <div className="delete-calls">
                      <h3>Excluir chamados atuais</h3>
                      <p>
                        Remove todas as ordens, visitas, peças, fotos e assinaturas dos chamados
                        registrados no servidor. Usuários e configuração são preservados. Os outros
                        aparelhos receberão a exclusão ao sincronizar.
                      </p>
                      <button
                        className="btn danger"
                        disabled={busy || deleting || !online || orders.length === 0}
                        onClick={async () => {
                          if (
                            !confirm(
                              `Excluir todos os ${orders.length} chamados atuais? Esta ação não pode ser desfeita.`,
                            )
                          )
                            return;
                          setDeleting(true);
                          try {
                            await localWrites.current;
                            const result = await api('/orders', {
                              method: 'DELETE',
                              body: JSON.stringify({
                                ids: ordersRef.current.map((r) => r.data.id),
                              }),
                            });
                            for (const id of result.ids) {
                              deletedIds.current.add(id);
                              localWrites.current = localWrites.current.then(() =>
                                removeOrder(user, id),
                              );
                            }
                            replace(
                              ordersRef.current.filter((r) => !result.ids.includes(r.data.id)),
                            );
                            setSelected(undefined);
                            await localWrites.current;
                            flash(
                              `${result.deleted} chamados excluídos. Usuários e configuração preservados.`,
                            );
                          } catch (error: any) {
                            flash(error.message);
                          } finally {
                            setDeleting(false);
                          }
                        }}
                      >
                        <Trash2 size={17} />
                        Excluir todos os chamados
                      </button>
                    </div>
                  )}
                  {user.role === 'admin' && (
                    <div className="delete-calls">
                      <h3>Excluir técnicos cadastrados</h3>
                      <p>
                        Remove os técnicos, incluindo suas sessões de acesso. O administrador é
                        preservado. Exclua ou redistribua os chamados antes.
                      </p>
                      <button
                        className="btn danger"
                        disabled={
                          busy ||
                          deleting ||
                          !online ||
                          pending > 0 ||
                          orders.length > 0 ||
                          users.length === 0
                        }
                        onClick={async () => {
                          if (!confirm(`Excluir todos os ${users.length} técnicos cadastrados?`))
                            return;
                          setDeleting(true);
                          try {
                            const result = await api('/technicians', { method: 'DELETE' });
                            setUsers([]);
                            flash(
                              `${result.deleted} técnicos excluídos. Nenhum técnico cadastrado.`,
                            );
                          } catch (error: any) {
                            flash(error.message);
                          } finally {
                            setDeleting(false);
                          }
                        }}
                      >
                        <Trash2 size={17} />
                        Excluir todos os técnicos
                      </button>
                    </div>
                  )}
                  <h3>Sessão</h3>
                  <p>
                    {user.email} · Perfil: {user.role}
                  </p>
                  <button className="btn" onClick={logout}>
                    <LogOut size={16} />
                    Sair e limpar dados locais
                  </button>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              SL Campo <i /> Gestão de manutenção
            </span>
            <span>Feito para quem cuida da operação.</span>
          </footer>
        </main>
        <nav className="mobile-nav">
          <button
            className={page === 'overview' && !selected ? 'active' : ''}
            onClick={() => go('overview')}
          >
            <LayoutDashboard size={21} />
            Início
          </button>
          <button
            className={page === 'orders' || selected ? 'active' : ''}
            onClick={() => go('orders')}
          >
            <ClipboardList size={21} />
            Ordens
          </button>
          <button onClick={() => go('parts')}>
            <Package size={21} />
            Peças
          </button>
          <button onClick={() => go('settings')}>
            <Settings size={21} />
            Ajustes
          </button>
        </nav>
      </div>
      {modal && (
        <NewOrder
          users={responsibleUsers}
          close={() => setModal(false)}
          create={(o) => {
            if (deletedIds.current.has(o.id)) {
              flash('Este número de OS foi excluído. Utilize um novo número.');
              return;
            }
            if (orders.some((r) => r.data.id === o.id)) {
              flash('Já existe uma OS com este número.');
              return;
            }
            update(o);
            setModal(false);
            open(o.id);
          }}
        />
      )}
      {userModal && (
        <UserModal
          close={() => setUserModal(false)}
          done={() => {
            setUserModal(false);
            sync();
          }}
        />
      )}
    </div>
  );
}
function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function Login({ onLogin, notice }: { onLogin: (u: User, d: boolean) => void; notice: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <section className="login-story">
        <a className="brand">
          <Brand />
        </a>
        <div>
          <span className="banner-kicker">GESTÃO DE MANUTENÇÃO</span>
          <h1>
            Cuidando
            <br />
            <span>do que importa.</span>
          </h1>
          <p>
            Segurança. Facilities. Tecnologia.
            <br />A excelência da Souza Lima, agora em campo.
          </p>
          <div className="login-features">
            <span>
              <Wrench />
              Atendimento em campo
            </span>
            <span>
              <WifiOff />
              Continuidade offline
            </span>
            <span>
              <ShieldCheck />
              Registros protegidos
            </span>
          </div>
        </div>
        <small>SL Campo · Tecnologia a serviço do cuidado.</small>
      </section>
      <section className="login-form">
        <div>
          <div className="eyebrow">BEM-VINDO AO SEU ESPAÇO</div>
          <h1>Vamos ao trabalho?</h1>
          <p>Entre com sua conta para acompanhar os atendimentos.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const r = await api('/login', {
                  method: 'POST',
                  body: JSON.stringify({ email, password }),
                });
                onLogin(r.user, r.demo);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              E-mail corporativo
              <input
                required
                type="email"
                autoComplete="username"
                placeholder="seu.nome@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Senha
              <input
                required
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha de acesso"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {(error || notice) && (
              <p className="form-error" role="alert">
                {error || notice}
              </p>
            )}
            <button className="btn primary full" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar no SL Campo'}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <p className="login-help">
            <ShieldCheck size={15} /> Acesso individual e seguro.
            <br />
            Precisa de acesso? Fale com o administrador.
          </p>
        </div>
      </section>
    </div>
  );
}
function VisitForm({
  order,
  visit,
  change,
  flash,
  finished,
}: {
  order: Order;
  visit: Visit;
  change: (o: Order) => void;
  flash: (s: string) => void;
  finished: () => void;
}) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<'Antes' | 'Depois' | 'Peça danificada'>('Antes');
  const set = (patch: Partial<Visit>) =>
    change({
      ...order,
      hours: patch.hours ?? order.hours,
      visits: order.visits.map((v) => (v.id === visit.id ? { ...v, ...patch } : v)),
    });
  const text = (key: keyof Visit, label: string, area = false) => (
    <label key={key}>
      {label}
      {area ? (
        <textarea
          aria-label={label}
          rows={4}
          value={String(visit[key] ?? '')}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      ) : (
        <input
          aria-label={label}
          value={String(visit[key] ?? '')}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      )}
    </label>
  );
  const yesno = (key: keyof Visit, label: string) => (
    <div className="yesno" key={key}>
      <b>{label}</b>
      <div>
        {[true, false].map((b) => (
          <button
            key={String(b)}
            className={visit[key] === b ? 'selected' : ''}
            onClick={() => set({ [key]: b })}
          >
            {b ? <Check size={15} /> : <X size={15} />} {b ? 'Sim' : 'Não'}
          </button>
        ))}
      </div>
    </div>
  );
  async function photos(files: FileList | null) {
    if (!files) return;
    if (visit.photos.length + files.length > 16) {
      flash('Limite de 16 fotografias por visita.');
      return;
    }
    setLoading(true);
    try {
      const next = [];
      for (const f of Array.from(files))
        next.push({ id: uid(), category, caption: '', data: await compress(f) });
      set({ photos: [...visit.photos, ...next] });
    } catch (e: any) {
      flash(e.message);
    } finally {
      setLoading(false);
    }
  }
  function finish() {
    if (!visit.defect.trim() || !visit.diagnosis.trim() || !visit.services.trim()) {
      flash('Preencha defeito, diagnóstico e serviços executados.');
      setStep(1);
      return;
    }
    if (
      visit.signatureMode === 'Assinada' &&
      (!visit.signature || !visit.signer.trim() || !visit.signerRole.trim())
    ) {
      flash('Preencha nome, cargo e assinatura do responsável.');
      return;
    }
    if (visit.signatureMode !== 'Assinada' && !visit.signatureReason.trim()) {
      flash('Informe o motivo da ausência ou recusa.');
      return;
    }
    change({
      ...order,
      status: order.parts.some((p) => p.status !== 'Instalada') ? 'Aguardando peças' : 'Pendente',
      visits: order.visits.map((v) =>
        v.id === visit.id
          ? { ...v, checkOut: new Date().toISOString(), signedAt: new Date().toISOString() }
          : v,
      ),
    });
    flash('Visita finalizada e salva. A OS permanece aberta para acompanhamento.');
    finished();
  }
  return (
    <div className="visit-layout">
      <aside className="steps-panel">
        <span className="mini-label">LAUDO DA VISITA</span>
        <h3>
          Um registro completo,
          <br />
          passo a passo.
        </h3>
        {['Identificação', 'Diagnóstico e testes', 'Fotografias', 'Assinatura e saída'].map(
          (s, i) => (
            <button
              className={step === i ? 'step active' : 'step'}
              key={s}
              onClick={() => setStep(i)}
            >
              <span>{i < step ? <Check size={16} /> : i + 1}</span>
              <div>
                <b>{s}</b>
                <small>
                  {
                    [
                      'Chegada e equipamento',
                      'Inspeção e procedimentos',
                      'Evidências do atendimento',
                      'Ciência do responsável',
                    ][i]
                  }
                </small>
              </div>
            </button>
          ),
        )}
        <div className="save-indicator">
          <ShieldCheck size={17} />
          Salvo automaticamente no dispositivo
        </div>
      </aside>
      <section className="panel visit-panel">
        <div className="step-progress">
          <span>ETAPA {step + 1} DE 4</span>
          <span>{(step + 1) * 25}%</span>
          <div>
            <i style={{ width: (step + 1) * 25 + '%' }} />
          </div>
        </div>
        <h2>
          {
            [
              'Identifique o equipamento',
              'O que você encontrou?',
              'Cada detalhe conta',
              'Finalize esta visita',
            ][step]
          }
        </h2>
        <p className="muted">
          {
            [
              'Confira os dados antes da inspeção.',
              'Registre os procedimentos e resultados.',
              'Evidências antes e depois do serviço.',
              'Colete a ciência do cliente ou justifique a ausência.',
            ][step]
          }
        </p>
        {step === 0 && (
          <>
            <div className="checkin-box">
              <Clock size={23} />
              <div>
                <b>Check-in registrado</b>
                <p>{date(visit.checkIn)}</p>
              </div>
              <Badge status="Em andamento" />
            </div>
            <div className="form-grid">
              {(['brand', 'model', 'serial', 'asset'] as const).map((key, i) => (
                <label key={key}>
                  {['Marca', 'Modelo do equipamento', 'Número de série', 'Patrimônio'][i]}
                  <input
                    value={order[key]}
                    onChange={(e) => change({ ...order, [key]: e.target.value })}
                  />
                </label>
              ))}
              <label>
                Horímetro inicial (h)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={visit.hours}
                  onChange={(e) => set({ hours: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="location-box">
              <MapPin size={20} />
              <div>
                <b>Localização opcional</b>
                <p>Somente com sua autorização, para comprovar a chegada.</p>
                {visit.geo && (
                  <p>Localização registrada · precisão de {Math.round(visit.geo.accuracy)} m</p>
                )}
                <button
                  className="btn"
                  onClick={() =>
                    !navigator.geolocation
                      ? flash('A localização exige HTTPS no celular. Você pode continuar sem ela.')
                      : navigator.geolocation.getCurrentPosition(
                          (p) =>
                            set({
                              geo: {
                                lat: p.coords.latitude,
                                lng: p.coords.longitude,
                                accuracy: p.coords.accuracy,
                              },
                            }),
                          () =>
                            flash(
                              'Localização não autorizada ou indisponível. Continue normalmente.',
                            ),
                          { enableHighAccuracy: true, timeout: 12000 },
                        )
                  }
                >
                  Autorizar e registrar localização
                </button>
                {visit.geo && (
                  <button
                    className="text-link"
                    onClick={() => {
                      const { geo, ...rest } = visit;
                      change({
                        ...order,
                        visits: order.visits.map((v) => (v.id === visit.id ? rest : v)),
                      });
                    }}
                  >
                    Remover localização
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            {text('defect', 'Qual o defeito relatado? *', true)}
            {text('diagnosis', 'Diagnóstico técnico *', true)}
            {yesno('operational', 'O equipamento ficou funcionando?')}
            {yesno('misuse', 'Existe evidência de mau uso?')}
            {text('misuseNotes', 'Evidências / descrição do mau uso', true)}
            {text('services', 'Quais serviços foram executados? *', true)}
            {text('mechanical', 'Verificações mecânicas e resultados', true)}
            {yesno('returnNeeded', 'Necessita retorno?')}
            {text('notes', 'Recomendações / observações', true)}
            <p className="info-note">
              Solicite e registre instalações na aba Peças. Solicitações não são peças instaladas.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <label>
              Categoria das fotos
              <select value={category} onChange={(e) => setCategory(e.target.value as any)}>
                <option>Antes</option>
                <option>Depois</option>
                <option>Peça danificada</option>
              </select>
            </label>
            <div className="upload-area">
              <Camera size={34} />
              <h3>Adicione as evidências da visita</h3>
              <p>Até 16 fotos, com compressão automática.</p>
              <div className="upload-buttons">
                <label className="btn primary">
                  <Camera size={18} />
                  Tirar foto
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    disabled={loading}
                    onChange={(e) => {
                      photos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
                <label className="btn">
                  <ImagePlus size={18} />
                  Galeria
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    disabled={loading}
                    onChange={(e) => {
                      photos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {loading && <p>Comprimindo fotografias…</p>}
            </div>
            <div className="photo-grid">
              {visit.photos.map((p) => (
                <figure key={p.id}>
                  <img src={p.data} alt={p.caption || p.category} />
                  <figcaption>
                    <div className="section-heading">
                      <Badge status={p.category} />
                      <button
                        className="icon-btn danger"
                        aria-label="Excluir foto"
                        onClick={() => set({ photos: visit.photos.filter((x) => x.id !== p.id) })}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <input
                      aria-label="Legenda da foto"
                      placeholder="Descreva esta evidência…"
                      value={p.caption}
                      onChange={(e) =>
                        set({
                          photos: visit.photos.map((x) =>
                            x.id === p.id ? { ...x, caption: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="info-note">
              A assinatura registra ciência do atendimento, sem presumir aprovação comercial.
            </div>
            <label>
              Registro de ciência
              <select
                value={visit.signatureMode}
                onChange={(e) => set({ signatureMode: e.target.value as any, signature: null })}
              >
                <option>Assinada</option>
                <option>Ausente</option>
                <option>Recusa</option>
              </select>
            </label>
            {visit.signatureMode === 'Assinada' ? (
              <>
                <div className="form-grid">
                  {text('signer', 'Nome do responsável *')}
                  {text('signerRole', 'Cargo *')}
                </div>
                <label>Assinatura do responsável *</label>
                <Signature
                  value={visit.signature}
                  onChange={(data) => set({ signature: data, signedAt: new Date().toISOString() })}
                />
              </>
            ) : (
              text('signatureReason', 'Justificativa da ausência ou recusa *', true)
            )}
            <div className="checkin-box">
              <CheckCircle2 size={24} />
              <div>
                <b>Ao finalizar</b>
                <p>
                  Registramos a saída e a duração. A OS continua aberta para peças, retorno ou
                  encerramento pelo administrador.
                </p>
              </div>
            </div>
            <button className="btn primary full" onClick={finish}>
              <CheckCircle2 size={18} />
              Finalizar visita e registrar saída
            </button>
          </>
        )}
        <div className="step-buttons">
          <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} />
            Anterior
          </button>
          {step < 3 && (
            <button className="btn primary" disabled={loading} onClick={() => setStep(step + 1)}>
              Continuar
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
function Signature({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (s: string | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = canvas.current!,
      ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = value;
    }
  }, [value]);
  function point(e: React.PointerEvent) {
    const c = canvas.current!,
      r = c.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * c.width) / r.width,
      ((e.clientY - r.top) * c.height) / r.height,
    ];
  }
  return (
    <div className="signature">
      <canvas
        ref={canvas}
        width={900}
        height={300}
        aria-label="Desenhe a assinatura com o dedo"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const [x, y] = point(e);
          const ctx = e.currentTarget.getContext('2d')!;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#132e2b';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.5, y + 0.5);
          ctx.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const [x, y] = point(e);
          const ctx = e.currentTarget.getContext('2d')!;
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          if (drawing.current) {
            drawing.current = false;
            onChange(canvas.current!.toDataURL('image/png'));
          }
        }}
        onPointerCancel={() => {
          drawing.current = false;
          onChange(canvas.current!.toDataURL('image/png'));
        }}
      />
      <div>
        <span>
          <PenLine size={15} />
          Assine com o dedo na área acima
        </span>
        <button className="text-link" onClick={() => onChange(null)}>
          Limpar
        </button>
      </div>
    </div>
  );
}
function Parts({
  order,
  manager,
  change,
  activeVisit,
}: {
  order: Order;
  manager: boolean;
  change: (o: Order) => void;
  activeVisit?: Visit;
}) {
  const [adding, setAdding] = useState(false);
  const catalog = [
    ['MT13044', 'Manípulo fêmea M6'],
    ['BV16040', 'Mola de retorno do rodo Brava'],
    ['BV19084', 'Mangueira do rodo Brava'],
    ['BV22041', 'Sinalizador Strobo Brava TW'],
    ['BV20004N', 'Guarnição / vedação'],
    ['8919440746207', 'Água desmineralizada'],
    ['VF81306-1G', 'Conector cinza 175A'],
    ['TN01094', 'Cabo de bateria'],
  ];
  const [part, setPart] = useState({
    code: '',
    description: '',
    quantity: 1,
    supplier: '',
    compatible: '',
    unitCents: 0,
  });
  const update = (p: Part) =>
    change({ ...order, parts: order.parts.map((x) => (x.id === p.id ? p : x)) });
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Peças e materiais</h2>
          <p>Solicitada → Aprovada → Entregue → Instalada</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(!adding)}>
          <Plus size={17} />
          Solicitar peça
        </button>
      </div>
      <div className="info-note">
        Apenas peças entregues podem ser instaladas. Cada instalação pertence a uma visita.
      </div>
      {adding && (
        <form
          className="inset-form"
          onSubmit={(e) => {
            e.preventDefault();
            change({
              ...order,
              parts: [...order.parts, { ...part, id: uid(), status: 'Solicitada' }],
            });
            setAdding(false);
            setPart({
              code: '',
              description: '',
              quantity: 1,
              supplier: '',
              compatible: '',
              unitCents: 0,
            });
          }}
        >
          <label>
            Selecionar do catálogo
            <select
              defaultValue=""
              onChange={(e) => {
                const p = catalog.find((p) => p[0] === e.target.value);
                if (p)
                  setPart({ ...part, code: p[0], description: p[1], compatible: 'Alfa Brava' });
              }}
            >
              <option value="">Escolher peça ou preencher manualmente</option>
              {catalog.map((p) => (
                <option key={p[0]} value={p[0]}>
                  {p[0]} — {p[1]}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            {(['code', 'description', 'supplier', 'compatible'] as const).map((k, i) => (
              <label key={k}>
                {['Código', 'Descrição', 'Fornecedor', 'Equipamentos compatíveis'][i]}
                <input
                  required={i < 2}
                  value={part[k]}
                  onChange={(e) => setPart({ ...part, [k]: e.target.value })}
                />
              </label>
            ))}
            <label>
              Quantidade
              <input
                type="number"
                inputMode="numeric"
                required
                min="1"
                max="10000"
                value={part.quantity}
                onChange={(e) => setPart({ ...part, quantity: Number(e.target.value) })}
              />
            </label>
            {manager && (
              <label>
                Valor unitário (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  onChange={(e) =>
                    setPart({ ...part, unitCents: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </label>
            )}
          </div>
          <button className="btn primary">Salvar solicitação</button>
        </form>
      )}
      {order.parts.map((p) => (
        <div className="part-card" key={p.id}>
          <div className="part-description">
            <span className="square-icon">
              <Package size={22} />
            </span>
            <div>
              <span className="mini-label">{p.code}</span>
              <h3>{p.description}</h3>
              <p>
                {p.quantity} un. · {p.compatible || 'Compatibilidade não informada'}
              </p>
              <small>{p.supplier || 'Fornecedor não informado'}</small>
            </div>
          </div>
          <div className="part-action">
            <Badge status={p.status} />
            {manager && p.status === 'Solicitada' && (
              <button className="btn" onClick={() => update({ ...p, status: 'Aprovada' })}>
                Aprovar solicitação
              </button>
            )}
            {manager && p.status === 'Aprovada' && (
              <button className="btn" onClick={() => update({ ...p, status: 'Entregue' })}>
                <Truck size={16} />
                Registrar entrega
              </button>
            )}
            {p.status === 'Entregue' && (
              <button
                className="btn"
                disabled={!activeVisit}
                onClick={() =>
                  update({ ...p, status: 'Instalada', installedVisitId: activeVisit!.id })
                }
              >
                <Wrench size={16} />
                Registrar instalação
              </button>
            )}
            {manager && (
              <label className="price-input">
                Unitário (R$)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={(p.unitCents || 0) / 100}
                  disabled={p.status === 'Instalada'}
                  onChange={(e) =>
                    update({ ...p, unitCents: Math.round(Number(e.target.value) * 100) })
                  }
                />
                <b>{money(p.quantity * (p.unitCents || 0))}</b>
              </label>
            )}
          </div>
        </div>
      ))}
      {!order.parts.length && (
        <div className="empty">
          <Package size={38} />
          <h3>Nenhuma peça solicitada</h3>
          <p>Use o catálogo ou cadastre um produto manualmente.</p>
        </div>
      )}
      {manager && (
        <div className="cost-summary">
          <h2>Serviços e custos</h2>
          <div className="form-grid">
            {(['laborCents', 'travelCents', 'extraCents'] as const).map((k, i) => (
              <label key={k}>
                {['Mão de obra (R$)', 'Deslocamento (R$)', 'Custos adicionais (R$)'][i]}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={(order[k] || 0) / 100}
                  onChange={(e) =>
                    change({ ...order, [k]: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </label>
            ))}
          </div>
          <div className="total-line">
            <span>
              Total de peças <small>inclui solicitações</small>
            </span>
            <b>{money(order.parts.reduce((a, p) => a + p.quantity * (p.unitCents || 0), 0))}</b>
          </div>
          <div className="total-line">
            <span>Serviços e deslocamento</span>
            <b>
              {money((order.laborCents || 0) + (order.travelCents || 0) + (order.extraCents || 0))}
            </b>
          </div>
          <div className="total-line grand">
            <span>Total registrado</span>
            <b>
              {money(
                order.parts.reduce((a, p) => a + p.quantity * (p.unitCents || 0), 0) +
                  (order.laborCents || 0) +
                  (order.travelCents || 0) +
                  (order.extraCents || 0),
              )}
            </b>
          </div>
          <p>
            {order.referenceNote || 'Valores não constituem aprovação de orçamento ou faturamento.'}
          </p>
        </div>
      )}
    </section>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>('button,input')?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>('button,input,select,textarea') || [],
        ).filter((x) => !x.hasAttribute('disabled'));
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="Fechar janela">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function NewOrder({
  users,
  close,
  create,
}: {
  users: { id: string; name: string }[];
  close: () => void;
  create: (o: Order) => void;
}) {
  return (
    <Modal title="Nova ordem de serviço" close={close}>
      <p className="muted">Cadastre o atendimento e atribua um técnico.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            get = (s: string) => String(f.get(s) || '');
          create({
            id: get('id'),
            client: get('client'),
            unit: get('unit'),
            address: get('address'),
            equipment: get('equipment'),
            brand: get('brand'),
            model: get('model'),
            serial: get('serial'),
            asset: get('asset'),
            hours: Number(get('hours')),
            type: get('type') as any,
            priority: get('priority') as any,
            technicianId: get('technicianId'),
            scheduled: get('scheduled'),
            createdAt: new Date().toISOString(),
            status: 'Pendente',
            supplierOrder: '',
            parts: [],
            visits: [],
            laborCents: 0,
            travelCents: 0,
            extraCents: 0,
            referenceNote: '',
          });
        }}
      >
        <div className="form-grid">
          {[
            ['id', 'Número da OS *'],
            ['client', 'Cliente *'],
            ['unit', 'Unidade *'],
            ['equipment', 'Equipamento *'],
            ['address', 'Endereço'],
            ['brand', 'Marca'],
            ['model', 'Modelo'],
            ['serial', 'Série'],
            ['asset', 'Patrimônio'],
          ].map(([k, l], i) => (
            <label key={k}>
              {l}
              <input
                name={k}
                required={i < 4}
                maxLength={k === 'id' ? 50 : 150}
                pattern={k === 'id' ? '[A-Za-z0-9-]+' : undefined}
              />
            </label>
          ))}
          <label>
            Horímetro
            <input name="hours" type="number" min="0" step="0.1" defaultValue="0" required />
          </label>
          <label>
            Tipo
            <select name="type">
              <option>Preventiva</option>
              <option>Corretiva</option>
            </select>
          </label>
          <label>
            Prioridade
            <select name="priority">
              <option>Média</option>
              <option>Baixa</option>
              <option>Alta</option>
              <option>Urgente</option>
            </select>
          </label>
          <label>
            Responsável pelo atendimento *
            <select name="technicianId" required defaultValue={users[0]?.id || ''}>
              <option value="">Selecione</option>
              {users.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Agendamento *<input name="scheduled" type="date" required defaultValue={day()} />
          </label>
        </div>
        {!users.length && (
          <p className="form-error">Cadastre um técnico na seção Equipe técnica.</p>
        )}
        <button className="btn primary full" disabled={!users.length}>
          <Plus size={17} />
          Criar ordem de serviço
        </button>
      </form>
    </Modal>
  );
}
function UserModal({ close, done }: { close: () => void; done: () => void }) {
  const [error, setError] = useState('');
  return (
    <Modal title="Adicionar usuário" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api('/users', {
              method: 'POST',
              body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
            });
            done();
          } catch (e: any) {
            setError(e.message);
          }
        }}
      >
        <label>
          Nome
          <input name="name" required />
        </label>
        <label>
          E-mail
          <input name="email" type="email" required />
        </label>
        <label>
          Senha inicial
          <input
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </label>
        <input type="hidden" name="role" value="tecnico" />
        <p className="muted">
          Perfil: técnico. O acesso administrativo utiliza o login único do administrador.
        </p>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary full">Criar usuário</button>
      </form>
    </Modal>
  );
}
function Audit({ id }: { id: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  return (
    <div>
      <button
        className="text-link"
        onClick={async () => {
          try {
            setRows(await api('/orders/' + id + '/audit'));
            setError('');
          } catch (e: any) {
            setError(e.message);
          }
        }}
      >
        Consultar histórico de alterações
      </button>
      {error && <p className="form-error">{error}</p>}
      {rows.map((r, i) => (
        <div className="audit-row" key={i}>
          <b>{r.action}</b>
          <small>
            {r.name} · {date(r.created_at)}
          </small>
        </div>
      ))}
    </div>
  );
}
function Metrics({ orders, cost }: { orders: Order[]; cost: (o: Order) => number }) {
  const visits = orders.flatMap((o) => o.visits).filter((v) => v.checkOut);
  const average = visits.length
    ? visits.reduce((a, v) => a + (+new Date(v.checkOut!) - +new Date(v.checkIn)) / 60000, 0) /
      visits.length
    : 0;
  const closed = orders.filter((o) => o.status === 'Concluída');
  return (
    <section className="panel">
      <h2>Indicadores da operação</h2>
      <div className="metrics-grid">
        {[
          ['Atendimentos realizados', visits.length],
          [
            'Atendimentos do dia',
            orders
              .flatMap((o) => o.visits)
              .filter((v) => new Date(v.checkIn).toDateString() === new Date().toDateString())
              .length,
          ],
          [
            'Máquinas paradas',
            orders.filter((o) => o.visits.length && !o.visits.at(-1)?.operational).length,
          ],
          ['Máquinas liberadas', orders.filter((o) => o.visits.at(-1)?.operational).length],
          ['Tempo médio de visita', Math.round(average) + ' min'],
          [
            'Tempo médio de encerramento',
            closed.length
              ? Math.round(
                  closed.reduce(
                    (n, o) =>
                      n +
                      (+new Date(o.visits.at(-1)!.checkOut!) - +new Date(o.createdAt)) / 3600000,
                    0,
                  ) / closed.length,
                ) + ' h'
              : 'Sem encerramentos',
          ],
          ['Visitas de retorno', orders.reduce((n, o) => n + Math.max(0, o.visits.length - 1), 0)],
          [
            'Preventivas',
            orders.length
              ? Math.round(
                  (orders.filter((o) => o.type === 'Preventiva').length / orders.length) * 100,
                ) + '%'
              : '0%',
          ],
          [
            'Corretivas',
            orders.length
              ? Math.round(
                  (orders.filter((o) => o.type === 'Corretiva').length / orders.length) * 100,
                ) + '%'
              : '0%',
          ],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <h3>Valores por unidade / equipamento</h3>
      {orders.map((o) => (
        <div className="total-line" key={o.id}>
          <span>
            {o.unit} · {o.equipment}
          </span>
          <b>{money(cost(o))}</b>
        </div>
      ))}
      <p className="info-note">Valores incluem solicitações; não representam custos faturados.</p>
    </section>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
