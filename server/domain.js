import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
const image = z
  .string()
  .max(1600000)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);
const visit = z.object({
  id: z.string(),
  technicianId: z.string().optional(),
  technicianName: z.string().max(150).optional(),
  checkIn: z.iso.datetime({ offset: true }),
  checkOut: z.iso.datetime({ offset: true }).optional(),
  hours: z.number().min(0),
  defect: z.string().max(5000).default(''),
  diagnosis: z.string().max(5000).default(''),
  services: z.string().max(5000).default(''),
  operational: z.boolean(),
  misuse: z.boolean(),
  misuseNotes: z.string().max(5000).default(''),
  returnNeeded: z.boolean(),
  notes: z.string().max(5000).default(''),
  voltage: z.string().max(500).optional(),
  battery: z.string().max(1000).optional(),
  mechanical: z.string().max(1000).default(''),
  photos: z
    .array(
      z.object({
        id: z.string(),
        category: z.enum(['Antes', 'Depois', 'Peça danificada']),
        caption: z.string().max(500),
        data: image,
      }),
    )
    .max(16),
  signature: image.nullable().default(null),
  signatureReason: z.string().max(1000).default(''),
  signer: z.string().max(150).default(''),
  signerRole: z.string().max(150).default(''),
  signatureMode: z.enum(['Assinada', 'Ausente', 'Recusa']),
  signedAt: z.string().optional(),
  geo: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracy: z.number().min(0),
    })
    .optional(),
});
export const orderSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,50}$/),
  supplierOrder: z.string().max(50).default(''),
  client: z.string().min(1).max(150),
  unit: z.string().min(1).max(150),
  address: z.string().max(500).default(''),
  equipment: z.string().min(1).max(150),
  brand: z.string().max(150).default(''),
  model: z.string().max(150).default(''),
  serial: z.string().max(150).default(''),
  asset: z.string().max(150).default(''),
  hours: z.number().min(0),
  type: z.enum(['Preventiva', 'Corretiva']),
  priority: z.enum(['Baixa', 'Média', 'Alta', 'Urgente']),
  status: z.enum(['Pendente', 'Em andamento', 'Aguardando peças', 'Concluída']),
  technicianId: z.string(),
  scheduled: z.string(),
  createdAt: z.string(),
  parts: z
    .array(
      z.object({
        id: z.string(),
        code: z.string().min(1).max(100),
        description: z.string().min(1).max(300),
        quantity: z.number().int().min(1).max(10000),
        unitCents: z.number().int().min(0).max(100000000).optional(),
        status: z.enum(['Solicitada', 'Aprovada', 'Entregue', 'Instalada']),
        supplier: z.string().max(150).default(''),
        compatible: z.string().max(150).default(''),
        installedVisitId: z.string().optional(),
      }),
    )
    .max(100),
  visits: z.array(visit).max(100),
  laborCents: z.number().int().nonnegative().optional(),
  travelCents: z.number().int().nonnegative().optional(),
  extraCents: z.number().int().nonnegative().optional(),
  referenceNote: z.string().max(1000).default(''),
});
export function sanitize(order, role) {
  const copy = structuredClone(order);
  if (role === 'tecnico') {
    delete copy.laborCents;
    delete copy.travelCents;
    delete copy.extraCents;
    copy.parts.forEach((p) => delete p.unitCents);
  }
  return copy;
}
export function validateTransition(next, previous, user, { initial = false } = {}) {
  if (user.role === 'tecnico') {
    for (const key of [
      'technicianId',
      'client',
      'unit',
      'scheduled',
      'type',
      'priority',
      'createdAt',
      'supplierOrder',
    ])
      if (next[key] !== previous[key])
        throw Error('Somente o administrador altera identificação e atribuição.');
    next.laborCents = previous.laborCents;
    next.travelCents = previous.travelCents;
    next.extraCents = previous.extraCents;
    for (const old of previous.parts)
      if (!next.parts.some((p) => p.id === old.id))
        throw Error('Peças registradas não podem ser removidas.');
    for (const p of next.parts) {
      const old = previous.parts.find((x) => x.id === p.id);
      p.unitCents = old?.unitCents || 0;
      if (!old && p.status !== 'Solicitada') throw Error('Novas peças devem ser solicitadas.');
      if (old) {
        if (p.code !== old.code || p.quantity !== old.quantity || p.description !== old.description)
          throw Error('Não altere uma solicitação registrada.');
        if (p.status !== old.status && !(old.status === 'Entregue' && p.status === 'Instalada'))
          throw Error('Aprovação e entrega exigem administrador.');
      }
    }
  }
  for (const p of next.parts) {
    const old = previous?.parts.find((x) => x.id === p.id);
    if (old?.status === 'Instalada' && !isDeepStrictEqual(p, old))
      throw Error('Instalação registrada é imutável.');
    if (
      !initial &&
      p.status === 'Instalada' &&
      old?.status !== 'Instalada' &&
      old?.status !== 'Entregue'
    )
      throw Error('Somente peças entregues podem ser instaladas.');
    if (
      !initial &&
      p.status === 'Instalada' &&
      old?.status !== 'Instalada' &&
      !next.visits.some(
        (v) =>
          v.id === p.installedVisitId &&
          (!v.checkOut ||
            previous.visits.some((oldVisit) => oldVisit.id === v.id && !oldVisit.checkOut)),
      )
    )
      throw Error('Instale durante uma visita em andamento.');
    if (p.status === 'Instalada' && !next.visits.some((v) => v.id === p.installedVisitId))
      throw Error('Instalação exige visita.');
    if (
      old &&
      p.status !== old.status &&
      p.status !== 'Instalada' &&
      ['Solicitada', 'Aprovada', 'Entregue'].indexOf(p.status) !==
        ['Solicitada', 'Aprovada', 'Entregue'].indexOf(old.status) + 1
    )
      throw Error('Siga a sequência de aprovação e entrega.');
  }
  for (const old of previous?.visits || []) {
    if (!next.visits.some((v) => v.id === old.id))
      throw Error('Visitas registradas não podem ser removidas.');
    if (
      old.checkOut &&
      !isDeepStrictEqual(
        next.visits.find((v) => v.id === old.id),
        old,
      )
    )
      throw Error('Visita concluída é imutável. Abra um retorno.');
  }
  if (next.visits.filter((v) => !v.checkOut).length > 1)
    throw Error('Já existe visita em andamento.');
  for (const v of next.visits) {
    if (v.checkOut) {
      if (Date.parse(v.checkOut) < Date.parse(v.checkIn)) throw Error('Saída anterior à chegada.');
      if (!v.defect.trim() || !v.diagnosis.trim() || !v.services.trim())
        throw Error('Preencha defeito, diagnóstico e serviços.');
      if (
        v.signatureMode === 'Assinada' &&
        (!v.signature || !v.signer.trim() || !v.signerRole.trim())
      )
        throw Error('Preencha assinatura, nome e cargo.');
      if (v.signatureMode !== 'Assinada' && !v.signatureReason.trim())
        throw Error('Justifique a ausência ou recusa de assinatura.');
    }
  }
  if (
    next.status === 'Concluída' &&
    (!next.visits.length ||
      next.visits.some((v) => !v.checkOut) ||
      next.visits.at(-1).returnNeeded ||
      next.parts.some((p) => p.status !== 'Instalada'))
  )
    throw Error('Há visita, retorno ou peças pendentes.');
  return next;
}

/** A new OS may already contain a locally completed visit before its first upload. */
export function validateInitialOrder(order, user) {
  if (user.role !== 'admin') throw Error('Somente o administrador cadastra OS.');
  const empty = { ...order, status: 'Pendente', parts: [], visits: [] };
  return validateTransition(order, empty, user, { initial: true });
}
export function validationMessage(error) {
  const issue = error.issues?.[0];
  if (!issue) return 'Revise os dados deste atendimento.';
  const labels = {
    id: 'Número da OS',
    client: 'Cliente',
    unit: 'Unidade',
    equipment: 'Equipamento',
    hours: 'Horímetro',
    quantity: 'Quantidade',
    photos: 'Fotografias',
    data: 'Imagem',
    caption: 'Legenda',
    defect: 'Defeito relatado',
    diagnosis: 'Diagnóstico',
    services: 'Serviços realizados',
    notes: 'Observações',
    signature: 'Assinatura',
    signer: 'Nome do responsável',
    signerRole: 'Cargo',
    mechanical: 'Verificações mecânicas',
    brand: 'Marca',
    model: 'Modelo',
    serial: 'Número de série',
    asset: 'Patrimônio',
    technicianId: 'Responsável pelo atendimento',
    checkIn: 'Data de chegada',
    checkOut: 'Data de saída',
    status: 'Situação',
    priority: 'Prioridade',
    signatureMode: 'Registro de assinatura',
    category: 'Categoria da foto',
    description: 'Descrição da peça',
    code: 'Código da peça',
    scheduled: 'Agendamento',
    createdAt: 'Data de criação',
  };
  const path = issue.path || [];
  const key = [...path].reverse().find((key) => typeof key === 'string' && labels[key]);
  const label = labels[key] || 'Dados do atendimento';
  if (issue.code === 'too_big')
    return `${label}: limite de ${issue.maximum}${issue.origin === 'string' ? ' caracteres' : ''} excedido. Reduza esse campo e tente novamente.`;
  return `${label}: valor inválido ou não preenchido. Corrija esse campo e tente novamente.`;
}
