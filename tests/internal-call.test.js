import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInternalCall } from '../src/internal-call-parser.ts';

test('PDF interno preenche a OS sem redigitação', () => {
  const parsed = parseInternalCall([
    'ABERTURA DA SOLICITAÇÃO: 03/11/2026 12:30:03',
    'CLIENTE: F6117 39117 PROMA',
    'FILIAL: MINAS GERAIS',
    'QUAL É O MAQUINÁRIO?: Lavadora de piso',
    'MODELO: KARCJER BD 50',
    'FABRICANTE: KARCHER',
    'DESCREVA O PROBLEMA DO MAQUINÁRIO: MANGUEIRA DO RODO COM VAZAMENTO',
    'NUMERO DE SERIE: 000922',
    'ENDEREÇO DO CLIENTE: ENDEREÇO FICTÍCIO, 100',
    '# OBSERVAÇÕES PERFORMANCE:',
    'LEVAR EPIS E ÓCULOS DE PROTEÇÃO',
    '-------------------------------------------------------',
    'Numero: 44824',
  ]);
  assert.deepEqual(
    {
      id: parsed.id,
      client: parsed.client,
      unit: parsed.unit,
      equipment: parsed.equipment,
      model: parsed.model,
      brand: parsed.brand,
      serial: parsed.serial,
      defect: parsed.reportedDefect,
      notes: parsed.internalNotes,
      scheduled: parsed.scheduled,
    },
    {
      id: '44824',
      client: 'F6117 39117 PROMA',
      unit: 'MINAS GERAIS',
      equipment: 'Lavadora de piso',
      model: 'KARCJER BD 50',
      brand: 'KARCHER',
      serial: '000922',
      defect: 'MANGUEIRA DO RODO COM VAZAMENTO',
      notes: 'LEVAR EPIS E ÓCULOS DE PROTEÇÃO',
      scheduled: '2026-11-03',
    },
  );
});
