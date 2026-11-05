export type InternalCallFields = {
  id: string;
  client: string;
  unit: string;
  equipment: string;
  model: string;
  brand: string;
  serial: string;
  address: string;
  reportedDefect: string;
  internalNotes: string;
  scheduled: string;
  createdAt: string;
};

const normalized = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

function valueAfter(lines: string[], label: string) {
  const wanted = normalized(label) + ':';
  const line = lines.find((candidate) => normalized(candidate).startsWith(wanted));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
}

function opening(value: string) {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) return undefined;
  const [, date, month, year, hour = '00', minute = '00', second = '00'] = match;
  return {
    scheduled: `${year}-${month}-${date}`,
    createdAt: new Date(`${year}-${month}-${date}T${hour}:${minute}:${second}-03:00`).toISOString(),
  };
}

function performanceNotes(lines: string[]) {
  const start = lines.findIndex((line) =>
    normalized(line).startsWith('# OBSERVACOES PERFORMANCE:'),
  );
  if (start < 0) return '';
  const notes = [];
  for (const line of lines.slice(start + 1)) {
    const text = line.trim();
    if (!text || /^-+$/.test(text) || text.startsWith('#')) break;
    notes.push(text);
  }
  return notes.join(' ');
}

export function parseInternalCall(lines: string[]): InternalCallFields {
  const id =
    valueAfter(lines, 'Numero') ||
    lines.map((line) => line.match(/^(\d+)\s*\|/i)?.[1]).find(Boolean) ||
    '';
  const client = valueAfter(lines, 'CLIENTE');
  const equipment = valueAfter(lines, 'QUAL É O MAQUINÁRIO?') || valueAfter(lines, 'MAQUINARIO');
  if (!id || !client || !equipment)
    throw new Error(
      'Este PDF não possui número, cliente ou equipamento no formato do chamado interno.',
    );
  const opened = opening(valueAfter(lines, 'ABERTURA DA SOLICITAÇÃO'));
  const today = new Date().toLocaleDateString('en-CA');
  return {
    id,
    client,
    unit: valueAfter(lines, 'FILIAL') || client,
    equipment,
    model: valueAfter(lines, 'MODELO'),
    brand: valueAfter(lines, 'FABRICANTE'),
    serial: valueAfter(lines, 'NUMERO DE SERIE'),
    address: valueAfter(lines, 'ENDEREÇO DO CLIENTE'),
    reportedDefect: valueAfter(lines, 'DESCREVA O PROBLEMA DO MAQUINÁRIO'),
    internalNotes: performanceNotes(lines),
    scheduled: opened?.scheduled || today,
    createdAt: opened?.createdAt || new Date().toISOString(),
  };
}
