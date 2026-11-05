import { jsPDF } from 'jspdf';
import type { Order, User, Visit } from './types';
export const money = (c = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
export const date = (s?: string) =>
  s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
export function report(order: Order, user: User, kind: 'OS' | 'Relatório técnico', visit?: Visit) {
  const pdf = new jsPDF();
  let y = 20;
  const width = 174;
  const page = () => {
    pdf.addPage();
    y = 20;
  };
  const line = (label: string, value: unknown) => {
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(`${label}: ${value ?? '—'}`, width);
    for (const l of lines) {
      if (y > 275) page();
      pdf.text(l, 18, y);
      y += 5;
    }
    y += 2;
  };
  const title = (s: string) => {
    if (y > 260) page();
    y += 5;
    pdf.setTextColor(0, 27, 128);
    pdf.setFontSize(13);
    pdf.text(s, 18, y);
    pdf.setTextColor(30);
    y += 8;
  };
  pdf.setFillColor(0, 27, 128);
  pdf.rect(0, 0, 210, 35, 'F');
  pdf.setFillColor(255, 190, 0);
  pdf.rect(0, 35, 210, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.text('SL CAMPO', 18, 17);
  pdf.setFontSize(10);
  pdf.text('GRUPO SOUZA LIMA | ' + kind.toUpperCase(), 18, 26);
  pdf.setTextColor(30);
  y = 46;
  line('Ordem de serviço', order.id + ' · ' + order.status);
  line('Cliente / unidade', order.client + ' / ' + order.unit);
  line('Endereço', order.address);
  line('Equipamento', `${order.equipment} | ${order.brand} ${order.model}`);
  line('Série / patrimônio', `${order.serial} / ${order.asset}`);
  line('Manutenção', order.type);
  line('OS fornecedor (referência)', order.supplierOrder || 'Não se aplica');
  for (const v of visit ? [visit] : order.visits) {
    title('Visita técnica');
    line(
      'Técnico responsável',
      v.technicianName ||
        order.technicianName ||
        (user.role === 'tecnico' ? user.name : order.technicianId),
    );
    line('Chegada', date(v.checkIn));
    line('Saída', date(v.checkOut));
    line(
      'Duração',
      v.checkOut
        ? Math.round((+new Date(v.checkOut) - +new Date(v.checkIn)) / 60000) + ' minutos'
        : 'Em andamento',
    );
    line('Horímetro', v.hours.toLocaleString('pt-BR'));
    line('Defeito relatado', v.defect);
    line('Diagnóstico', v.diagnosis);
    line('Serviços executados', v.services);
    line('Verificações mecânicas', v.mechanical);
    line('Equipamento funcionando', v.operational ? 'Sim' : 'Não');
    line('Mau uso', v.misuse ? 'Sim · ' + v.misuseNotes : 'Não · ' + v.misuseNotes);
    line('Retorno necessário', v.returnNeeded ? 'Sim' : 'Não');
    line('Recomendações / observações', v.notes);
    title('Peças efetivamente instaladas nesta visita');
    const installed = order.parts.filter(
      (p) => p.status === 'Instalada' && p.installedVisitId === v.id,
    );
    if (!installed.length) line('Instalações', 'Nenhuma');
    installed.forEach((p) => line(p.code, `${p.quantity} × ${p.description}`));
    for (const p of v.photos) {
      if (y > 180) page();
      title(p.category);
      try {
        const props = pdf.getImageProperties(p.data);
        const h = Math.min(90, (150 * props.height) / props.width);
        pdf.addImage(p.data, 'JPEG', 18, y, Math.min(150, (h * props.width) / props.height), h);
        y += h + 5;
        line('Legenda', p.caption);
      } catch {
        line('Foto', 'Não foi possível incorporar a imagem.');
      }
    }
    title('Ciência do responsável');
    line('Nome / cargo', v.signer + ' / ' + v.signerRole);
    line('Data', date(v.signedAt || v.checkOut));
    if (v.signatureMode === 'Assinada' && v.signature) {
      if (y > 240) page();
      pdf.addImage(v.signature, 'PNG', 18, y, 100, 30);
      y += 35;
    } else line(v.signatureMode, v.signatureReason);
  }
  title('Solicitações e materiais');
  for (const p of order.parts)
    line(
      `${p.code} · ${p.status}`,
      `${p.quantity} × ${p.description}${user.role !== 'tecnico' ? ' · ' + money(p.quantity * (p.unitCents || 0)) : ''}`,
    );
  if (user.role !== 'tecnico') {
    title('Valores registrados');
    const parts = order.parts.reduce((a, p) => a + p.quantity * (p.unitCents || 0), 0);
    line('Peças (inclui solicitações; não significa aplicação)', money(parts));
    line('Mão de obra', money(order.laborCents));
    line('Deslocamento', money(order.travelCents));
    line('Adicionais', money(order.extraCents));
    line(
      'Total registrado',
      money(parts + (order.laborCents || 0) + (order.travelCents || 0) + (order.extraCents || 0)),
    );
  }
  if (order.referenceNote) line('Referência', order.referenceNote);
  line('Emitido por', user.name + ' · ' + date(new Date().toISOString()));
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(
      `SL Campo | OS ${order.id} | ${i} / ${pdf.getNumberOfPages()} | Uso restrito`,
      18,
      290,
    );
  }
  pdf.save(`SL-Campo-${kind === 'OS' ? 'OS' : 'Relatorio'}-${order.id}.pdf`);
}
