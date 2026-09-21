// Logo NS Consulting per i PDF generati con jsPDF (PNG trasparente 800x319, in /public)
const LOGO_URL = '/logo-nsconsulting.png';
export const LOGO_RATIO = 800 / 319;

let cache = null;

// Restituisce il logo come data URL, oppure null se non è raggiungibile
export async function caricaLogoPdf() {
  if (!cache) {
    cache = fetch(LOGO_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Logo non trovato (${r.status})`);
        return r.blob();
      })
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      );
  }
  try {
    return await cache;
  } catch {
    cache = null;
    return null;
  }
}
