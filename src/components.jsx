import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Award,
  Ban,
  Bell,
  Bird,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChartSpline,
  Check,
  CheckCheck,
  ChevronsUpDown,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock3,
  CloudRain,
  CloudSun,
  Cpu,
  Dna,
  Download,
  Droplets,
  Eye,
  Factory,
  Fingerprint,
  Flag,
  FlaskConical,
  Footprints,
  Globe2,
  GraduationCap,
  HandHeart,
  Handshake,
  HardDriveDownload,
  HeartPulse,
  Hospital,
  House,
  Inbox,
  Info,
  Landmark,
  LayoutDashboard,
  Leaf,
  LocateFixed,
  LockKeyhole,
  Megaphone,
  Menu,
  Minus,
  Mountain,
  MousePointer2,
  Newspaper,
  Orbit,
  PenLine,
  Plane,
  Plus,
  Radar,
  RadioTower,
  RefreshCw,
  Rocket,
  RotateCw,
  Scale,
  ScanEye,
  ScanText,
  ScrollText,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Sprout,
  Sun,
  Swords,
  TrainFront,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Upload,
  UserRound,
  Users,
  Vote,
  Wallet,
  Waves,
  Wheat,
  Zap,
} from 'lucide-react';
const Icons = {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Award,
  Ban,
  Bell,
  Bird,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChartSpline,
  Check,
  CheckCheck,
  ChevronsUpDown,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock3,
  CloudRain,
  CloudSun,
  Cpu,
  Dna,
  Download,
  Droplets,
  Eye,
  Factory,
  Fingerprint,
  Flag,
  FlaskConical,
  Footprints,
  Globe2,
  GraduationCap,
  HandHeart,
  Handshake,
  HardDriveDownload,
  HeartPulse,
  Hospital,
  House,
  Inbox,
  Info,
  Landmark,
  LayoutDashboard,
  Leaf,
  LocateFixed,
  LockKeyhole,
  Megaphone,
  Menu,
  Minus,
  Mountain,
  MousePointer2,
  Newspaper,
  Orbit,
  PenLine,
  Plane,
  Plus,
  Radar,
  RadioTower,
  RefreshCw,
  Rocket,
  RotateCw,
  Scale,
  ScanEye,
  ScanText,
  ScrollText,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Sprout,
  Sun,
  Swords,
  TrainFront,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Upload,
  UserRound,
  Users,
  Vote,
  Wallet,
  Waves,
  Wheat,
  Zap,
};
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { COUNTRIES } from './data.js';

export const number = (value, digits = 0) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
export const money = (value) => `US$ ${number(value, Math.abs(value) < 10 ? 1 : 0)} bi`;
export function Icon({ name, size = 20, ...props }) {
  const Component = Icons[name] || Icons.Circle;
  return <Component size={size} strokeWidth={1.7} {...props} />;
}
export function Button({ children, icon, variant = '', className = '', ...props }) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}
export function Badge({ children, tone = '' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Progress({ value, color, className = '' }) {
  return (
    <div className={`progress ${className}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
export function Empty({ icon = 'Inbox', title, text }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function Modal({ title, eyebrow, onClose, children, wide = false }) {
  const ref = useRef();
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    function keydown(e) {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const nodes = ref.current.querySelectorAll(
        'button:not([disabled]), input, textarea, select, [tabindex="0"]',
      );
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{eyebrow || 'GABINETE PRESIDENCIAL'}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Fechar janela" onClick={onClose}>
            <Icon name="X" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Sparkline({ values, color = '#c4e899', filled = false, height = 44 }) {
  const id = useId().replace(/:/g, '');
  const data = values.length > 1 ? values : [values[0] || 0, values[0] || 0];
  const min = Math.min(...data) - 0.5;
  const max = Math.max(...data) + 0.5;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * 200},${height - 5 - ((v - min) / (max - min)) * (height - 10)}`,
    )
    .join(' ');
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 200 ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Evolução do indicador"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled && <polygon points={`0,${height} ${points} 200,${height}`} fill={`url(#${id})`} />}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Hemicycle({ parties, size = 'normal' }) {
  const dots = [];
  const total = parties.reduce((sum, p) => sum + p.seats, 0);
  for (let row = 0; row < 6; row++) {
    const count = 15 + row * 5;
    for (let j = 0; j < count; j++) {
      const angle = Math.PI - (Math.PI * j) / (count - 1);
      const index = dots.length;
      const radius = 48 + row * 14;
      dots.push({ x: 150 + Math.cos(angle) * radius, y: 137 - Math.sin(angle) * radius, index });
    }
  }
  return (
    <svg
      viewBox="0 0 300 155"
      className={`hemicycle ${size}`}
      role="img"
      aria-label="Distribuição das bancadas no Parlamento"
    >
      {dots.map((dot, index) => {
        let running = 0;
        const party =
          parties.find((p) => {
            running += p.seats;
            return index / dots.length < running / total;
          }) || parties.at(-1);
        return (
          <circle
            key={index}
            cx={dot.x}
            cy={dot.y}
            r="3.2"
            fill={party.color}
            opacity={party.relation >= 60 ? 1 : 0.45}
          />
        );
      })}
    </svg>
  );
}

// Retain the local map between screens, including when the connection drops.
let worldGeometry;
let worldRequest;
function loadWorld() {
  if (worldGeometry) return Promise.resolve(worldGeometry);
  if (!worldRequest) {
    worldRequest = fetch('/world.json')
      .then((response) => {
        if (!response.ok) throw new Error('Mapa indisponível');
        return response.json();
      })
      .then((data) => {
        worldGeometry = feature(data, data.objects.countries).features;
        return worldGeometry;
      })
      .catch((error) => {
        worldRequest = null;
        throw error;
      });
  }
  return worldRequest;
}

export function Globe({
  country,
  selected,
  relations,
  onSelect,
  mode = 'political',
  large = false,
}) {
  const [world, setWorld] = useState(worldGeometry || null);
  const [failed, setFailed] = useState(false);
  const [rotation, setRotation] = useState([30, -12]);
  const [zoom, setZoom] = useState(1);
  const drag = useRef(null);
  const moved = useRef(false);
  useEffect(() => {
    const currentCountry = COUNTRIES.find((c) => c.id === country);
    setRotation(
      country === '076'
        ? [30, -12]
        : [-currentCountry.coordinates[0], -currentCountry.coordinates[1]],
    );
    setZoom(1);
  }, [country]);
  useEffect(() => {
    let mounted = true;
    loadWorld()
      .then((features) => {
        if (mounted) setWorld(features);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, []);
  const projection = useMemo(
    () =>
      geoOrthographic()
        .scale(210 * zoom)
        .translate([360, 240])
        .rotate(rotation)
        .clipAngle(90),
    [rotation, zoom],
  );
  const path = geoPath(projection);
  const focused = COUNTRIES.find((c) => c.id === selected);
  const own = COUNTRIES.find((c) => c.id === country);
  function focus() {
    const c = focused || own;
    setRotation([-c.coordinates[0], -c.coordinates[1]]);
    setZoom(1);
  }
  const fill = (id) => {
    if (id === country) return '#c5e99a';
    if (id === selected) return '#a0cdb7';
    if (mode === 'relations' && relations[id])
      return relations[id].war
        ? '#a65c51'
        : relations[id].score >= 65
          ? '#63826b'
          : relations[id].score < 40
            ? '#665047'
            : '#394f42';
    if (mode === 'economy') {
      const c = COUNTRIES.find((c) => c.id === id);
      return c ? (c.gdp > 4000 ? '#789b80' : c.gdp > 1800 ? '#526f59' : '#354b3c') : '#29352d';
    }
    return '#303e34';
  };
  return (
    <div className={`globe-container ${large ? 'large' : ''}`}>
      <div className="map-cross one" />
      <div className="map-cross two" />
      {failed ? (
        <Empty
          title="Não foi possível carregar o mapa"
          text="Recarregue a página. Os demais painéis continuam disponíveis."
        />
      ) : (
        <svg
          className="globe"
          viewBox="0 0 720 480"
          aria-label="Globo mundial interativo. Arraste para girar e selecione um país."
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, rotation };
            moved.current = false;
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x;
            const dy = e.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 5) {
              moved.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
            }
            setRotation([
              drag.current.rotation[0] + dx * 0.3,
              Math.max(-80, Math.min(80, drag.current.rotation[1] - dy * 0.3)),
            ]);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <defs>
            <radialGradient id="ocean">
              <stop offset="0%" stopColor="#1e2d24" />
              <stop offset="100%" stopColor="#131f18" />
            </radialGradient>
            <radialGradient id="atmosphere">
              <stop offset="85%" stopColor="#9ebf83" stopOpacity="0" />
              <stop offset="100%" stopColor="#9ebf83" stopOpacity=".09" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="12" />
            </filter>
          </defs>
          <circle
            cx="360"
            cy="240"
            r={218 * zoom}
            fill="#8da97a"
            opacity=".09"
            filter="url(#glow)"
          />
          <path
            d={path({ type: 'Sphere' })}
            fill="url(#ocean)"
            stroke="#526047"
            strokeWidth="0.7"
          />
          <path
            d={path(geoGraticule10())}
            fill="none"
            stroke="#698066"
            strokeOpacity=".16"
            strokeWidth=".5"
          />
          {world?.map((c) => {
            const id = String(c.id).padStart(3, '0');
            const playable = COUNTRIES.find((x) => x.id === id);
            return (
              <path
                key={id}
                d={path(c) || ''}
                fill={fill(id)}
                stroke={id === country ? '#e4ffbd' : '#101a13'}
                strokeWidth={id === country ? 1 : 0.65}
                className={playable ? 'country-shape playable' : 'country-shape'}
                onClick={() => {
                  if (!moved.current && playable) onSelect(id);
                }}
              >
                <title>
                  {playable?.name || c.properties.name}
                  {playable ? ' · clique para selecionar' : ''}
                </title>
              </path>
            );
          })}
          <circle cx="360" cy="240" r={209 * zoom} fill="url(#atmosphere)" pointerEvents="none" />
          {COUNTRIES.filter((c) => c.id === country || c.id === selected).map((c) => {
            if (geoDistance(c.coordinates, [-rotation[0], -rotation[1]]) > Math.PI / 2) return null;
            const [x, y] = projection(c.coordinates);
            return (
              <g key={c.id} pointerEvents="none">
                <circle cx={x} cy={y} r="10" fill="#def4af" opacity=".16" />
                <circle cx={x} cy={y} r="3" fill="#efffd4" />
                <path
                  d={`M${x + 8},${y - 4}l18,-18h35`}
                  fill="none"
                  stroke="#c9ddae"
                  strokeWidth=".7"
                />
                <text
                  x={x + 35}
                  y={y - 29}
                  fill="#e2edda"
                  fontSize="9"
                  fontFamily="monospace"
                  letterSpacing="1.5"
                >
                  {c.name.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <div className="map-coordinates">
        {Math.abs(rotation[1]).toFixed(1)}° {rotation[1] < 0 ? 'S' : 'N'} <span>/</span>{' '}
        {Math.abs(rotation[0]).toFixed(1)}° {rotation[0] > 0 ? 'W' : 'E'}
      </div>
      <div className="map-controls">
        <button aria-label="Aproximar mapa" onClick={() => setZoom((z) => Math.min(1.7, z + 0.15))}>
          <Icon name="Plus" size={16} />
        </button>
        <button aria-label="Afastar mapa" onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}>
          <Icon name="Minus" size={16} />
        </button>
        <button aria-label="Centralizar país selecionado" onClick={focus}>
          <Icon name="LocateFixed" size={16} />
        </button>
        <button
          aria-label="Girar globo para leste"
          onClick={() => setRotation((r) => [r[0] - 45, r[1]])}
        >
          <Icon name="RotateCw" size={16} />
        </button>
      </div>
      <div className="map-legend">
        <i /> Seu território <i className="other" />{' '}
        {mode === 'relations'
          ? 'Relações diplomáticas'
          : mode === 'economy'
            ? 'Atividade econômica'
            : 'Comunidade internacional'}
      </div>
    </div>
  );
}
