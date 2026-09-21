import { useEffect, useState } from 'react';
import toast from "react-hot-toast";

function ModaleAppuntamento({ appuntamento, defaultValues, onClose, onSave, aziende, consulenti = [], userRole = 'admin' }) {
    const defaultForm = {
        tipoCliente: 'registrato',
        aziendaId: aziende.length > 0 ? aziende[0].id : '',
        nuovoCliente: {
            nome: '',
            contatto: '',
            telefono: '',
            indirizzo: ''
        },
        data: new Date().toISOString().split('T')[0],
        ora: '09:00',
        durata: 60,
        tipo: 'Sopralluogo',
        consulente: '',
        stato: 'Programmato',
        note: '',
        motivazioneDisdetta: ''
    };

    const [nuovoTipo, setNuovoTipo] = useState('');
    const [tipiPersonalizzati, setTipiPersonalizzati] = useState([]);
    const [dataOraOriginale, setDataOraOriginale] = useState(
        appuntamento ? { data: appuntamento.data, ora: appuntamento.ora } : null
    );
    const [motivazioneModifica, setMotivazioneModifica] = useState('');
    const [form, setForm] = useState(() => {
        if (appuntamento) {
            return {
                tipoCliente: appuntamento.aziendaId ? 'registrato' : 'nuovo',
                aziendaId: appuntamento.aziendaId || '',
                nomeNuovoCliente: appuntamento.nuovoCliente?.nome || '',
                nuovoCliente: {
                    nome: appuntamento.nuovoCliente?.nome || '',
                    contatto: appuntamento.nuovoCliente?.contatto || '',
                    telefono: appuntamento.nuovoCliente?.telefono || '',
                    indirizzo: appuntamento.nuovoCliente?.indirizzo || ''
                },
                data: appuntamento.data,
                ora: appuntamento.ora,
                durata: appuntamento.durata,
                tipo: appuntamento.tipo,
                consulente: appuntamento.consulente,
                stato: appuntamento.stato,
                note: appuntamento.note || '',
                motivazioneDisdetta: appuntamento.motivazioneDisdetta || ''
            };
        }
        return {
            tipoCliente: 'registrato',
            aziendaId: '',
            nomeNuovoCliente: '',
            contattoNuovoCliente: '',
            telefonoNuovoCliente: '',
            indirizzoNuovoCliente: '',
            data: defaultValues?.data || new Date().toISOString().split('T')[0],
            ora: defaultValues?.ora || '09:00',
            durata: '60',
            tipo: 'Sopralluogo',
            consulente: '',
            stato: 'Programmato',
            note: '',
            motivazioneDisdetta: ''
        };
    });

    useEffect(() => {
        // quando apro in modifica o apro da calendario con dati precompilati
        if (appuntamento) {
            setForm({ ...defaultForm, ...appuntamento });
        } else {
            setForm(defaultForm);
        }
    }, [appuntamento, aziende]);

    const tipiAppuntamentoBase = [
        'Sopralluogo',
        'Primo contatto',
        'Preventivo',
        'Formazione sicurezza',
        'Controllo periodico',
        'Audit',
        'Consulenza',
        'Verifica documentale',
        'Riunione',
    ];

    const tipiAppuntamento = [...tipiAppuntamentoBase, ...tipiPersonalizzati];

    const statiAppuntamento = [
        'Programmato',
        'Confermato',
        'Completato',
        'Disdetto'
    ];

    const handleChange = (campo, valore) => {
        setForm({ ...form, [campo]: valore });
    };

    const handleNuovoClienteChange = (campo, valore) => {
        setForm({
            ...form,
            nuovoCliente: { ...form.nuovoCliente, [campo]: valore }
        });
    };

    const aggiungiTipoAppuntamento = () => {
        const valore = nuovoTipo.trim();

        if (!valore) return;

        // evita duplicati
        const esiste = tipiAppuntamento.some(
            t => t.toLowerCase() === valore.toLowerCase()
        );

        if (esiste) {
            toast.error('Questo tipo esiste già');
            return;
        }

        setTipiPersonalizzati(prev => [...prev, valore]);
        setNuovoTipo('');
        setForm(prev => ({ ...prev, tipo: valore }));

        // opzionale: selezionalo automaticamente
        handleChange('tipo', valore);
    };

    const aziendaSelezionata = form.tipoCliente === 'registrato'
        ? aziende.find(az => az.id === form.aziendaId)
        : null;

    const handleSave = () => {
        // Validazioni base
        if (form.tipoCliente === 'registrato' && !form.aziendaId) {
            toast.error("Seleziona un'azienda!");
            return;
        }

        if (form.tipoCliente === 'nuovo' && !form.nuovoCliente.nome) {
            toast.error('Inserisci il nome del cliente!');
            return;
        }

        if (!form.data || !form.ora) {
            toast.error('Inserisci data e ora!');
            return;
        }

        if (form.stato === 'Disdetto' && !form.motivazioneDisdetta) {
            toast.error('Inserisci la motivazione della disdetta!');
            return;
        }

        // Se è un consulente in modifica, richiedi motivazione se cambia data/ora
        if (userRole === 'consulente' && appuntamento) {
            const dataModificata = form.data !== dataOraOriginale?.data;
            const oraModificata = form.ora !== dataOraOriginale?.ora;
            if ((dataModificata || oraModificata) && !motivazioneModifica.trim()) {
                toast.error('Devi inserire una motivazione per modificare data o ora!');
                return;
            }
        }


        // Prepara i dati da salvare
        const datiAppuntamento = {
            ...form,
            motivazioneModificaDataOra: motivazioneModifica || ''
        };

        onSave(datiAppuntamento);
        onClose();
    };
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}   // 🔥 QUESTO È FONDAMENTALE
                style={{
                    background: 'white',
                    padding: '30px',
                    borderRadius: '12px',
                    width: '90%',
                    maxWidth: '600px',
                    maxHeight: '90vh',
                    overflowY: 'auto'
                }}
            >
                <h2 style={{ marginBottom: '20px' }}>
                    {appuntamento ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
                </h2>

                {/* Tipo Cliente */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                        Tipo Cliente
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => handleChange('tipoCliente', 'registrato')}
                            disabled={userRole === 'consulente' && !!appuntamento}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: form.tipoCliente === 'registrato' ? '2px solid #2c3e66' : '1px solid #dfe5ef',
                                borderRadius: '8px',
                                background: form.tipoCliente === 'registrato' ? '#eef1f8' : 'white',
                                color: form.tipoCliente === 'registrato' ? '#2c3e66' : '#5f6f8c',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600'
                            }}
                        >
                            🏢 Cliente Registrato
                        </button>
                        <button
                            type="button"
                            onClick={() => handleChange('tipoCliente', 'nuovo')}
                            disabled={userRole === 'consulente' && !!appuntamento}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: form.tipoCliente === 'nuovo' ? '2px solid #10b981' : '1px solid #dfe5ef',
                                borderRadius: '8px',
                                background: form.tipoCliente === 'nuovo' ? '#d1fae5' : 'white',
                                color: form.tipoCliente === 'nuovo' ? '#059669' : '#5f6f8c',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600'
                            }}
                        >
                            ✨ Nuovo Cliente
                        </button>
                    </div>
                </div>

                {/* Cliente Registrato */}
                {form.tipoCliente === 'registrato' && (
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                            Azienda Cliente *
                        </label>
                        <select
                            value={form.aziendaId}
                            onChange={(e) => handleChange('aziendaId', e.target.value)}
                            disabled={userRole === 'consulente' && !!appuntamento}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #dfe5ef',
                                borderRadius: '6px',
                                fontSize: '14px',
                                background: 'white'
                            }}
                        >
                            {aziende.map(az => (
                                <option key={az.id} value={az.id}>{az.nome}</option>
                            ))}
                        </select>
                        {aziendaSelezionata && (
                            <p style={{ fontSize: '12px', color: '#5f6f8c', marginTop: '4px' }}>
                                📍 {aziendaSelezionata.indirizzo} • 📞 {aziendaSelezionata.telefono}
                            </p>
                        )}
                    </div>
                )}

                {/* Nuovo Cliente */}
                {form.tipoCliente === 'nuovo' && (
                    <div style={{
                        marginBottom: '15px',
                        padding: '15px',
                        background: '#f6f8fc',
                        borderRadius: '8px',
                        border: '1px solid #dfe5ef'
                    }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#1a2540' }}>
                            Dati Nuovo Cliente
                        </h4>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '13px' }}>
                                Nome Azienda / Cliente *
                            </label>
                            <input
                                type="text"
                                value={form.nuovoCliente.nome}
                                onChange={(e) => handleNuovoClienteChange('nome', e.target.value)}
                                disabled={userRole === 'consulente' && !!appuntamento}
                                placeholder="es. Azienda XYZ S.r.l."
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #dfe5ef',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '13px' }}>
                                Referente
                            </label>
                            <input
                                type="text"
                                value={form.nuovoCliente.contatto}
                                onChange={(e) => handleNuovoClienteChange('contatto', e.target.value)}
                                disabled={userRole === 'consulente' && !!appuntamento}
                                placeholder="Nome del referente"
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #dfe5ef',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '13px' }}>
                                Telefono
                            </label>
                            <input
                                type="tel"
                                value={form.nuovoCliente.telefono}
                                onChange={(e) => handleNuovoClienteChange('telefono', e.target.value)}
                                disabled={userRole === 'consulente' && !!appuntamento}
                                placeholder="es. 02 1234 5678"
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #dfe5ef',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '13px' }}>
                                Indirizzo
                            </label>
                            <input
                                type="text"
                                value={form.nuovoCliente.indirizzo}
                                onChange={(e) => handleNuovoClienteChange('indirizzo', e.target.value)}
                                disabled={userRole === 'consulente' && !!appuntamento}
                                placeholder="Via, città"
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #dfe5ef',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                    </div>
                )}

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '20px',
                    marginBottom: '30px'
                }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                            Data *
                        </label>
                        <input
                            type="date"
                            value={form.data}
                            onChange={(e) => handleChange('data', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #dfe5ef',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                            Ora *
                        </label>
                        <input
                            type="time"
                            value={form.ora}
                            onChange={(e) => handleChange('ora', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #dfe5ef',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                        Durata (minuti)
                    </label>
                    <select
                        value={form.durata}
                        onChange={(e) => handleChange('durata', parseInt(e.target.value))}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #dfe5ef',
                            borderRadius: '6px',
                            fontSize: '14px',
                            background: 'white'
                        }}
                    >
                        <option value="30">30 minuti</option>
                        <option value="60">1 ora</option>
                        <option value="90">1 ora e 30</option>
                        <option value="120">2 ore</option>
                        <option value="180">3 ore</option>
                        <option value="240">4 ore</option>
                    </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                        Tipo Appuntamento
                    </label>
                    <select
                        value={form.tipo}
                        onChange={(e) => handleChange('tipo', e.target.value)}
                        disabled={userRole === 'consulente' && !!appuntamento}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #dfe5ef',
                            borderRadius: '6px',
                            fontSize: '14px',
                            background: 'white'
                        }}
                    >
                        {tipiAppuntamento.map(tipo => (
                            <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                    </select>
                    <div style={{ marginTop: 10 }}>
                        <label style={{ fontSize: 13, fontWeight: 600 }}>
                            Aggiungi tipo personalizzato
                        </label>

                        <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                            <input
                                type="text"
                                value={nuovoTipo}
                                onChange={(e) => setNuovoTipo(e.target.value)}
                                placeholder="Es. Ispezione straordinaria"
                                style={{
                                    flex: 1,
                                    padding: 8,
                                    border: '1px solid #dfe5ef',
                                    borderRadius: 6,
                                    fontSize: 13
                                }}
                            />

                            <button
                                type="button"
                                onClick={aggiungiTipoAppuntamento}
                                style={{
                                    padding: '8px 12px',
                                    background: '#2c3e66',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 600
                                }}
                            >
                                + Aggiungi
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                        Consulente Assegnato
                    </label>
                    <select
                        value={form.consulente}
                        onChange={(e) => handleChange('consulente', e.target.value)}
                        disabled={userRole === 'consulente' && !!appuntamento}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #dfe5ef',
                            borderRadius: '6px',
                            fontSize: '14px',
                            background: 'white'
                        }}
                    >
                        <option value="">-- Seleziona consulente --</option>
                        {consulenti.map(cons => (
                            <option key={cons.id} value={cons.nome}>{cons.nome}</option>
                        ))}
                    </select>
                </div>

                {/* Campo motivazione modifica data/ora - Solo per consulenti in modifica */}
                {userRole === 'consulente' && appuntamento && (
                    <div style={{
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '15px'
                    }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#92400e' }}>
                            Motivazione Modifica Data/Ora
                        </label>
                        <textarea
                            value={motivazioneModifica}
                            onChange={(e) => setMotivazioneModifica(e.target.value)}
                            placeholder="Spiega perché stai modificando la data o l'ora dell'appuntamento..."
                            rows="2"
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #fde68a',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                        <p style={{ fontSize: '12px', color: '#92400e', margin: '4px 0 0' }}>
                            Obbligatorio se modifichi data o ora
                        </p>
                    </div>
                )}

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                        Stato
                    </label>
                    <select
                        value={form.stato}
                        onChange={(e) => handleChange('stato', e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #dfe5ef',
                            borderRadius: '6px',
                            fontSize: '14px',
                            background: 'white'
                        }}
                    >
                        {statiAppuntamento.map(stato => (
                            <option key={stato} value={stato}>{stato}</option>
                        ))}
                    </select>
                </div>

                {form.stato === 'Disdetto' && (
                    <div style={{ marginBottom: '15px', background: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#dc2626' }}>
                            Motivazione Disdetta *
                        </label>
                        <textarea
                            value={form.motivazioneDisdetta}
                            onChange={(e) => handleChange('motivazioneDisdetta', e.target.value)}
                            rows="3"
                            placeholder="Indica il motivo della disdetta..."
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                        Note
                    </label>
                    <textarea
                        value={form.note}
                        onChange={(e) => handleChange('note', e.target.value)}
                        rows="3"
                        placeholder="Note aggiuntive sull'appuntamento..."
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

                {/* Log Modifiche - Solo Admin */}
                {userRole === 'admin' && appuntamento?.logModifiche && appuntamento.logModifiche.length > 0 && (
                    <div style={{
                        marginBottom: '20px',
                        background: '#eef1f8',
                        border: '1px solid #c3cde3',
                        borderRadius: '8px',
                        padding: '15px'
                    }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#2c3e66', fontWeight: 'bold' }}>
                            📋 Storico Modifiche
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {appuntamento.logModifiche.map((log, index) => (
                                <div key={index} style={{
                                    background: 'white',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #dde3f0'
                                }}>
                                    <div style={{ fontSize: '12px', color: '#5f6f8c', marginBottom: '4px' }}>
                                        {new Date(log.timestamp).toLocaleString('it-IT')} - <strong>{log.consulente}</strong>
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#1a2540', marginBottom: '4px' }}>
                                        {log.modifiche.map((mod, i) => (
                                            <div key={i}>• {mod}</div>
                                        ))}
                                    </div>
                                    {log.motivazione && (
                                        <div style={{
                                            fontSize: '12px',
                                            color: '#2c3e66',
                                            fontStyle: 'italic',
                                            marginTop: '6px',
                                            paddingLeft: '12px',
                                            borderLeft: '3px solid #4a68a0'
                                        }}>
                                            💬 Motivazione: {log.motivazione}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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
                        style={{
                            padding: '10px 20px',
                            border: 'none',
                            borderRadius: '8px',
                            background: '#2c3e66',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        Salva
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ModaleAppuntamento;