import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Vuoto } from './ui';
import { S, btn, fmtEuro, fmtData, esportaExcel } from './util';
import { STATI_DOC, estraiDaIncassare } from './registro';

// Vista calcolata dal registro di fatturazione: tutto ciò che non è ancora stato segnato come pagato.
function TabInsoluti({ registro, caricando, salva }) {
  const [soloProforma, setSoloProforma] = useState(false);
  const [ricerca, setRicerca] = useState('');

  const gruppi = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    const perAzienda = new Map();
    estraiDaIncassare(registro, soloProforma)
      .filter((d) => !q || d.azienda.toLowerCase().includes(q) || d.numero.toLowerCase().includes(q))
      .forEach((d) => {
        if (!perAzienda.has(d.azienda)) perAzienda.set(d.azienda, []);
        perAzienda.get(d.azienda).push(d);
      });
    return [...perAzienda.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'it'))
      .map(([azienda, docs]) => ({ azienda, docs, totale: docs.reduce((s, d) => s + (Number(d.importo) || 0), 0) }));
  }, [registro, soloProforma, ricerca]);

  const totaleGenerale = gruppi.reduce((s, g) => s + g.totale, 0);
  const nDocumenti = gruppi.reduce((s, g) => s + g.docs.length, 0);
  const senzaImporto = gruppi.reduce((s, g) => s + g.docs.filter((d) => d.importo == null).length, 0);

  const segnaPagata = async (d) => {
    try {
      await salva({ [`mesi.${d.mese}.stato`]: 'pagata' }, d.rigaId);
      toast.success(`Fattura ${d.numero || ''} segnata come pagata`);
    } catch (e) {
      console.error(e);
      toast.error('Errore nel salvataggio');
    }
  };

  const handleEsporta = () => {
    const righe = gruppi.flatMap((g) => g.docs.map((d) => ({
      Azienda: d.azienda, Data: fmtData(d.data), Fattura: `${d.numero}${d.stato === 'proforma' ? ' PROFORMA' : ''}`.trim(),
      Importo: d.importo ?? '', Causale: d.causale,
    })));
    esportaExcel('insoluti', righe, 'Insoluti');
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input style={{ ...S.input, width: 220 }} placeholder="🔍 Cerca azienda o n° fattura…" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
        <button onClick={() => setSoloProforma((v) => !v)} style={btn(soloProforma ? 'primario' : 'ghost')}>
          Solo proforma
        </button>
        <button onClick={handleEsporta} disabled={!nDocumenti} style={btn('ghost')}>⬇️ Excel</button>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#45536f', textAlign: 'right' }}>
          {gruppi.length} aziende · {nDocumenti} documenti · Totale da incassare: <strong style={{ color: '#dc2626', fontSize: 15 }}>{fmtEuro(totaleGenerale)}</strong>
        </div>
      </div>

      {senzaImporto > 0 && (
        <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
          ⚠️ {senzaImporto} document{senzaImporto === 1 ? 'o' : 'i'} senza importo: non {senzaImporto === 1 ? 'è' : 'sono'} conteggiat{senzaImporto === 1 ? 'o' : 'i'} nei totali.
          Aggiungi l'importo dal registro di fatturazione.
        </div>
      )}

      {caricando ? <div style={S.card}><Vuoto>Caricamento…</Vuoto></div> : !gruppi.length ? (
        <div style={S.card}><Vuoto>🎉 Nessun insoluto{ricerca || soloProforma ? ' con questi filtri' : ''}.</Vuoto></div>
      ) : gruppi.map((g) => (
        <div key={g.azienda} style={{ ...S.card, marginBottom: 12, overflowX: 'auto' }}>
          <div style={{ padding: '10px 14px', background: '#f6f8fc', borderBottom: '1px solid #dfe5ef', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ color: '#1a2540' }}>{g.azienda}</strong>
            <strong style={{ color: '#dc2626' }}>{g.totale > 0 ? fmtEuro(g.totale) : '—'}</strong>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: 110 }} /><col style={{ width: 200 }} /><col style={{ width: 120 }} /><col /><col style={{ width: 150 }} /></colgroup>
            <thead>
              <tr>
                <th style={S.th}>Data</th>
                <th style={S.th}>Fattura</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Importo</th>
                <th style={S.th}>Causale</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {g.docs.map((d) => {
                const st = STATI_DOC[d.stato] || STATI_DOC.emessa;
                return (
                  <tr key={`${d.rigaId}-${d.mese}`}>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{fmtData(d.data) || '—'}</td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      {d.numero}{' '}
                      <span style={{ padding: '1px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{d.importo != null ? fmtEuro(d.importo) : '—'}</td>
                    <td style={S.td}>{d.causale}</td>
                    <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => segnaPagata(d)} style={btn('ok', { padding: '4px 10px', fontSize: 12 })}>✓ Segna pagata</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default TabInsoluti;
