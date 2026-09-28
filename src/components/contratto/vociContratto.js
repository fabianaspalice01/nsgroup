// Voci del modulo «Contratto di consulenza» NS Consulting, nell'ordine e con i codici del modulo cartaceo.
// opzioni: caselle da spuntare stampate accanto alla voce · testo: campo libero (es. rif. o.d.s.)
// prezzoFisso: prezzo già stampato sul modulo · senzaPrezzo: righe «urgenza» che si firmano soltanto
// perDipendente: il prezzo è a dipendente (o a corsista)

const LIVELLI3 = ['basso', 'medio', 'alto'];
const FREQUENZE = ['trimestrali', 'semestrali', 'annui'];
const urgenza = (cod) => ({ cod, label: 'Urgenza', testo: 'rif. o.d.s. n.', senzaPrezzo: true });

export const AREE = [
  { cod: '1', titolo: 'AREA DOCUMENTAZIONE TECNICA SICUREZZA SUL LAVORO', colonna: 0, voci: [
    { cod: '1.01', label: 'Sopralluogo' },
    { cod: '1.02', label: 'Documento di Valutazione dei Rischi Aziendali' },
    { cod: '1.03', label: 'Valutazione Specifica Stress da Lavoro Correlato (periodico - a dipendente)', perDipendente: true },
    { cod: '1.04', label: 'Valutazione Specifica Fonometrica delle Attrezzature' },
    { cod: '1.05', label: 'Valutazione Specifica Rischio Vibrazioni (HAV-WBV)' },
    { cod: '1.06', label: 'Valutazione Specifica Rischio Chimico' },
    { cod: '1.07', label: 'Valutazione Specifica Movimentazione Manuale dei Carichi' },
    { cod: '1.08', label: 'Valutazione Specifica Esposizione ad Agenti Biologici (periodico)' },
    { cod: '1.09', label: 'Valutazione Specifica Attrezzature fornite di Videoterminali' },
    { cod: '1.10', label: 'Valutazione Specifica Esposizione Microclimatica' },
    { cod: '1.11', label: 'Valutazione Specifica Rischio Incendio' },
    { cod: '1.12', label: 'Valutazione Specifica Esposizione Radiazioni Ottiche Artificiali R.O.A' },
    { cod: '1.13', label: 'Documento di Valutazione dei Rischi con Procedure Standardizzate' },
    { cod: '1.14', label: 'Piano di Emergenza ed Evacuazione' },
    { cod: '1.15', label: 'Piano di Emergenza ed Evacuazione compreso Rilievo Tecnico' },
    { cod: '1.16', label: 'Documento Unico di Valutazione Rischio Interferenze (D.U.V.R.I.)' },
    { cod: '1.17', label: 'Rilievo e Redazione Planimetria per D.I.A. Sanitaria' },
    { cod: '1.18', label: 'Revisione Documentazione', testo: 'rif. o.d.s. n.' },
    { cod: '1.19', label: 'Assistenza o intervento c/o Enti di Sorveglianza o Uffici Competenti (ad intervento)' },
    { cod: '1.20', label: 'Altro', testo: 'descrizione' },
    urgenza('1.21'),
  ] },
  { cod: '2', titolo: 'AREA MEDICINA DEL LAVORO', colonna: 0, voci: [
    { cod: '2.01', label: 'Sorveglianza sanitaria (preventiva e periodica) a dipendente', perDipendente: true },
    { cod: '2.02', label: 'Prelievi o altri test richiesti dal protocollo sanitario (costo aggiuntivo)' },
  ] },
  { cod: '3', titolo: 'AREA CORSI DI FORMAZIONE PROFESSIONALE TECNICA', colonna: 0, voci: [
    { cod: '3.01', label: 'Resp.le Servizio di Prev.ne e Prot.ne (R.S.P.P.)', opzioni: LIVELLI3 },
    { cod: '3.02', label: 'Aggiornamento R.S.P.P.', opzioni: LIVELLI3 },
    { cod: '3.03', label: 'Rappresentante dei Lavoratori per la Sicurezza (R.L.S.)' },
    { cod: '3.04', label: 'Aggiornamento Annuale R.L.S.', opzioni: ['4 ore', '8 ore'] },
    { cod: '3.05', label: 'Addetto al Primo Soccorso (P.P.S.)' },
    { cod: '3.06', label: 'Addetto alla Gestione Emergenza Antincendio (G.E.A.)', opzioni: ['basso', 'medio'] },
    { cod: '3.07', label: 'Formazione Specifica (art. 37 D.Lgs. 81/08) (a dip.te)', opzioni: LIVELLI3, perDipendente: true },
    { cod: '3.08', label: 'Aggiornamento Formazione Specifica (art. 37 D.Lgs. 81/08) (a dipendente)', perDipendente: true },
    { cod: '3.09', label: "Verbale d'informazione (art. 36 D.Lgs. 81/08) (a dipendente)", perDipendente: true },
    { cod: '3.10', label: 'Coordinatore della Sicurezza' },
    { cod: '3.11', label: 'Aggiornamento per Coordinatore della Sicurezza' },
    { cod: '3.12', label: 'Ponteggiatore' },
    { cod: '3.13', label: 'Addetto ai Lavori in Quota' },
    { cod: '3.14', label: 'Addetto ai Lavori in Ambienti Confinati' },
    { cod: '3.15', label: "Corso di Abilitazione all'utilizzo di:", titoletto: true },
    { cod: '3.15a', label: 'Gru', opzioni: ['a torre', 'autocarrata'], rientro: true },
    { cod: '3.15b', label: 'Carrello Elevatore / Muletto', rientro: true },
    { cod: '3.15c', label: 'Trattore', rientro: true },
    { cod: '3.15d', label: 'Escavatore', rientro: true },
    { cod: '3.15e', label: 'Piattaforme Aeree', rientro: true },
    { cod: '3.15f', label: 'Beton Pompe', rientro: true },
    { cod: '3.16', label: "Prova Pratica all'utilizzo di:", testo: 'mezzo' },
    { cod: '3.17', label: 'P.E.S./P.A.V./P.E.I.' },
    { cod: '3.18', label: 'Formazione Stress Lavoro-Correlato' },
    { cod: '3.19', label: 'Preposti e Dirigenti Aziendali' },
    { cod: '3.20', label: 'Operatore Basic Life Support Defibrillation (B.L.S.D.)' },
    { cod: '3.21', label: 'Assistenza 1° Accesso a Corso Online (a corsista)', prezzoFisso: 50, perDipendente: true },
    { cod: '3.22', label: 'Altro', testo: 'descrizione' },
  ] },
  { cod: '4', titolo: 'AREA AFFIDAMENTO INCARICO', colonna: 1, voci: [
    { cod: '4.01', label: 'R.S.P.P. non datore di lavoro (annuale)' },
    { cod: '4.02', label: 'Coordinatore in fase di progettazione' },
    { cod: '4.03', label: 'Coordinatore in fase di esecuzione (annuale)' },
  ] },
  { cod: '5', titolo: 'AREA DOCUMENTAZIONE CANTIERISTICA SICUREZZA SUL LAVORO', colonna: 1, voci: [
    { cod: '5.01', label: 'Piano Operativo di Sicurezza (P.O.S.)' },
    { cod: '5.02', label: 'Revisione P.O.S. (cad.)', prezzoFisso: 40 },
    { cod: '5.03', label: 'Piano di Uso Montaggio e Smontaggio del Ponteggio (Pi.M.U.S.)' },
    { cod: '5.04', label: 'Revisione Pi.M.U.S. (cad.)', prezzoFisso: 40 },
    { cod: '5.05', label: 'Piano di Sicurezza e Coordinamento (P.S.C.)' },
    { cod: '5.06', label: 'Piano Sostitutivo di Sicurezza (P.S.S.)' },
    { cod: '5.07', label: 'Relazione Tecnica e Verifica Strutturale Ponteggio' },
    { cod: '5.08', label: 'Verifica Strutturale Ponteggio' },
    { cod: '5.09', label: 'Sopralluogo' },
    { cod: '5.10', label: 'Erogazione Servizi (costo annuale)', testo: 'rif. o.d.s. n.' },
    { cod: '5.11', label: 'Altro', testo: 'descrizione' },
    urgenza('5.12'),
  ] },
  { cod: '6', titolo: 'AREA DOCUMENTAZIONE IGIENE ALIMENTARE (H.A.C.C.P.)', colonna: 1, voci: [
    { cod: '6.01', label: 'Sopralluogo' },
    { cod: '6.02', label: 'D.I.A. Sanitaria' },
    { cod: '6.03', label: 'Relazione Processo Produttivo' },
    { cod: '6.04', label: 'Manuale di Autocontrollo' },
    { cod: '6.05', label: 'Manuale con Procedure di Rintracciabilità' },
    { cod: '6.06', label: 'Registro Autocontrollo' },
    { cod: '6.07', label: 'Tamponi Superficiali', opzioni: FREQUENZE },
    { cod: '6.08', label: 'Analisi Prodotto', opzioni: FREQUENZE },
    { cod: '6.09', label: 'Analisi Prodotto con Prelievo in più Aliquote' },
    { cod: '6.10', label: 'Shelf Life' },
    { cod: '6.11', label: 'Analisi Acqua', opzioni: FREQUENZE },
    { cod: '6.12', label: 'Book Allergeni' },
    { cod: '6.13', label: 'Erogazione Servizi (costo annuale)', testo: 'rif. o.d.s. n.' },
    { cod: '6.14', label: 'Altro', testo: 'descrizione' },
    urgenza('6.15'),
  ] },
  { cod: '7', titolo: 'AREA CORSI DI FORMAZIONE PROFESSIONALE IGIENE ALIMENTARE (H.A.C.C.P.)', colonna: 1, voci: [
    { cod: '7.01', label: 'Corso per Personale Alimentarista', opzioni: ['LIV.1', 'LIV.2'] },
    { cod: '7.02', label: 'Corso per Responsabile Autocontrollo R.I.A.' },
    { cod: '7.03', label: 'Erogazione Servizi (costo annuale)', testo: 'rif. o.d.s. n.' },
    { cod: '7.04', label: 'Assistenza 1° Accesso a Corso Online (a corsista)', prezzoFisso: 50, perDipendente: true },
    { cod: '7.05', label: 'Somministrazione Alimenti e Bevande S.A.B.' },
    { cod: '7.06', label: 'Altro', testo: 'descrizione' },
    urgenza('7.07'),
  ] },
  { cod: '8', titolo: 'AREA PRIVACY', colonna: 1, voci: [
    { cod: '8.01', label: 'Manuale Trattamento Dati (emissione e revisione annuale)' },
    { cod: '8.02', label: 'Assistenza per conseguimento Autorizzazione Videosorveglianza' },
    { cod: '8.03', label: 'Sopralluogo' },
    { cod: '8.04', label: 'Altro', testo: 'descrizione' },
    urgenza('8.05'),
    { cod: '8.06', label: 'Registro attività' },
    { cod: '8.07', label: "Lettere d'incarico" },
  ] },
  { cod: '9', titolo: 'AREA PREVENZIONE INCENDIO E ANTINFORTUNISTICA', colonna: 2, voci: [
    { cod: '9.01', label: 'Consulenza per il Rilascio del Certificato di Prevenzione Incendi (C.P.I.)' },
    { cod: '9.02a', label: 'Parere di Conformità Antincendio', rientro: true },
    { cod: '9.02b', label: 'Direzione Lavori', rientro: true },
    { cod: '9.02c', label: 'Rilascio', rientro: true },
    { cod: '9.03', label: 'Consulenza per Rinnovo C.P.I.' },
    { cod: '9.04', label: 'Consulenza per Verifica di Impianto di Messa a Terra (emissione e rinnovo)', testo: 'KW' },
    { cod: '9.05', label: 'Estintore a polvere', testo: 'mod. / n° pz.' },
    { cod: '9.06', label: 'Estintore a CO2', testo: 'mod. / n° pz.' },
    { cod: '9.07', label: 'Manutenzione Semestrale Estintori' },
    { cod: '9.08', label: 'Cassetta Pronto Soccorso', opzioni: ['1-2 dip.', '3 dip.'] },
    { cod: '9.09', label: 'Cartellonistica' },
    { cod: '9.10', label: 'Altro', testo: 'descrizione' },
  ] },
  { cod: '10', titolo: 'AREA DOCUMENTAZIONE TUTELA AMBIENTALE', colonna: 2, voci: [
    { cod: '10.01', label: 'Sopralluogo' },
    { cod: '10.02', label: 'Consulenza e Analisi per autorizzazione alle emissioni in atmosfera' },
    { cod: '10.03', label: 'Consulenza e Analisi per Valutazione Rischio Polveri Sottili' },
    { cod: '10.04', label: 'Rilievo per Valutazione Impatto Acustico' },
    { cod: '10.05', label: 'Previsione di Impatto Acustico (Lg. 447/95)' },
    { cod: '10.06', label: 'Igiene ambienti', opzioni: ['Sanificazione', 'Disinfestazione', 'Deblattizzazione'] },
    { cod: '10.07', label: 'Consulenza e Analisi per Autorizzazione allo Smaltimento Acque Reflue Depurate' },
    { cod: '10.08', label: 'Consulenza e Analisi per Autorizzazione allo Smaltimento Acque Reflue Meteoriche' },
    { cod: '10.09', label: 'Consulenza per Gestione Rifiuti' },
    { cod: '10.11', label: 'Certificazione Energetica dei Fabbricati D.Lgs. 311/06' },
    { cod: '10.12', label: 'Altro', testo: 'descrizione' },
  ] },
  { cod: '11', titolo: 'AREA SISTEMI DI GESTIONE E CERTIFICAZIONI', colonna: 2, voci: [
    { cod: '11.01', label: 'Sopralluogo / Audit iniziale' },
    { cod: '11.02', label: 'Sistema di Gestione UNI EN-ISO 9001:2015' },
    { cod: '11.02a', label: 'Consulenza per Ottenimento Certificazione e Rinnovo', rientro: true },
    { cod: '11.02b', label: 'Mantenimento Annuale', rientro: true },
    { cod: '11.03', label: 'Sistema di Gestione UNI EN-ISO 14001:2015' },
    { cod: '11.03a', label: 'Consulenza per Ottenimento Certificazione e Rinnovo', rientro: true },
    { cod: '11.03b', label: 'Mantenimento Annuale', rientro: true },
    { cod: '11.04', label: 'Sistema di Gestione della Sicurezza sul Lavoro (SGSSL) ISO 45001' },
    { cod: '11.04a', label: 'Consulenza per Ottenimento Certificazione e Rinnovo', rientro: true },
    { cod: '11.04b', label: 'Mantenimento Annuale', rientro: true },
    { cod: '11.05', label: 'Sistema di Gestione per la Sicurezza Alimentare UNI EN-ISO 22000' },
    { cod: '11.05a', label: 'Consulenza per Ottenimento Certificazione e Rinnovo', rientro: true },
    { cod: '11.05b', label: 'Mantenimento Annuale', rientro: true },
    { cod: '11.06', label: 'Sistema di Gestione Marcatura CE UNI EN-1090' },
    { cod: '11.06a', label: 'Consulenza per Ottenimento Certificazione e Rinnovo', rientro: true },
    { cod: '11.06b', label: 'Mantenimento Annuale', rientro: true },
    { cod: '11.07', label: 'Sistema di gestione SA 8000' },
    { cod: '11.07a', label: 'Consulenza per Ottenimento Certificazione e Rinnovo', rientro: true },
    { cod: '11.07b', label: 'Mantenimento Annuale', rientro: true },
    { cod: '11.08', label: 'Consulenza per Attestazione SOA (D.P.R. 207/2010)' },
    { cod: '11.09', label: 'Certificazione IFS-BRC' },
    { cod: '11.10', label: 'Altro', testo: 'descrizione' },
  ] },
  { cod: '12', titolo: 'AREA ASSISTENZA', colonna: 2, voci: [
    { cod: '12.01', label: 'Assistenza documentale tramite portale online' },
    { cod: '12.02', label: 'Assistenza telefonica: un consulente disponibile al numero aziendale per informazioni sulle normative del contratto' },
    { cod: '12.03', label: 'Consulenza legale' },
  ] },
];

export const TUTTE_LE_VOCI = AREE.flatMap((a) => a.voci);

// Servizi del preventivo → voce del contratto (prima corrispondenza trovata nella descrizione)
const DAL_PREVENTIVO = [
  [/^DVR/i, '1.02'],
  [/RSPP/i, '3.01'],
  [/\bRLS\b/i, '3.03'],
  [/PREPOSTO/i, '3.19'],
  [/ANTINCENDIO \(prevenzione/i, '3.06'],
  [/PRIMO SOCCORSO/i, '3.05'],
  [/FORMAZIONE&INFORMAZIONE|FORMAZIONE E INFORMAZIONE/i, '3.07'],
  [/VISITE MEDICHE|SORVEGLIANZA/i, '2.01'],
  [/^HACCP/i, '6.04'],
  [/ALIMENTARISTA lv 1/i, '7.01', 'LIV.1'],
  [/ALIMENTARISTA lv 2/i, '7.01', 'LIV.2'],
  [/FORNITURA MATERIALE ANTINCENDIO/i, '9.10'],
];

// Stato iniziale delle voci a partire dai servizi di un preventivo
export function vociDaPreventivo(servizi = []) {
  const voci = {};
  const altri = [];
  for (const s of servizi) {
    const q = parseFloat(s.quantita) || 0;
    if (!(q > 0) || !String(s.descrizione || '').trim()) continue;
    const prezzoUnit = s.omaggio ? 0 : parseFloat(s.prezzoUnitario) || 0;
    const regola = DAL_PREVENTIVO.find(([rx]) => rx.test(s.descrizione));
    if (!regola) { altri.push(s); continue; }
    const [, cod, opz] = regola;
    const v = TUTTE_LE_VOCI.find((x) => x.cod === cod);
    const prezzo = v.perDipendente ? prezzoUnit : prezzoUnit * q;
    const prima = voci[cod];
    voci[cod] = {
      sel: true,
      prezzo: String(Math.round(((prima && !v.perDipendente ? parseFloat(prima.prezzo) || 0 : 0) + prezzo) * 100) / 100),
      opzioni: [...new Set([...(prima?.opzioni || []), ...(opz ? [opz] : [])])],
      testo: cod === '9.10' ? s.descrizione : prima?.testo || '',
    };
  }
  if (altri.length) {
    voci['1.20'] = {
      sel: true,
      prezzo: String(Math.round(altri.reduce((t, s) => t + (s.omaggio ? 0 : (parseFloat(s.prezzoUnitario) || 0) * (parseFloat(s.quantita) || 0)), 0) * 100) / 100),
      opzioni: [],
      testo: altri.map((s) => s.descrizione).join(', '),
    };
  }
  return voci;
}

export const CONDIZIONI_PREMESSA = [
  'NSconsulting srl, nella persona del suo legale rappresentante p.t., mediante la sottoscrizione del presente modulo, dichiara sotto la propria esclusiva responsabilità di:',
  '- essere espressamente autorizzata dal cliente finale alla richiesta dei servizi ivi indicati in suo nome e conto;',
  '- essere espressamente autorizzata dal cliente finale alla trasmissione e al trattamento dei dati personali in conformità a quanto previsto dal D.Lgs. 196/2003;',
  '- di aver verificato il possesso, in capo al cliente finale, di tutti i requisiti necessari ai fini della corretta erogazione dei servizi.',
];

export const CLAUSOLA_FINALE = 'Ai sensi degli art.1341 e seg. Cod. Civile le parti dichiarano che le clausole contenute nel presente contratto sono state oggetto di trattativa e da entrambe realizzate ed accettano incondizionatamente quanto stabilito nelle condizioni contrattuali ai punti a (costo di attivazione), b (sorveglianza sanitaria), c (pagamenti fatture) d (mancato pagamento nei termini), e (trasmissione documentazioni), f (validità contratto, penale), g (tacito rinnovo-disdetta), h (cessione a terzi), i (foro competente) e quanto stabilito nella specifica del servizio, dell\'importo totale del servizio e delle modalità di pagamento. Le parti confermano che per qualsiasi controversia il foro competente a giudicare è il Foro di Napoli. Ai sensi del REG UE 679/2016 si Autorizza il trattamento dei dati personali e aziendali.';

const eur = (v) => (Number(v) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Condizioni A-L con i valori del contratto
export function condizioni(c) {
  const vuoto = '______';
  return [
    ['A', `IL COSTO DI ATTIVAZIONE DELLA PRATICA è DI € ${c.costoAttivazione ? eur(c.costoAttivazione) : vuoto} + iva una tantum.`],
    ['B', `Per ogni lavoratore dipendente è stabilito un pacchetto agevolato "Sorveglianza Sanitaria" al costo di € ${c.costoSorveglianza ? eur(c.costoSorveglianza) : vuoto} + iva/cad. dipendente; nel caso il protocollo sanitario richieda l'effettuazione di prelievo o altri tipi di test, questi ultimi hanno costi a parte.`],
    ['C', `I pagamenti delle fatture dovranno essere effettuati al ricevimento della fattura, con fatturazione ${c.fatturazione === 'trimestrale' ? 'TRIMESTRALE ANTICIPATA' : 'MENSILE'}.`],
    ['D', 'Il mancato pagamento della fattura al ricevimento della stessa autorizza NSconsulting s.r.l. a richiedere, anche senza aver effettuato consulenze in AZIENDA, il pagamento dell\'importo totale della fattura, e non potrà mai essere ritenuto come una risoluzione contrattuale.'],
    ['E', 'Le documentazioni realizzate nel periodo di assistenza saranno trasmesse da NSconsulting s.r.l. al titolare in formato PDF a mezzo e-mail.'],
    ['F', `Il servizio di consulenza concordato nel presente contratto ha validità tre anni e non potrà essere annullato pena il pagamento di una penale del 100% del contratto complessivo (3 anni), più risarcimento di € ${c.risarcimento ? eur(c.risarcimento) : vuoto} per spese redazione documentazione.`],
    ['G', 'Il contratto si intende tacitamente rinnovato, alle stesse condizioni e per uguale periodo (3 anni) al termine dei tre anni, salvo disdetta da una delle parti con lettera raccomandata A/R da inviarsi al novantesimo giorno alla fine dei tre anni.'],
    ['H', 'NSconsulting s.r.l. è autorizzata a cedere il presente contratto a terzi.'],
    ['I', 'Per qualsiasi controversia il foro competente a giudicare è il foro di Napoli.'],
    ['L', `Allo scadere del terzo anno il canone mensile al rinnovo automatico per il mantenimento del WEB PORTAL passa a € ${c.canonePortale ? eur(c.canonePortale) : vuoto}.`],
  ];
}
