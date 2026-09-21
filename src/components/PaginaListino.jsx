import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

const SERVIZI_PREDEFINITI = [
  // Documentazione
  'DVR (documentazione di valutazione dei rischi)',
  // Ruoli e responsabilità
  'Att. RSPP (responsabile prevenzione e protezione)',
  'Att. RLS (rappresentante dei lavoratori)',
  'Att. PREPOSTO (preposto per la sicurezza)',
  // Emergenze
  'Att. ANTINCENDIO (prevenzione incendio)',
  'Att. PRIMO SOCCORSO (addetto I soccorso)',
  // Formazione
  'Att. FORMAZIONE&INFORMAZIONE',
  'Att. FORMAZIONE COVID-19',
  // Medico
  'NOMINA MEDICO COMPETENTE',
  'VISITE MEDICHE (sorveglianza medico sanitaria)',
  // Alimentare
  'HACCP (manuale di autocontrollo)',
  'Att. ALIMENTARISTA lv 1',
  'Att. ALIMENTARISTA lv 2',
  'Att. ALIMENTARISTA lv 3',
  // Materiali
  'FORNITURA MATERIALE ANTINCENDIO',
];

const DEFAULT_CHECKLIST = ['SCIA', 'Impianto elettrico', 'Impianto antincendio', 'Cassetta medica', 'Impianto gas'];

function PaginaListino() {
  const [servizi, setServizi] = useState([]); // [{ id, descrizione, prezzo }]
  const [checklistVoci, setChecklistVoci] = useState([]); // [{ id, label }]
  const [salvando, setSalvando] = useState(false);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    const carica = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'listino'));
        const data = snap.exists() ? snap.data() : {};
        const prezziSalvati = data.prezzi || {};

        if (data.tuttiIServizi?.length > 0) {
          // Usa l'ordine salvato su Firestore
          setServizi(data.tuttiIServizi.map((desc, i) => ({
            id: `saved_${i}`,
            descrizione: desc,
            prezzo: prezziSalvati[desc] ?? '',
          })));
        } else {
          // Prima volta: usa ordine predefinito + extra
          const lista = SERVIZI_PREDEFINITI.map((desc, i) => ({
            id: `pre_${i}`,
            descrizione: desc,
            prezzo: prezziSalvati[desc] ?? '',
          }));
          const extra = (data.serviziExtra || [])
            .filter(desc => !SERVIZI_PREDEFINITI.includes(desc))
            .map((desc, i) => ({
              id: `extra_${i}`,
              descrizione: desc,
              prezzo: prezziSalvati[desc] ?? '',
            }));
          setServizi([...lista, ...extra]);
        }

        const savedChecklist = data.checklistSopralluogo;
        if (savedChecklist?.length > 0) {
          setChecklistVoci(savedChecklist.map((v, i) => ({ id: `cl_${i}`, label: v })));
        } else {
          setChecklistVoci(DEFAULT_CHECKLIST.map((v, i) => ({ id: `cl_pre_${i}`, label: v })));
        }
      } catch (e) {
        console.error('Errore caricamento listino:', e);
      } finally {
        setCaricando(false);
      }
    };
    carica();
  }, []);

  const handleChange = (id, campo, valore) => {
    setServizi(prev => prev.map(s => s.id === id ? { ...s, [campo]: valore } : s));
  };

  const aggiungi = () => {
    setServizi(prev => [...prev, { id: `new_${Date.now()}`, descrizione: '', prezzo: '' }]);
  };

  const rimuovi = (id) => {
    setServizi(prev => prev.filter(s => s.id !== id));
  };

  const spostaChecklist = (idx, direzione) => {
    setChecklistVoci(prev => {
      const lista = [...prev];
      const target = idx + direzione;
      if (target < 0 || target >= lista.length) return lista;
      [lista[idx], lista[target]] = [lista[target], lista[idx]];
      return lista;
    });
  };

  const sposta = (idx, direzione) => {
    setServizi(prev => {
      const lista = [...prev];
      const target = idx + direzione;
      if (target < 0 || target >= lista.length) return lista;
      [lista[idx], lista[target]] = [lista[target], lista[idx]];
      return lista;
    });
  };

  const handleSalva = async () => {
    const validi = servizi.filter(s => s.descrizione.trim());
    const nomi = validi.map(s => s.descrizione.trim());
    if (new Set(nomi).size < nomi.length) {
      toast.error('Ci sono servizi con lo stesso nome');
      return;
    }

    setSalvando(true);
    try {
      const prezziNumerici = {};
      for (const s of validi) {
        const n = parseFloat(String(s.prezzo).replace(',', '.'));
        prezziNumerici[s.descrizione.trim()] = isNaN(n) ? 0 : n;
      }
      const predefiniti = new Set(SERVIZI_PREDEFINITI);
      const serviziExtraDesc = nomi.filter(n => !predefiniti.has(n));

      const checklistLabels = checklistVoci.filter(v => v.label.trim()).map(v => v.label.trim());
      await setDoc(doc(db, 'config', 'listino'), {
        prezzi: prezziNumerici,
        serviziExtra: serviziExtraDesc,
        tuttiIServizi: nomi,
        checklistSopralluogo: checklistLabels,
      });

      setServizi(validi.map(s => ({ ...s, descrizione: s.descrizione.trim() })));
      toast.success('Listino salvato');
    } catch (e) {
      console.error(e);
      toast.error('Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  };

  if (caricando) return <div style={{ padding: 40, textAlign: 'center', color: '#9aa7bf' }}>Caricamento listino...</div>;

  const colStyle = { display: 'grid', gridTemplateColumns: '1fr 160px', alignItems: 'center', padding: '14px 20px' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a2540' }}>💰 Listino Prezzi</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5f6f8c' }}>
            I prezzi impostati qui vengono pre-compilati automaticamente nei nuovi preventivi
          </p>
        </div>
        <button
          onClick={handleSalva}
          disabled={salvando}
          style={{
            padding: '10px 24px', border: 'none', borderRadius: 8,
            background: salvando ? '#93a7cc' : '#2c3e66',
            color: 'white', cursor: salvando ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 700,
          }}
        >
          {salvando ? 'Salvataggio...' : '💾 Salva listino'}
        </button>
      </div>

      {/* Lista unica servizi */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #dfe5ef', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '52px 1fr 160px 36px',
          padding: '12px 20px', background: '#f6f8fc',
          borderBottom: '2px solid #dfe5ef',
          fontSize: 12, fontWeight: 700, color: '#5f6f8c', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span />
          <span>Servizio</span>
          <span style={{ textAlign: 'right' }}>Prezzo unitario (€)</span>
          <span />
        </div>

        {servizi.map((s, idx) => {
          const haPrezzo = s.prezzo !== '' && s.prezzo !== 0;
          return (
            <div
              key={s.id}
              style={{
                display: 'grid', gridTemplateColumns: '52px 1fr 160px 36px',
                alignItems: 'center', padding: '8px 20px',
                borderBottom: idx < servizi.length - 1 ? '1px solid #eef1f7' : 'none',
              }}
            >
              {/* Frecce ↑ ↓ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                <button
                  onClick={() => sposta(idx, -1)}
                  disabled={idx === 0}
                  style={{ border: 'none', background: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#dfe5ef' : '#9aa7bf', fontSize: 12, lineHeight: 1, padding: '2px 4px' }}
                  title="Sposta su"
                >▲</button>
                <button
                  onClick={() => sposta(idx, 1)}
                  disabled={idx === servizi.length - 1}
                  style={{ border: 'none', background: 'none', cursor: idx === servizi.length - 1 ? 'default' : 'pointer', color: idx === servizi.length - 1 ? '#dfe5ef' : '#9aa7bf', fontSize: 12, lineHeight: 1, padding: '2px 4px' }}
                  title="Sposta giù"
                >▼</button>
              </div>

              <input
                type="text"
                value={s.descrizione}
                onChange={e => handleChange(s.id, 'descrizione', e.target.value)}
                placeholder="Nome servizio..."
                style={{
                  padding: '7px 10px', border: '1px solid #dfe5ef', borderRadius: 6,
                  fontSize: 14, outline: 'none', marginRight: 12, color: '#1a2540',
                  background: 'white',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 13, color: '#5f6f8c' }}>€</span>
                <input
                  type="number" min="0" step="0.01" value={s.prezzo}
                  onChange={e => handleChange(s.id, 'prezzo', e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: 110, padding: '7px 10px', textAlign: 'right',
                    border: `1px solid ${haPrezzo ? '#93a7cc' : '#dfe5ef'}`,
                    borderRadius: 6, fontSize: 14, outline: 'none',
                    background: haPrezzo ? '#eef1f8' : 'white', color: '#1a2540',
                  }}
                />
              </div>
              <button
                onClick={() => rimuovi(s.id)}
                style={{
                  marginLeft: 8, width: 28, height: 28, border: 'none', borderRadius: 6,
                  background: '#fee2e2', color: '#dc2626', cursor: 'pointer',
                  fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="Rimuovi"
              >✕</button>
            </div>
          );
        })}

        <div style={{ padding: '12px 20px', borderTop: '1px solid #eef1f7' }}>
          <button
            onClick={aggiungi}
            style={{
              padding: '8px 16px', border: '1px dashed #2c3e66', borderRadius: 8,
              background: 'transparent', color: '#2c3e66', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            + Aggiungi servizio
          </button>
        </div>
      </div>

      <p style={{ marginTop: 4, fontSize: 12, color: '#9aa7bf' }}>
        I servizi con prezzo 0 o vuoto verranno lasciati in bianco nel preventivo per la compilazione manuale.
      </p>

      {/* Checklist Sopralluogo */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #86efac', overflow: 'hidden', marginTop: 28 }}>
        <div style={{ padding: '14px 20px', background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#166534' }}>🔍 Voci Checklist Sopralluogo</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#4ade80' ? '#166534' : '#5f6f8c', opacity: 0.75 }}>
            Queste voci appaiono come checklist da spuntare nel preventivo durante il sopralluogo
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '52px 1fr 36px',
          padding: '10px 20px', background: '#f6f8fc',
          borderBottom: '2px solid #dfe5ef',
          fontSize: 12, fontWeight: 700, color: '#5f6f8c', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span />
          <span>Voce</span>
          <span />
        </div>

        {checklistVoci.map((voce, idx) => (
          <div key={voce.id} style={{
            display: 'grid', gridTemplateColumns: '52px 1fr 36px',
            alignItems: 'center', padding: '8px 20px',
            borderBottom: idx < checklistVoci.length - 1 ? '1px solid #eef1f7' : 'none',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <button onClick={() => spostaChecklist(idx, -1)} disabled={idx === 0}
                style={{ border: 'none', background: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#dfe5ef' : '#9aa7bf', fontSize: 12, lineHeight: 1, padding: '2px 4px' }}>▲</button>
              <button onClick={() => spostaChecklist(idx, 1)} disabled={idx === checklistVoci.length - 1}
                style={{ border: 'none', background: 'none', cursor: idx === checklistVoci.length - 1 ? 'default' : 'pointer', color: idx === checklistVoci.length - 1 ? '#dfe5ef' : '#9aa7bf', fontSize: 12, lineHeight: 1, padding: '2px 4px' }}>▼</button>
            </div>
            <input
              type="text"
              value={voce.label}
              onChange={e => setChecklistVoci(prev => prev.map(v => v.id === voce.id ? { ...v, label: e.target.value } : v))}
              placeholder="Nome controllo..."
              style={{ padding: '7px 10px', border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14, outline: 'none', color: '#1a2540', background: 'white' }}
            />
            <button onClick={() => setChecklistVoci(prev => prev.filter(v => v.id !== voce.id))}
              style={{ marginLeft: 8, width: 28, height: 28, border: 'none', borderRadius: 6, background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        ))}

        <div style={{ padding: '12px 20px', borderTop: '1px solid #eef1f7' }}>
          <button
            onClick={() => setChecklistVoci(prev => [...prev, { id: `cl_${Date.now()}`, label: '' }])}
            style={{ padding: '8px 16px', border: '1px dashed #16a34a', borderRadius: 8, background: 'transparent', color: '#16a34a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            + Aggiungi voce
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaginaListino;
