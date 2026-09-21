import { zipSync } from 'fflate';

const safeName = (name) => String(name || 'documento')
  // Control characters are invalid in downloaded filenames.
  // eslint-disable-next-line no-control-regex
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  .replace(/[. ]+$/g, '').slice(0, 150) || 'documento';

export async function downloadDocumenti(documenti, nomeAzienda, onProgress) {
  const files = Object.create(null);
  for (const [index, documento] of documenti.entries()) {
    onProgress?.(index + 1, documenti.length);
    let response;
    try {
      response = await fetch(documento.pdfUrl, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = new Uint8Array(await response.arrayBuffer());
      let path = documento.pdfPath;
      if (!path) {
        path = decodeURIComponent(new URL(documento.pdfUrl).pathname);
      }
      const extension = path.match(/\.([a-z0-9]{1,10})$/i)?.[1]
        || ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[response.headers.get('content-type')?.split(';')[0]]);
      let name = safeName(documento.nome);
      if (extension && !name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) name += `.${extension}`;
      // A numbered prefix preserves documents with identical names.
      files[`${String(index + 1).padStart(3, '0')}_${name}`] = data;
    } catch {
      throw new Error(`Impossibile scaricare "${documento.nome || 'documento'}". Riprova. Nessun archivio creato.`);
    }
  }
  const blob = new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Documenti_${safeName(nomeAzienda)}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
