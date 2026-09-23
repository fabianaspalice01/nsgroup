import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

async function cercaComuni(q) {
  if (q.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)},Italia&countrycodes=it&addressdetails=1&limit=7`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'it' } });
  const data = await res.json();
  return data.filter(r => r.address && (r.address.city || r.address.town || r.address.village || r.address.municipality));
}

function ModaleAzienda({ onClose, onSave, azienda, saving = false, aziende = [], referenti = [] }) {
  const [form, setForm] = useState(azienda || {
    nome: '',
    contatto: '',
    indirizzo: '',
    comune: '',
    provincia: '',
    cap: '',
    telefono: '',
    email: '',
    pec: '',
    partitaIva: '',
    codiceUnivoco: '',
    note: '',
    assegnatoA: '',
    assegnatoNome: '',
    emailAccesso: '',
    passwordAccesso: ''
  });

  const [suggerimenti, setSuggerimenti] = useState([]);
  const [cercando, setCercando] = useState(false);
  const [confirmRiassegna, setConfirmRiassegna] = useState(null); // { nuovoId, nuovoNome }
  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const chiudi = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setSuggerimenti([]);
    };
    document.addEventListener('mousedown', chiudi);
    return () => document.removeEventListener('mousedown', chiudi);
  }, []);

  const handleChange = (campo, valore) => {
    setForm(prev => ({ ...prev, [campo]: valore }));
  };

  const handleReferente = (userId) => {
    const ref = referenti.find(r => r.id === userId);
    const nuovoNome = ref ? ref.nome : '';
    // se l'azienda è già assegnata a qualcun altro, chiedi conferma
    if (azienda && form.assegnatoA && form.assegnatoA !== userId) {
      setConfirmRiassegna({ nuovoId: userId, nuovoNome });
      return;
    }
    setForm(prev => ({ ...prev, assegnatoA: userId, assegnatoNome: nuovoNome }));
  };

  const confermaCambioAssegnazione = () => {
    if (!confirmRiassegna) return;
    setForm(prev => ({ ...prev, assegnatoA: confirmRiassegna.nuovoId, assegnatoNome: confirmRiassegna.nuovoNome }));
    setConfirmRiassegna(null);
  };

  const handleComuneChange = (valore) => {
    handleChange('comune', valore);
    clearTimeout(debounceRef.current);
    if (valore.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        setCercando(true);
        try {
          const risultati = await cercaComuni(valore);
          setSuggerimenti(risultati);
        } catch { setSuggerimenti([]); }
        setCercando(false);
      }, 400);
    } else {
      setSuggerimenti([]);
    }
  };

  const selezionaComune = (r) => {
    const addr = r.address;
    const nome = addr.city || addr.town || addr.village || addr.municipality || '';
    const sigla = addr['ISO3166-2-lvl6']?.split('-')[1] || '';
    const cap = addr.postcode?.split(';')[0] || '';
    setForm(prev => ({ ...prev, comune: nome, provincia: sigla, cap }));
    setSuggerimenti([]);
  };

  const handleSave = () => {
    const campiObbligatori = [
      { campo: 'nome', label: "Nome azienda" },
      { campo: 'contatto', label: "Amministratore" },
      { campo: 'indirizzo', label: "Indirizzo" },
      { campo: 'comune', label: "Comune" },
      { campo: 'provincia', label: "Provincia" },
      { campo: 'cap', label: "CAP" },
      { campo: 'telefono', label: "Telefono" },
      { campo: 'pec', label: "PEC" },
      { campo: 'partitaIva', label: "Partita IVA" },
    ];

    for (const { campo, label } of campiObbligatori) {
      if (!form[campo]?.trim()) {
        toast.error(`Il campo "${label}" è obbligatorio!`);
        return;
      }
    }

    const duplicato = aziende.find(
      (a) => a.partitaIva?.trim() === form.partitaIva.trim() && a.id !== azienda?.id
    );
    if (duplicato) {
      toast.error(`Partita IVA già registrata per: ${duplicato.nome}`);
      return;
    }

    onSave(form);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h2 style={{ marginBottom: '20px' }}>
          {azienda ? 'Modifica Azienda' : 'Nuova Azienda'}
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Nome Azienda *
          </label>
          <input 
            type="text"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Amministratore *
          </label>
          <input 
            type="text"
            value={form.contatto}
            onChange={(e) => handleChange('contatto', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Indirizzo *
          </label>
          <input
            type="text"
            value={form.indirizzo}
            onChange={(e) => handleChange('indirizzo', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Comune con autocomplete */}
        <div style={{ marginBottom: '15px', position: 'relative' }} ref={dropdownRef}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Comune *
          </label>
          <input
            type="text"
            value={form.comune}
            onChange={(e) => handleComuneChange(e.target.value)}
            placeholder="Inizia a digitare..."
            autoComplete="off"
            style={{ width: '100%', padding: '8px', border: '1px solid #dfe5ef', borderRadius: '6px', fontSize: '14px' }}
          />
          {cercando && (
            <div style={{ position: 'absolute', right: 10, top: 34, fontSize: 12, color: '#9aa7bf' }}>Ricerca...</div>
          )}
          {suggerimenti.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #dfe5ef', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: 220, overflowY: 'auto' }}>
              {suggerimenti.map((r, i) => {
                const addr = r.address;
                const nome = addr.city || addr.town || addr.village || addr.municipality || '';
                const prov = addr['ISO3166-2-lvl6']?.split('-')[1] || '';
                const cap = addr.postcode?.split(';')[0] || '';
                return (
                  <div
                    key={i}
                    onMouseDown={() => selezionaComune(r)}
                    style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #eef1f7', fontSize: 13 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#eef1f8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <span style={{ fontWeight: 600 }}>{nome}</span>
                    {prov && <span style={{ color: '#2c3e66', marginLeft: 6 }}>({prov})</span>}
                    {cap && <span style={{ color: '#9aa7bf', marginLeft: 6 }}>{cap}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Provincia e CAP su una riga */}
        <div style={{ display: 'flex', gap: 12, marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
              Provincia *
            </label>
            <input
              type="text"
              value={form.provincia}
              onChange={(e) => handleChange('provincia', e.target.value.toUpperCase().slice(0, 2))}
              placeholder="Es. LE"
              maxLength={2}
              style={{ width: '100%', padding: '8px', border: '1px solid #dfe5ef', borderRadius: '6px', fontSize: '14px', textTransform: 'uppercase' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
              CAP *
            </label>
            <input
              type="text"
              value={form.cap}
              onChange={(e) => handleChange('cap', e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Es. 73100"
              maxLength={5}
              style={{ width: '100%', padding: '8px', border: '1px solid #dfe5ef', borderRadius: '6px', fontSize: '14px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Telefono *
          </label>
          <input 
            type="tel"
            value={form.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Email
          </label>
          <input 
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            PEC *
          </label>
          <input 
            type="email"
            value={form.pec}
            onChange={(e) => handleChange('pec', e.target.value)}
            placeholder="esempio@pec.it"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Partita IVA *
          </label>
          <input 
            type="text"
            value={form.partitaIva}
            onChange={(e) => handleChange('partitaIva', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Codice Univoco
          </label>
          <input 
            type="text"
            value={form.codiceUnivoco}
            onChange={(e) => handleChange('codiceUnivoco', e.target.value)}
            placeholder="7 caratteri alfanumerici"
            maxLength="7"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Note
          </label>
          <textarea
            value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            rows="3"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #dfe5ef',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Assegnato a
          </label>
          <select
            value={form.assegnatoA}
            onChange={e => handleReferente(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid #dfe5ef', borderRadius: '6px', fontSize: '14px', background: 'white' }}
          >
            <option value="">— Nessuno —</option>
            {referenti.map(r => (
              <option key={r.id} value={r.id}>{r.nome} ({r.ruolo})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #dfe5ef',
              borderRadius: '8px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              background: saving ? '#93a7cc' : '#2c3e66',
              color: 'white',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>

      {/* Dialog conferma cambio assegnazione */}
      {confirmRiassegna && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '90%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>⚠️ Azienda già assegnata</h3>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#45536f' }}>
              Questa azienda è già assegnata a <strong>{form.assegnatoNome}</strong>.
            </p>
            <p style={{ margin: '0 0 22px', fontSize: 14, color: '#45536f' }}>
              Vuoi riassegnarla a <strong>{confirmRiassegna.nuovoNome || '— Nessuno —'}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmRiassegna(null)}
                style={{ padding: '9px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14 }}
              >
                Annulla
              </button>
              <button
                onClick={confermaCambioAssegnazione}
                style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#f59e0b', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                Sì, riassegna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModaleAzienda;
