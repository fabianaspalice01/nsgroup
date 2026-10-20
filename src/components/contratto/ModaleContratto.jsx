import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import SignatureCanvas from 'react-signature-canvas';
import toast from 'react-hot-toast';
import { AREE, TUTTE_LE_VOCI, vociDaPreventivo } from './vociContratto';
import { generaPdfContratto } from './pdfContratto';
import SelettoreSocieta from '../SelettoreSocieta';
import { societaDi } from '../../utils/societa';

const oggi = () => new Date().toISOString().split('T')[0];
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const eur = (v) => (Number(v) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const stileInput = { width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' };
const stileLabel = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' };

function clienteDaAzienda(az) {
  if (!az) return {};
  const localita = [az.cap, az.comune].filter(Boolean).join(' ');
  return {
    ragioneSociale: az.nome || '', sedeLegale: az.indirizzo || '', localitaLegale: localita, provLegale: az.provincia || '',
    sedeOperativa: az.indirizzo || '', localitaOperativa: localita, provOperativa: az.provincia || '',
    piva: az.partitaIva || '', pec: az.pec || '', rappresentante: az.contatto || '', telefono: az.telefono || '', email: az.email || '', ateco: '',
  };
}

function ModaleContratto({ onClose, onSave, aziende, preventivo, contrattoInModifica, userData }) {
  const isEdit = !!contrattoInModifica;
  const base = contrattoInModifica || {};
  const [step, setStep] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [areaAperta, setAreaAperta] = useState(null);
  const sigCliente = useRef(null);
  const sigConsulente = useRef(null);

  const aziendaIniziale = base.aziendaId || preventivo?.aziendaId || '';
  const [aziendaId, setAziendaId] = useState(aziendaIniziale);
  // società del gruppo a cui va il contratto (e la sua contabilità): di base quella del preventivo o dell'azienda
  const [societa, setSocieta] = useState(() => {
    const az = aziende.find((a) => a.id === aziendaIniziale);
    return base.societa || preventivo?.societa || (az || isEdit ? societaDi(az) : '');
  });
  const [cliente, setCliente] = useState(() => base.cliente
    || { ...clienteDaAzienda(aziende.find((a) => a.id === aziendaIniziale)), ...(!aziendaIniziale && preventivo ? { ragioneSociale: preventivo.nomeCliente || '' } : {}) });
  const [voci, setVoci] = useState(() => base.voci || (preventivo ? vociDaPreventivo(preventivo.servizi) : {}));
  const [dati, setDati] = useState(() => ({
    importoTotale: base.importoTotale ?? '',
    periodicita: base.periodicita || 'mensile',
    fatturazione: base.fatturazione || 'mensile',
    costoAttivazione: base.costoAttivazione ?? '',
    costoSorveglianza: base.costoSorveglianza ?? (() => {
      const v = preventivo ? vociDaPreventivo(preventivo.servizi)['2.01'] : null;
      return v ? v.prezzo : '';
    })(),
    risarcimento: base.risarcimento ?? '',
    canonePortale: base.canonePortale ?? '',
    luogo: base.luogo || 'Napoli',
    data: base.data || oggi(),
    consulente: base.consulente || preventivo?.consulente || userData?.nome || '',
  }));

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const scegliAzienda = (id) => {
    setAziendaId(id);
    if (id && !societa) setSocieta(societaDi(aziende.find((a) => a.id === id)));
    if (id) setCliente((prev) => ({ ...prev, ...clienteDaAzienda(aziende.find((a) => a.id === id)) }));
  };
  const setVoce = (cod, campo, valore) => setVoci((prev) => {
    const v = { sel: false, prezzo: '', opzioni: [], testo: '', ...prev[cod] };
    const def = TUTTE_LE_VOCI.find((x) => x.cod === cod);
    if (campo === 'sel' && valore && v.prezzo === '' && def?.prezzoFisso) v.prezzo = String(def.prezzoFisso);
    if (campo === 'opzione') {
      v.opzioni = v.opzioni.includes(valore) ? v.opzioni.filter((o) => o !== valore) : [...v.opzioni, valore];
      v.sel = true;
    } else {
      v[campo] = valore;
      if (campo !== 'sel' && valore !== '') v.sel = true;
    }
    return { ...prev, [cod]: v };
  });

  const scelte = TUTTE_LE_VOCI.filter((v) => voci[v.cod]?.sel && !v.titoletto);
  const sommaVoci = scelte.reduce((t, v) => t + (v.perDipendente || v.senzaPrezzo ? 0 : num(voci[v.cod].prezzo)), 0);

  const avanti = () => {
    if (step === 1 && !societa) { toast.error('Indica a quale società si riferisce il contratto'); return; }
    if (step === 1 && !cliente.ragioneSociale?.trim()) { toast.error('Indica la ragione sociale del cliente'); return; }
    if (step === 2 && !scelte.length) { toast.error('Seleziona almeno una voce del contratto'); return; }
    if (step === 3 && !(num(dati.importoTotale) > 0)) { toast.error("Indica l'importo totale del servizio"); return; }
    setStep(step + 1);
  };

  const salva = async () => {
    const vuota = (r) => !r.current || r.current.isEmpty();
    if (!isEdit && userData?.ruolo !== 'admin' && (vuota(sigCliente) || vuota(sigConsulente))) {
      toast.error('Servono entrambe le firme'); return;
    }
    setSalvando(true);
    try {
      const contratto = {
        societa, aziendaId, preventivoId: base.preventivoId || preventivo?.id || '', cliente, voci,
        importoTotale: num(dati.importoTotale), periodicita: dati.periodicita, fatturazione: dati.fatturazione,
        costoAttivazione: num(dati.costoAttivazione), costoSorveglianza: num(dati.costoSorveglianza),
        risarcimento: num(dati.risarcimento), canonePortale: num(dati.canonePortale),
        luogo: dati.luogo, data: dati.data, consulente: dati.consulente,
        firmaCliente: vuota(sigCliente) ? (base.firmaCliente || null) : sigCliente.current.toDataURL('image/png'),
        firmaConsulente: vuota(sigConsulente) ? (base.firmaConsulente || null) : sigConsulente.current.toDataURL('image/png'),
      };
      const pdfBlob = await generaPdfContratto(contratto);
      const nome = `Contratto_${(cliente.ragioneSociale || 'cliente').replace(/[^A-Za-z0-9]+/g, '_')}_${dati.data}.pdf`;
      await onSave({ ...contratto, pdfBlob, fileName: nome, isEdit, contrattoId: base.id });
    } catch (e) {
      console.error(e);
      toast.error('Errore nella generazione del contratto');
    } finally {
      setSalvando(false);
    }
  };

  const campoCliente = (k, etichetta, larghezza = '1fr') => (
    <div style={{ gridColumn: larghezza === 'full' ? '1 / -1' : undefined }}>
      <label style={stileLabel}>{etichetta}</label>
      <input style={stileInput} value={cliente[k] || ''} onChange={(e) => setCliente({ ...cliente, [k]: e.target.value })} />
    </div>
  );
  const campoDati = (k, etichetta, tipo = 'text', hint) => (
    <div>
      <label style={stileLabel}>{etichetta}</label>
      <input style={stileInput} type={tipo} inputMode={tipo === 'text' && k !== 'luogo' && k !== 'consulente' ? 'decimal' : undefined}
        value={dati[k]} onChange={(e) => setDati({ ...dati, [k]: e.target.value })} />
      {hint && <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 3 }}>{hint}</div>}
    </div>
  );
  const griglia = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? 0 : 20 }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '16px 16px 0 0' : 12, width: '100%', maxWidth: isMobile ? '100%' : 900, maxHeight: isMobile ? '96vh' : '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: isMobile ? '14px 14px 10px' : '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: isMobile ? 16 : 18 }}>{isEdit ? '✏️ Modifica contratto' : '📝 Nuovo contratto di consulenza'}</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {['1. Cliente', '2. Servizi', '3. Condizioni', '4. Firme'].map((t, i) => (
              <div key={t} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: step === i + 1 ? 'var(--primary)' : step > i + 1 ? '#dbe4f5' : 'var(--surface-2)', color: step === i + 1 ? 'white' : 'var(--ink-muted)' }}>{t}</div>
            ))}
          </div>
        </div>

        <div style={{ padding: isMobile ? 14 : 20, overflowY: 'auto', flex: 1 }}>
          {step === 1 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {preventivo && (
                <div style={{ padding: 10, background: 'var(--primary-soft)', borderRadius: 8, fontSize: 13, color: 'var(--primary)' }}>
                  ℹ️ Dati e servizi presi dal preventivo del {new Date(preventivo.dataCreazione || preventivo.data).toLocaleDateString('it-IT')}: controllali e completali.
                </div>
              )}
              <SelettoreSocieta
                value={societa}
                onChange={setSocieta}
                nota="Il canone del contratto va nella contabilità di questa società."
              />
              <div>
                <label style={stileLabel}>Azienda registrata</label>
                <select style={stileInput} value={aziendaId} onChange={(e) => scegliAzienda(e.target.value)}>
                  <option value="">— cliente non ancora registrato —</option>
                  {[...aziende].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it')).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
                {!aziendaId && <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 3 }}>Se il cliente non è registrato, al salvataggio viene creato in Aziende e in contabilità.</div>}
              </div>
              <div style={griglia}>
                {campoCliente('ragioneSociale', 'Ragione sociale *', 'full')}
                {campoCliente('sedeLegale', 'Sede legale')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 8 }}>{campoCliente('localitaLegale', 'Località')}{campoCliente('provLegale', 'Prov.')}</div>
                {campoCliente('sedeOperativa', 'Sede operativa')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 8 }}>{campoCliente('localitaOperativa', 'Località')}{campoCliente('provOperativa', 'Prov.')}</div>
                {campoCliente('piva', 'Cod. fisc. / P. IVA')}
                {campoCliente('pec', 'PEC')}
                {campoCliente('ateco', 'Codice ATECO')}
                {campoCliente('rappresentante', 'Rappresentante legale')}
                {campoCliente('telefono', 'Tel. / fax')}
                {campoCliente('email', 'Email')}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12, fontSize: 13 }}>
                <span style={{ color: 'var(--ink-muted)' }}>Apri un'area e spunta le voci: il prezzo va indicato senza IVA.</span>
                <strong>{scelte.length} voci · € {eur(sommaVoci)} + IVA</strong>
              </div>
              {AREE.map((area) => {
                const nSel = area.voci.filter((v) => voci[v.cod]?.sel).length;
                const aperta = areaAperta === area.cod;
                return (
                  <div key={area.cod} style={{ border: '1px solid var(--line)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                    <button type="button" onClick={() => setAreaAperta(aperta ? null : area.cod)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: 0, background: nSel ? '#eef4ff' : 'var(--surface-2)', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 700, color: 'var(--primary-hover)' }}>
                      <span style={{ flex: 1 }}>{area.cod}. {area.titolo}</span>
                      {nSel > 0 && <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{nSel}</span>}
                      <span>{aperta ? '▲' : '▼'}</span>
                    </button>
                    {aperta && (
                      <div style={{ padding: '4px 12px 10px' }}>
                        {area.voci.map((v) => {
                          const st = voci[v.cod] || {};
                          if (v.titoletto) return <div key={v.cod} style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-muted)', padding: '8px 0 2px' }}>{v.cod} {v.label}</div>;
                          return (
                            <div key={v.cod} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '6px 0', paddingLeft: v.rientro ? 18 : 0, borderTop: '1px solid var(--surface-2)' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 260px', fontSize: 13, cursor: 'pointer', fontWeight: st.sel ? 700 : 400 }}>
                                <input type="checkbox" checked={!!st.sel} onChange={(e) => setVoce(v.cod, 'sel', e.target.checked)} />
                                <span><span style={{ color: 'var(--ink-muted)' }}>{v.cod}</span> {v.label}{v.perDipendente && !/dip|corsista/i.test(v.label) ? ' (a dipendente)' : ''}</span>
                              </label>
                              {v.opzioni && (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {v.opzioni.map((o) => (
                                    <label key={o} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                      <input type="checkbox" checked={(st.opzioni || []).includes(o)} onChange={() => setVoce(v.cod, 'opzione', o)} />{o}
                                    </label>
                                  ))}
                                </div>
                              )}
                              {v.testo && (
                                <input style={{ ...stileInput, width: 160 }} placeholder={v.testo} value={st.testo || ''} onChange={(e) => setVoce(v.cod, 'testo', e.target.value)} />
                              )}
                              {v.senzaPrezzo ? <span style={{ fontSize: 11, color: 'var(--ink-muted)', width: 110 }}>si firma sul modulo</span> : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 13 }}>€</span>
                                  <input style={{ ...stileInput, width: 95, textAlign: 'right' }} inputMode="decimal" placeholder={v.prezzoFisso ? String(v.prezzoFisso) : '0,00'}
                                    value={st.prezzo ?? ''} onChange={(e) => setVoce(v.cod, 'prezzo', e.target.value)} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={griglia}>
                {campoDati('importoTotale', "Importo totale del servizio € (+ IVA) *", 'text', `Somma delle voci scelte: € ${eur(sommaVoci)} (esclusi i prezzi a dipendente)`)}
                <div>
                  <label style={stileLabel}>Importo</label>
                  <div style={{ display: 'flex', gap: 16, paddingTop: 8 }}>
                    {['mensile', 'annuale'].map((p) => (
                      <label key={p} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                        <input type="radio" name="periodicita" checked={dati.periodicita === p} onChange={() => setDati({ ...dati, periodicita: p })} />{p === 'mensile' ? 'Mensile' : 'Annuale'}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={stileLabel}>Fatturazione (condizione C)</label>
                  <select style={stileInput} value={dati.fatturazione} onChange={(e) => setDati({ ...dati, fatturazione: e.target.value })}>
                    <option value="mensile">Mensile</option><option value="trimestrale">Trimestrale anticipata</option>
                  </select>
                </div>
                {campoDati('costoAttivazione', 'Costo di attivazione € (condizione A)', 'text', 'Una tantum, + IVA')}
                {campoDati('costoSorveglianza', 'Sorveglianza sanitaria € a dipendente (condizione B)', 'text', '+ IVA; prelievi e test a parte')}
                {campoDati('risarcimento', 'Risarcimento spese documentazione € (condizione F)')}
                {campoDati('canonePortale', 'Canone mensile WEB PORTAL dopo il 3° anno € (condizione L)')}
              </div>
              <div style={griglia}>
                {campoDati('luogo', 'Luogo')}
                {campoDati('data', 'Data', 'date')}
                {campoDati('consulente', 'Consulente')}
              </div>
              <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                Durata tre anni con tacito rinnovo (condizioni F e G): la scadenza viene calcolata dalla data del contratto.
                L'importo e la periodicità diventano il canone del cliente nella contabilità di NS Consulting.
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
              {isEdit && <div style={{ gridColumn: '1 / -1', padding: 10, background: 'var(--primary-soft)', borderRadius: 8, fontSize: 13, color: 'var(--primary)' }}>ℹ️ Lascia vuoto un riquadro per mantenere la firma già presente.</div>}
              {[['Contraente (cliente)', sigCliente], ['Contrattore (consulente)', sigConsulente]].map(([t, r]) => (
                <div key={t}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 14 }}>Firma {t}</label>
                  <div style={{ border: '2px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                    <SignatureCanvas ref={r} canvasProps={{ width: 400, height: 180, style: { width: '100%', height: 180, background: 'white' } }} />
                  </div>
                  <button type="button" onClick={() => r.current?.clear()}
                    style={{ marginTop: 8, padding: '6px 12px', background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%' }}>Cancella</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: isMobile ? '12px 14px' : '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" onClick={onClose} disabled={salvando} style={{ padding: '10px 20px', border: '1px solid var(--line)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Annulla</button>
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 1 && <button type="button" onClick={() => setStep(step - 1)} disabled={salvando} style={{ padding: '10px 20px', border: '1px solid var(--line)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>← Indietro</button>}
            {step < 4
              ? <button type="button" onClick={avanti} style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Avanti →</button>
              : <button type="button" onClick={salva} disabled={salvando} style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: 'var(--success)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>{salvando ? 'Salvataggio…' : '✓ Genera PDF e salva'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

ModaleContratto.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  aziende: PropTypes.array.isRequired,
  preventivo: PropTypes.object,
  contrattoInModifica: PropTypes.object,
  userData: PropTypes.object,
};

export default ModaleContratto;
