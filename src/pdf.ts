import { jsPDF } from 'jspdf';
import type { Order, User, Visit } from './types';
export const money = (c = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
export const date = (s?: string) =>
  s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
export function report(order: Order, user: User, kind: 'OS' | 'Relatório técnico', visit?: Visit) {
  const pdf = new jsPDF();
  let y = 46;
  const width = 174;
  const polygon = (points: [number, number][], color: [number, number, number]) => {
    pdf.setFillColor(...color);
    pdf.lines(
      points.slice(1).map(([x, y], index) => [x - points[index][0], y - points[index][1]]),
      points[0][0],
      points[0][1],
      [1, 1],
      'F',
      true,
    );
  };
  const logo = () => {
    polygon(
      [
        [9, 11],
        [19, 17],
        [29, 23],
        [19, 29],
        [9, 23],
      ],
      [255, 190, 0],
    );
    polygon(
      [
        [19, 4],
        [29, 10],
        [29, 20],
        [19, 14],
        [9, 9],
      ],
      [24, 57, 195],
    );
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(1.1);
    pdf.line(13, 9.5, 25, 16.5);
    pdf.line(13, 14, 20.5, 18.5);
    pdf.setTextColor(0, 27, 128);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('SOUZA LIMA', 34, 17);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('SL CAMPO · MANUTENÇÃO', 34, 25);
  };
  const header = () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 210, 39, 'F');
    logo();
    pdf.setTextColor(0, 27, 128);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(kind.toUpperCase(), 195, 14, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`ORDEM ${order.id}`, 195, 22, { align: 'right' });
    pdf.setFillColor(0, 27, 128);
    pdf.rect(0, 33, 210, 4, 'F');
    pdf.setFillColor(255, 190, 0);
    pdf.rect(0, 37, 210, 2, 'F');
    pdf.setTextColor(30);
    y = 47;
  };
  const page = () => {
    pdf.addPage();
    header();
  };
  const line = (label: string, value: unknown) => {
    pdf.setFont('helvetica', 'normal');
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
  const assignedTechnician = Object.hasOwn(order, 'technicianName')
    ? order.technicianName?.trim() || 'A definir'
    : user.role === 'tecnico'
      ? user.name
      : order.technicianId;
  header();
  line('Ordem de serviço', order.id + ' · ' + order.status);
  line('Cliente / unidade', order.client + ' / ' + order.unit);
  line('Endereço', order.address);
  line('Equipamento', `${order.equipment} | ${order.brand} ${order.model}`);
  line('Série / patrimônio', `${order.serial} / ${order.asset}`);
  line('Manutenção', order.type);
  line('OS fornecedor (referência)', order.supplierOrder || 'Não se aplica');
  for (const v of visit ? [visit] : order.visits) {
    title('Visita técnica');
    line('Técnico responsável', v.technicianName || assignedTechnician);
    line('Chegada', date(v.checkIn));
    line('Saída', date(v.checkOut));
    line(
      'Duração',
      v.checkOut
        ? Math.round((+new Date(v.checkOut) - +new Date(v.checkIn)) / 60000) + ' minutos'
        : 'Em andamento',
    );
    line('Horímetro', v.hours.toLocaleString('pt-BR'));
    line('Defeito relatado', v.defect || order.reportedDefect || 'Conforme chamado interno');
    line('Diagnóstico', v.diagnosis);
    line('Serviços executados', v.services);
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
    if (v.photos.length) title('Fotografias do atendimento');
    for (const [index, p] of v.photos.entries()) {
      if (y > 180) page();
      line('Fotografia', index + 1);
      try {
        const props = pdf.getImageProperties(p.data);
        const h = Math.min(90, (150 * props.height) / props.width);
        pdf.addImage(p.data, 'JPEG', 18, y, Math.min(150, (h * props.width) / props.height), h);
        y += h + 5;
        if (p.caption.trim()) line('Legenda', p.caption);
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
