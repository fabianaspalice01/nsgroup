import { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';
import ModaleAzienda from './ModaleAzienda';
import TabControlli from './TabControlli';
import TabDipendenti from './TabDipendenti';
import TabDocumenti from './TabDocumenti';
import TabPagamenti from './TabPagamenti';
import * as XLSX from 'xlsx';

const TABS = [
  { id: 'controlli', label: '🔒 Controlli' },
  { id: 'dipendenti', label: '👤 Dipendenti' },
  { id: 'documenti', label: '📁 Documenti' },
  { id: 'pagamenti', label: '💰 Pagamenti' },
  { id: 'preventivi', label: '📄 Preventivi' },
  { id: 'note', label: '📝 Note' },
];

function SchedaAzienda({ azienda, onBack, onAddControllo, onUpdateAzienda, tipiControllo, readOnly = false, aziende = [], preventivi = [], tabIniziale, userData = null, referenti = [], onDeletePreventivo = null }) {
  const [tabAttiva, setTabAttiva] = useState(tabIniziale || 'controlli');

  useEffect(() => {
    if (tabIniziale) setTabAttiva(tabIniziale);
  }, [tabIniziale]);
  const [mostraModaleModifica, setMostraModaleModifica] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [preventivoDettaglio, setPreventivoDettaglio] = useState(null);
  const [note, setNote] = useState(azienda.note || '');
  const [salvandoNote, setSalvandoNote] = useState(false);
  const [noteModificate, setNoteModificate] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    setNote(azienda.note || '');
    setNoteModificate(false);
  }, [azienda.id, azienda.note]);

  const handleSalvaNote = async () => {
    setSalvandoNote(true);
    try {
      await onUpdateAzienda(azienda.id, { ...azienda, note });
      setNoteModificate(false);
    } finally {
      setSalvandoNote(false);
    }
  };

  const formatData = (dataStr) => {
    const [anno, mese, giorno] = dataStr.split('-');
    return `${giorno}/${mese}/${anno}`;
  };

  const getStatoScadenza = (scadenza, completato) => {
    if (completato) return { label: 'COMPLETATO', color: '#16223b', bg: '#dde3f0' };
    const oggi = new Date();
    const dataScadenza = new Date(scadenza);
    const diff = Math.ceil((dataScadenza - oggi) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: 'SCADUTO', color: '#dc2626', bg: '#fee2e2' };
    if (diff <= 7) return { label: 'URGENTE', color: '#d97706', bg: '#fef3c7' };
    return { label: 'OK', color: '#059669', bg: '#d1fae5' };
  };

  const handleExportExcel = () => {
    const datiAzienda = [
      ['DATI AZIENDA'],
      ['Nome', azienda.nome],
      ['Amministratore', azienda.contatto],
      ['Indirizzo', azienda.indirizzo],
      ['Comune', azienda.comune || ''],
      ['Provincia', azienda.provincia || ''],
      ['CAP', azienda.cap || ''],
      ['Telefono', azienda.telefono],
      ['Email', azienda.email],
      ['PEC', azienda.pec || ''],
      ['P.IVA', azienda.partitaIva],
      ['Codice Univoco', azienda.codiceUnivoco || ''],
      ['Note', azienda.note || ''],
      []
    ];

    const headerControlli = ['CONTROLLI DI SICUREZZA'];
    const colonneControlli = ['Tipo', 'Data Scadenza', 'Stato', 'Note'];
    const controlliData = azienda.controlli.map(c => {
      const stato = getStatoScadenza(c.scadenza, c.completato);
      return [c.tipo, formatData(c.scadenza), stato.label, c.note || ''];
    });

    const headerOrganigramma = ['ORGANIGRAMMA AZIENDALE'];
    const colonneOrganigramma = ['Nome', 'Cognome', 'Mansione', 'Telefono', 'Email', 'Note'];
    const organigrammaData = (azienda.dipendenti || []).map(d => [
      d.nome, d.cognome, d.mansione || '', d.telefono || '', d.email || '', d.note || ''
    ]);

    const attestatiData = [['ATTESTATI DIPENDENTI'], ['Dipendente', 'Attestato', 'Data Rilascio', 'Data Scadenza', 'Ente', 'Numero', 'Note']];
    (azienda.dipendenti || []).forEach(dip => {
      (dip.attestati || []).forEach(att => {
        attestatiData.push([
          `${dip.nome} ${dip.cognome}`, att.nome,
          att.dataRilascio ? formatData(att.dataRilascio) : '',
          att.dataScadenza ? formatData(att.dataScadenza) : '',
          att.enteRilascio || '', att.numeroAttestato || '', att.note || ''
        ]);
      });
    });

    const headerDocumenti = ['DOCUMENTI AZIENDA'];
    const colonneDocumenti = ['Nome', 'Tipo', 'Data Emissione', 'Data Scadenza', 'Numero', 'Note'];
    const documentiData = (azienda.documenti || []).map(d => [
      d.nome, d.tipo,
      d.dataEmissione ? formatData(d.dataEmissione) : '',
      d.dataScadenza ? formatData(d.dataScadenza) : '',
      d.numeroDocumento || '', d.note || ''
    ]);

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet([...datiAzienda, headerControlli, colonneControlli, ...controlliData]);
    ws1['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Dati Generali');

    const ws2 = XLSX.utils.aoa_to_sheet([headerOrganigramma, colonneOrganigramma, ...organigrammaData]);
    ws2['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Organigramma');

    if (attestatiData.length > 2) {
      const ws3 = XLSX.utils.aoa_to_sheet(attestatiData);
      ws3['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Attestati');
    }

    if (documentiData.length > 0) {
      const ws4 = XLSX.utils.aoa_to_sheet([headerDocumenti, colonneDocumenti, ...documentiData]);
      ws4['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Documenti');
    }

    const pagamentiData = (azienda.pagamenti || []);
    if (pagamentiData.length > 0) {
      const colonnePagamenti = ['Data', 'Importo (€)', 'Metodo', 'Numero Fattura', 'Descrizione', 'Note'];
      const righe = pagamentiData
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .map(p => [
          formatData(p.data),
          parseFloat(p.importo || 0).toFixed(2),
          p.metodoPagamento || '',
          p.numeroFattura || '',
          p.descrizione || '',
          p.note || ''
        ]);
      const totale = pagamentiData.reduce((sum, p) => sum + parseFloat(p.importo || 0), 0);
      const ws5 = XLSX.utils.aoa_to_sheet([
        ['STORICO PAGAMENTI'],
        colonnePagamenti,
        ...righe,
        [],
        ['', `TOTALE: € ${totale.toFixed(2)}`]
      ]);
      ws5['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 35 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws5, 'Pagamenti');
    }

    const fileName = `${azienda.nome.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div>
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          danger
        />
      )}

      {!readOnly && (
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#2c3e66', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', marginBottom: '20px', padding: 0 }}
        >
          ← Torna alla lista
        </button>
      )}

      {/* Header azienda */}
      <div style={{ background: 'white', padding: isMobile ? '16px' : '25px', borderRadius: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 12 : 0, marginBottom: '15px' }}>
          <h2 style={{ margin: 0, wordBreak: 'break-word' }}>{azienda.nome}</h2>
          {!readOnly && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => onUpdateAzienda(azienda.id, { puoScaricare: !azienda.puoScaricare })}
                style={{
                  flex: isMobile ? 1 : 'none',
                  background: azienda.puoScaricare ? '#fef3c7' : '#eef1f7',
                  color: azienda.puoScaricare ? '#92400e' : '#5f6f8c',
                  border: `1px solid ${azienda.puoScaricare ? '#fde68a' : '#dfe5ef'}`,
                  padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                }}
              >
                {azienda.puoScaricare ? '🔓 Download azienda ✓' : '🔒 Download azienda'}
              </button>
              <button
                onClick={handleExportExcel}
                style={{ flex: isMobile ? 1 : 'none', background: '#10b981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
              >
                📊 Export Excel
              </button>
              <button
                onClick={() => setMostraModaleModifica(true)}
                style={{ flex: isMobile ? 1 : 'none', background: '#2c3e66', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
              >
                ✏️ Modifica
              </button>
            </div>
          )}
        </div>

        <div style={{ color: '#5f6f8c', fontSize: '14px' }}>
          {azienda.contatto && <p><strong>Amministratore:</strong> {azienda.contatto}</p>}
          {azienda.indirizzo && <p><strong>Indirizzo:</strong> {azienda.indirizzo}</p>}
          {(azienda.comune || azienda.cap || azienda.provincia) && (
            <p>
              <strong>Comune:</strong>{' '}
              {[azienda.cap, azienda.comune, azienda.provincia ? `(${azienda.provincia})` : ''].filter(Boolean).join(' ')}
            </p>
          )}
          {azienda.telefono && <p><strong>Telefono:</strong> {azienda.telefono}</p>}
          {azienda.email && <p><strong>Email:</strong> {azienda.email}</p>}
          {azienda.pec && <p><strong>PEC:</strong> {azienda.pec}</p>}
          {azienda.partitaIva && <p><strong>P.IVA:</strong> {azienda.partitaIva}</p>}
          {azienda.codiceUnivoco && <p><strong>Codice Univoco:</strong> {azienda.codiceUnivoco}</p>}
          {azienda.note && <p><strong>Note:</strong> {azienda.note}</p>}
          {azienda.assegnatoNome && (
            <p><strong>Assegnato a:</strong> <span style={{ color: '#2c3e66', fontWeight: 600 }}>👤 {azienda.assegnatoNome}</span></p>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ marginBottom: '20px', background: 'white', padding: '6px', borderRadius: '10px', border: '1px solid #dfe5ef', overflowX: isMobile ? 'auto' : 'visible' }}>
        <div style={{ display: 'flex', gap: '4px', minWidth: isMobile ? 'max-content' : 'unset' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTabAttiva(tab.id)}
              style={{
                flex: isMobile ? 'none' : 1,
                padding: isMobile ? '10px 14px' : '10px 16px',
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: tabAttiva === tab.id ? '700' : '500',
                background: tabAttiva === tab.id ? '#2c3e66' : 'transparent',
                color: tabAttiva === tab.id ? 'white' : '#5f6f8c',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tabAttiva === 'controlli' && (
          <TabControlli
            azienda={azienda}
            onUpdateAzienda={onUpdateAzienda}
            onAddControllo={onAddControllo}
            tipiControllo={tipiControllo}
            readOnly={readOnly}
          />
        )}
        {tabAttiva === 'dipendenti' && (
          <TabDipendenti
            azienda={azienda}
            onUpdateAzienda={onUpdateAzienda}
            readOnly={readOnly}
            canDownload={
              !readOnly ||
              (userData?.ruolo === 'azienda' && !!azienda.puoScaricare) ||
              (userData?.ruolo === 'consulente' && (userData?.downloadAbilitato || []).includes(azienda.id))
            }
          />
        )}
        {tabAttiva === 'documenti' && (
          <TabDocumenti
            azienda={azienda}
            onUpdateAzienda={onUpdateAzienda}
            readOnly={readOnly}
            canDownload={
              !readOnly ||
              (userData?.ruolo === 'azienda' && !!azienda.puoScaricare) ||
              (userData?.ruolo === 'consulente' && (userData?.downloadAbilitato || []).includes(azienda.id))
            }
          />
        )}
        {tabAttiva === 'pagamenti' && (
          <TabPagamenti
            azienda={azienda}
            onUpdateAzienda={onUpdateAzienda}
            readOnly={readOnly}
          />
        )}
        {tabAttiva === 'preventivi' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px' }}>Preventivi ({preventivi.filter(p => p.aziendaId === azienda.id).length})</h3>
            {preventivi.filter(p => p.aziendaId === azienda.id).length === 0 ? (
              <p style={{ color: '#9aa7bf', fontSize: 14, textAlign: 'center', padding: 30 }}>Nessun preventivo disponibile</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {preventivi
                  .filter(p => p.aziendaId === azienda.id)
                  .sort((a, b) => new Date(b.dataCreazione) - new Date(a.dataCreazione))
                  .map(prev => (
                    <div key={prev.id} style={{ border: '1px solid #dfe5ef', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                          Preventivo del {new Date(prev.dataCreazione).toLocaleDateString('it-IT')}
                        </div>
                        <div style={{ fontSize: 13, color: '#5f6f8c' }}>
                          {prev.dataSopralluogo && `📅 Sopralluogo: ${prev.dataSopralluogo.split('-').reverse().join('/')}`}
                          {prev.consulente && ` • 👤 ${prev.consulente}`}
                        </div>
                        {prev.totale > 0 && (
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginTop: 4 }}>
                            € {Number(prev.totale).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setPreventivoDettaglio(prev)}
                          style={{ background: '#eef1f8', border: '1px solid #c3cde3', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#2c3e66', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          ℹ️ Dettagli
                        </button>
                        {prev.pdfUrl && (
                          <a
                            href={prev.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: '#eef1f8', border: '1px solid #d5ddee', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#34508a', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            📄 Apri PDF
                          </a>
                        )}
                        {userData?.ruolo === 'admin' && onDeletePreventivo && (
                          <button
                            onClick={() => onDeletePreventivo(prev.id)}
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#dc2626', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            🗑️ Elimina
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
        {tabAttiva === 'note' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 24 }}>
            <textarea
              value={note}
              onChange={e => { setNote(e.target.value); setNoteModificate(true); }}
              readOnly={readOnly}
              placeholder={readOnly ? 'Nessuna nota' : 'Scrivi qui le note per questa azienda...'}
              rows={12}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 8,
                border: '1px solid #dfe5ef',
                fontSize: 14,
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                color: '#1a2540',
                background: readOnly ? '#f6f8fc' : '#fff',
              }}
            />
            {!readOnly && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 10, alignItems: 'center' }}>
                {noteModificate && <span style={{ fontSize: 13, color: '#9aa7bf' }}>Modifiche non salvate</span>}
                <button
                  onClick={handleSalvaNote}
                  disabled={salvandoNote || !noteModificate}
                  style={{
                    padding: '9px 22px',
                    background: noteModificate ? '#2c3e66' : '#dfe5ef',
                    color: noteModificate ? '#fff' : '#9aa7bf',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: noteModificate ? 'pointer' : 'default',
                  }}
                >
                  {salvandoNote ? 'Salvo...' : '💾 Salva note'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {mostraModaleModifica && (
        <ModaleAzienda
          azienda={azienda}
          onClose={() => setMostraModaleModifica(false)}
          onSave={(datiAggiornati) => {
            onUpdateAzienda(azienda.id, datiAggiornati);
            setMostraModaleModifica(false);
          }}
          aziende={aziende}
          referenti={referenti}
        />
      )}

      {preventivoDettaglio && (() => {
        const p = preventivoDettaglio;
        const serviziAttivi = (p.servizi || []).filter(s => parseInt(s.quantita) > 0);
        const conDipendenti = serviziAttivi.filter(s => (s.dipendenti || []).some(d => d.nome?.trim()));
        const senzaDipendenti = serviziAttivi.filter(s => !(s.dipendenti || []).some(d => d.nome?.trim()));
        return (
          <div onClick={() => setPreventivoDettaglio(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

              <div style={{ padding: '16px 20px', borderBottom: '1px solid #dfe5ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17 }}>📋 {p.nomeCliente || azienda.nome}</h3>
                  <div style={{ fontSize: 12, color: '#5f6f8c', marginTop: 2, textTransform: 'capitalize' }}>{p.tipoDocumento || 'preventivo'}</div>
                </div>
                <button onClick={() => setPreventivoDettaglio(null)}
                  style={{ border: 'none', background: '#eef1f7', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#5f6f8c' }}>✕</button>
              </div>

              <div style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, padding: 12, background: '#f6f8fc', borderRadius: 8, border: '1px solid #dfe5ef' }}>
                  {[
                    ['Data', p.data ? new Date(p.data + 'T12:00:00').toLocaleDateString('it-IT') : '—'],
                    ['Consulente', p.consulente || '—'],
                    ['Totale', `€ ${p.totale?.toFixed(2) || '0.00'}`],
                    ['Creato il', p.dataCreazione ? new Date(p.dataCreazione).toLocaleDateString('it-IT') : '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: '#9aa7bf', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2540' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {serviziAttivi.length === 0 && (
                  <p style={{ color: '#9aa7bf', textAlign: 'center', padding: 20 }}>Nessun servizio selezionato</p>
                )}

                {serviziAttivi.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#45536f' }}>📋 Servizi</h4>

                    {/* intestazione colonne */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 10px', padding: '5px 10px', fontSize: 11, color: '#9aa7bf', fontWeight: 600, textTransform: 'uppercase' }}>
                      <span>Descrizione</span>
                      <span style={{ textAlign: 'center' }}>Qtà</span>
                      <span style={{ textAlign: 'right' }}>Prezzo unit.</span>
                      <span style={{ textAlign: 'right' }}>Totale</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {serviziAttivi.map(s => {
                        const qty = parseFloat(s.quantita) || 0;
                        const pu = parseFloat(s.prezzoUnitario) || 0;
                        const tot = qty * pu;
                        const hasDip = (s.dipendenti || []).some(d => d.nome?.trim());
                        return (
                          <div key={s.id} style={{ background: hasDip ? '#eef1f8' : '#f6f8fc', border: `1px solid ${hasDip ? '#c3cde3' : '#dfe5ef'}`, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 10px', alignItems: 'center' }}>
                              <span style={{ fontSize: 13, color: hasDip ? '#2c3e66' : '#1a2540', fontWeight: hasDip ? 700 : 400 }}>{s.descrizione}</span>
                              <span style={{ fontSize: 13, color: '#5f6f8c', textAlign: 'center' }}>× {s.quantita}</span>
                              <span style={{ fontSize: 13, color: '#45536f', textAlign: 'right', whiteSpace: 'nowrap' }}>€ {pu.toFixed(2)}</span>
                              <span style={{ fontSize: 13, color: '#059669', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>€ {tot.toFixed(2)}</span>
                            </div>
                            {hasDip && (
                              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4 }}>
                                {(s.dipendenti || []).filter(d => d.nome?.trim()).map((dip, i) => (
                                  <div key={i} style={{ fontSize: 12, color: '#2c3e66' }}>👤 {dip.nome}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* riga totale */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '2px solid #dfe5ef' }}>
                      <span style={{ fontSize: 14, color: '#45536f', fontWeight: 600 }}>Totale complessivo:</span>
                      <span style={{ fontSize: 16, color: '#059669', fontWeight: 800 }}>€ {p.totale?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                )}

                {p.motivazioneModifica && (
                  <div style={{ marginTop: 16, padding: 12, background: '#fef9c3', borderRadius: 8, border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>📝 Motivazione ultima modifica</div>
                    <div style={{ fontSize: 13, color: '#78350f' }}>{p.motivazioneModifica}</div>
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid #dfe5ef', textAlign: 'right' }}>
                <button onClick={() => setPreventivoDettaglio(null)}
                  style={{ padding: '9px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default SchedaAzienda;
