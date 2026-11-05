import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseInternalCall } from './internal-call-parser';

GlobalWorkerOptions.workerSrc = workerUrl;

function dataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível anexar o PDF.'));
    reader.readAsDataURL(file);
  });
}

export async function importInternalPdf(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf')
    throw new Error('Selecione o PDF do chamado interno.');
  if (file.size > 12 * 1024 * 1024) throw new Error('O PDF deve ter no máximo 12 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({ data: bytes });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > 20) throw new Error('O PDF deve ter no máximo 20 páginas.');
    const lines: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      for (const item of content.items)
        if ('str' in item && item.str.trim()) lines.push(item.str.trim());
    }
    return {
      fields: parseInternalCall(lines),
      sourcePdf: {
        name: file.name.slice(0, 200),
        data: await dataUrl(file),
        uploadedAt: new Date().toISOString(),
      },
    };
  } finally {
    await task.destroy();
  }
}
