import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

function ListaAziende({ aziende, onSelectAzienda, onAddAzienda, onDeleteAzienda, onImportAziende, onArchiviaAzienda, onRipristinaAzienda, ricerca = '', onRicerca = null, isMobile = false }) {
  const [mostraAnteprima, setMostraAnteprima] = useState(false);
  const [aziendeImport, setAziendeImport] = useState([]);
  const [importing, setImporting] = useState(false);
  const [mostraArchivio, setMostraArchivio] = useState(false);
  const fileInputRef = useRef(null);

  const attive = aziende.filter(az => !az.archiviata);
  const archiviate = aziende.filter(az => az.archiviata);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const righe = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (righe.length === 0) { toast.error('Il file è vuoto o non ha dati leggibili'); return; }
        const mappa = (riga, ...chiavi) => {
          for (const chiave of chiavi) {
            const trovata = Object.keys(riga).find(k => k.toLowerCase().replace(/[\s_]/g, '') === chiave.toLowerCase().replace(/[\s_]/g, ''));
            if (trovata && riga[trovata] !== '') return String(riga[trovata]).trim();
          }
          return '';
        };
        // Converte data IT (GG/MM/AAAA) o Excel serial in formato YYYY-MM-DD
        const parseData = (val) => {
          if (!val) return '';
          if (typeof val === 'number') {
            // Excel serial date
            const d = new Date(Math.round((val - 25569) * 86400 * 1000));
            return d.toISOString().split('T')[0];
          }
          const str = String(val).trim();
          const itMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (itMatch) return `${itMatch[3]}-${itMatch[2].padStart(2,'0')}-${itMatch[1].padStart(2,'0')}`;
          const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}$/);
          if (isoMatch) return str;
          return '';
        };

        const parsed = righe.map((riga) => ({
          nome: mappa(riga, 'nome', 'ragionesociale', 'azienda', 'name', 'società'),
          indirizzo: mappa(riga, 'indirizzo', 'address', 'sede', 'via'),
          telefono: mappa(riga, 'telefono', 'tel', 'phone', 'cellulare'),
          email: mappa(riga, 'email', 'mail', 'emailaziendale'),
          partitaIva: mappa(riga, 'partitaiva', 'piva', 'p.iva', 'vat'),
          contatto: mappa(riga, 'contatto', 'referente', 'responsabile', 'contact'),
          pec: mappa(riga, 'pec', 'emailpec'),
          codiceUnivoco: mappa(riga, 'codiceunivoco', 'codice univoco', 'codicesdì', 'sdi', 'codicesdi'),
          note: mappa(riga, 'note', 'notes', 'annotazioni'),
          scadenzaDvr: parseData(mappa(riga, 'scadenzadvr', 'dvr', 'scadenzadvr', 'datadvr', 'data dvr', 'scadenza dvr')),
          scadenzaHaccp: parseData(mappa(riga, 'scadenzahaccp', 'haccp', 'scadenzahaccp', 'datahaccp', 'data haccp', 'scadenza haccp')),
        })).filter(az => az.nome);
        if (parsed.length === 0) { toast.error('Nessuna azienda trovata. Assicurati che ci sia una colonna "Nome"'); return; }
        setAziendeImport(parsed);
        setMostraAnteprima(true);
      } catch (err) { toast.error('Errore nella lettura del file Excel'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const esportaExcel = () => {
    const oggi = new Date();
    const fmt = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return isNaN(dt) ? d : dt.toLocaleDateString('it-IT');
    };
    const statoScadenza = (dataStr) => {
      if (!dataStr) return '';
      const diff = Math.ceil((new Date(dataStr) - oggi) / 86400000);
      if (diff < 0) return 'SCADUTO';
      if (diff <= 7) return 'URGENTE';
      if (diff <= 30) return 'IN SCADENZA';
      return 'OK';
    };

    const wb = XLSX.utils.book_new();

    // Foglio 1: Aziende
    const righeAziende = [
      ['Ragione Sociale', 'Contatto', 'Telefono', 'Email', 'P.IVA', 'PEC', 'Codice Univoco', 'Indirizzo', 'N. Controlli', 'N. Documenti', 'N. Dipendenti']
    ];
    attive.forEach(az => {
      righeAziende.push([
        az.nome || '',
        az.contatto || '',
        az.telefono || '',
        az.email || '',
        az.partitaIva || '',
        az.pec || '',
        az.codiceUnivoco || '',
        az.indirizzo || '',
        (az.controlli || []).length,
        (az.documenti || []).length,
        (az.dipendenti || []).length,
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righeAziende), 'Aziende');

    // Foglio 2: Controlli e scadenze
    const righeControlli = [
      ['Azienda', 'Tipo Controllo', 'Data Scadenza', 'Stato', 'Completato']
    ];
    attive.forEach(az => {
      (az.controlli || []).forEach(c => {
        righeControlli.push([
          az.nome || '',
          c.tipo || c.descrizione || '',
          fmt(c.scadenza),
          c.completato ? '' : statoScadenza(c.scadenza),
          c.completato ? 'Sì' : 'No',
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righeControlli), 'Controlli');

    // Foglio 3: Documenti
    const righeDocumenti = [
      ['Azienda', 'Nome Documento', 'Tipo', 'Data Emissione', 'Data Scadenza', 'Stato']
    ];
    attive.forEach(az => {
      (az.documenti || []).forEach(d => {
        righeDocumenti.push([
          az.nome || '',
          d.nome || '',
          d.tipo || '',
          fmt(d.dataEmissione),
          fmt(d.dataScadenza),
          statoScadenza(d.dataScadenza),
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righeDocumenti), 'Documenti');

    // Foglio 4: Attestati dipendenti
    const righeAttestati = [
      ['Azienda', 'Dipendente', 'Attestato', 'Data Scadenza', 'Stato']
    ];
    attive.forEach(az => {
      (az.dipendenti || []).forEach(dip => {
        (dip.attestati || []).forEach(att => {
          righeAttestati.push([
            az.nome || '',
            `${dip.nome || ''} ${dip.cognome || ''}`.trim(),
            att.nome || '',
            fmt(att.dataScadenza),
            statoScadenza(att.dataScadenza),
          ]);
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righeAttestati), 'Attestati Dipendenti');

    const dataOggi = oggi.toLocaleDateString('it-IT').replace(/\//g, '-');
    XLSX.writeFile(wb, `elenco_aziende_${dataOggi}.xlsx`);
    toast.success('Export completato!');
  };

  const scaricaModello = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'Indirizzo', 'Telefono', 'Email', 'Partita IVA', 'Amministratore', 'PEC', 'Codice Univoco', 'Note', 'Scadenza DVR', 'Scadenza HACCP'],
      ['Esempio Srl', 'Via Roma 1, Milano', '02 1234567', 'info@esempio.it', '12345678901', 'Mario Rossi', 'esempio@pec.it', 'ABC1234', '', '31/12/2025', '30/06/2025'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aziende');
    XLSX.writeFile(wb, 'modello_aziende.xlsx');
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      await onImportAziende(aziendeImport);
      toast.success(`${aziendeImport.length} aziende importate con successo!`);
      setMostraAnteprima(false);
      setAziendeImport([]);
    } catch (err) {
      toast.error("Errore durante l'importazione");
    } finally {
      setImporting(false);
    }
  };

  const CardAzienda = ({ az, archiviata }) => {
    let hasScaduti = false, hasUrgenti = false;
    (az.controlli || []).forEach(c => {
      if (c.completato) return;
      const diff = Math.ceil((new Date(c.scadenza) - new Date()) / 86400000);
      if (diff < 0) hasScaduti = true;
      else if (diff <= 7) hasUrgenti = true;
    });
    const borderColor = archiviata ? '#dfe5ef' : hasScaduti ? '#fca5a5' : hasUrgenti ? '#fcd34d' : '#dfe5ef';

    return (
      <div
        style={{
          background: archiviata ? '#f6f8fc' : 'white',
          padding: '18px', borderRadius: '12px',
          border: `2px solid ${borderColor}`,
          opacity: archiviata ? 0.7 : 1,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}
        onMouseEnter={e => !archiviata && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        <div style={{ flex: 1, cursor: archiviata ? 'default' : 'pointer', minWidth: 0 }} onClick={() => !archiviata && onSelectAzienda(az)}>
          <h3 style={{ marginBottom: 5, wordBreak: 'break-word' }}>{az.nome}</h3>
          <p style={{ fontSize: 14, color: '#5f6f8c', marginBottom: 8 }}>{az.contatto} • {az.indirizzo}</p>
          {az.assegnatoNome && (
            <p style={{ fontSize: 12, color: '#2c3e66', fontWeight: 600, marginBottom: 6 }}>👤 {az.assegnatoNome}</p>
          )}
          <div style={{ fontSize: 13, color: '#9aa7bf', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{(az.controlli || []).length} controlli</span>
            {!archiviata && hasScaduti && <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 'bold' }}>SCADUTO</span>}
            {!archiviata && !hasScaduti && hasUrgenti && <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 'bold' }}>URGENTE</span>}
            {archiviata && <span style={{ background: '#eef1f7', color: '#9aa7bf', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 'bold' }}>ARCHIVIATA</span>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {archiviata ? (
            <>
              <button
                onClick={e => { e.stopPropagation(); onRipristinaAzienda(az.id); }}
                style={{ background: '#d1fae5', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#059669', fontWeight: 'bold' }}
              >
                ♻️ Ripristina
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDeleteAzienda(az.id); }}
                style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 'bold' }}
              >
                🗑️ Elimina
              </button>
            </>
          ) : (
            <>
              <button
                onClick={e => { e.stopPropagation(); onArchiviaAzienda(az.id); }}
                style={{ background: '#fef3c7', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#92400e', fontWeight: 'bold' }}
              >
                📦 Archivia
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDeleteAzienda(az.id); }}
                style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 'bold' }}
              >
                🗑️ Elimina
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Aziende Clienti ({attive.length})</h2>
          {isMobile && onRicerca && (
            <input
              type="text"
              placeholder="Cerca azienda..."
              value={ricerca}
              onChange={e => onRicerca(e.target.value)}
              style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, width: 160 }}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ display: 'none' }} />
          <button
            onClick={scaricaModello}
            style={{ background: 'white', color: '#5f6f8c', border: '1px solid #dfe5ef', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            Modello Excel
          </button>
          <button
            onClick={() => fileInputRef.current.click()}
            style={{ background: 'white', color: '#2c3e66', border: '2px solid #2c3e66', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
          >
            📥 Importa Excel
          </button>
          <button
            onClick={esportaExcel}
            style={{ background: 'white', color: '#059669', border: '2px solid #059669', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
          >
            📤 Esporta Excel
          </button>
          <button
            onClick={onAddAzienda}
            style={{ background: '#2c3e66', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
          >
            + Aggiungi Azienda
          </button>
        </div>
      </div>

      {/* Aziende attive */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {attive.map(az => <CardAzienda key={az.id} az={az} archiviata={false} />)}
        {attive.length === 0 && (
          <p style={{ color: '#9aa7bf', fontSize: 14 }}>Nessuna azienda attiva</p>
        )}
      </div>

      {/* Sezione archivio */}
      {archiviate.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <button
            onClick={() => setMostraArchivio(a => !a)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#5f6f8c', padding: 0, marginBottom: 12 }}
          >
            <span style={{ fontSize: 18, transition: 'transform 0.2s', display: 'inline-block', transform: mostraArchivio ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
            📦 Archivio ({archiviate.length})
          </button>
          {mostraArchivio && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {archiviate.map(az => <CardAzienda key={az.id} az={az} archiviata={true} />)}
            </div>
          )}
        </div>
      )}

      {/* Modale anteprima importazione */}
      {mostraAnteprima && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '95%', maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: '0 0 8px' }}>📥 Anteprima importazione</h2>
            <p style={{ color: '#5f6f8c', fontSize: 14, margin: '0 0 16px' }}>{aziendeImport.length} aziende trovate. Verifica i dati prima di confermare.</p>
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #dfe5ef', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f6f8fc', position: 'sticky', top: 0 }}>
                    {['Nome', 'Indirizzo', 'Telefono', 'Email', 'P.IVA', 'Amministratore', 'Scad. DVR', 'Scad. HACCP'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#45536f', fontWeight: 600, borderBottom: '2px solid #dfe5ef', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aziendeImport.map((az, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eef1f7' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{az.nome}</td>
                      <td style={{ padding: '8px 12px', color: '#5f6f8c' }}>{az.indirizzo || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#5f6f8c' }}>{az.telefono || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#5f6f8c' }}>{az.email || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#5f6f8c' }}>{az.partitaIva || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#5f6f8c' }}>{az.contatto || '—'}</td>
                      <td style={{ padding: '8px 12px', color: az.scadenzaDvr ? '#059669' : '#9aa7bf' }}>{az.scadenzaDvr ? new Date(az.scadenzaDvr + 'T00:00:00').toLocaleDateString('it-IT') : '—'}</td>
                      <td style={{ padding: '8px 12px', color: az.scadenzaHaccp ? '#059669' : '#9aa7bf' }}>{az.scadenzaHaccp ? new Date(az.scadenzaHaccp + 'T00:00:00').toLocaleDateString('it-IT') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => { setMostraAnteprima(false); setAziendeImport([]); }} disabled={importing} style={{ padding: '10px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14 }}>Annulla</button>
              <button onClick={handleConfirmImport} disabled={importing} style={{ padding: '10px 24px', border: 'none', borderRadius: 8, background: importing ? '#9aa7bf' : '#2c3e66', color: 'white', cursor: importing ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 'bold' }}>
                {importing ? 'Importazione...' : `Importa ${aziendeImport.length} aziende`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListaAziende;
