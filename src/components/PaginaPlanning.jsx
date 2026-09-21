import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import toast from 'react-hot-toast';

/* ── COSTANTI ─────────────────────────────────────────────────────────────── */
const STATI = [
  { id: 'da_fare',    label: 'Da fare',    color: '#45536f', bg: '#eef1f7', border: '#c9d1e0', icon: '⬜' },
  { id: 'in_corso',  label: 'In corso',   color: '#d97706', bg: '#fef3c7', border: '#fde68a', icon: '🟡' },
  { id: 'completato',label: 'Completato', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
];

const PRIORITA = [
  { id: 'alta',  label: 'Alta',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { id: 'media', label: 'Media', color: '#d97706', bg: '#fef9c3', border: '#fde68a' },
  { id: 'bassa', label: 'Bassa', color: '#34508a', bg: '#eef1f8', border: '#c3cde3' },
];

const GIORNI     = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const GIORNI_EXT = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

/* ── HELPERS ──────────────────────────────────────────────────────────────── */
const fmt = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const isoDate = (d) => d.toISOString().split('T')[0];

const lunediDella = (d) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const lun = new Date(d);
  lun.setDate(d.getDate() + diff);
  return lun;
};

const initials = (nome = '') =>
  nome.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

const avatarColor = (nome = '') => {
  const colors = ['#2c3e66','#4a90c2','#10b981','#f59e0b','#ec4899','#7a8fc0','#14b8a6'];
  let hash = 0;
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
  return colors[hash];
};

const useIsMobile = () => {
  const [mob, setMob] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMob(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mob;
};

/* ── BADGE PRIORITÀ ───────────────────────────────────────────────────────── */
function BadgePriorita({ priorita }) {
  const p = PRIORITA.find(x => x.id === priorita) || PRIORITA[1];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: p.bg, color: p.color, border: `1px solid ${p.border}`, borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>
      {p.label}
    </span>
  );
}

/* ── AVATAR OPERATORE ─────────────────────────────────────────────────────── */
function Avatar({ nome, size = 24 }) {
  const bg = avatarColor(nome);
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: bg, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, flexShrink: 0 }}>
      {initials(nome)}
    </span>
  );
}

/* ── CARD TASK ────────────────────────────────────────────────────────────── */
async function scaricaTuttiAllegati(allegati) {
  for (const a of allegati) {
    try {
      const res = await fetch(a.url, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.nome;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      await new Promise(r => setTimeout(r, 300));
    } catch {
      // se un file fallisce, continua con gli altri
    }
  }
}

function CardTask({ task, isAdmin, onEdit, onDelete, onChangeStato, userData, operatori, onAssegna }) {
  const oggi = isoDate(new Date());
  const scaduta = task.scadenza && task.scadenza < oggi && task.stato !== 'completato';
  const isOperatore = userData?.ruolo === 'operatore';
  const isMio = userData?.id && task.assegnatoA === userData.id;

  return (
    <div style={{
      background: isMio ? '#eef1f8' : 'white',
      border: `1px solid ${isMio ? '#93a7cc' : '#dfe5ef'}`,
      borderRadius: 10,
      padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <BadgePriorita priorita={task.priorita} />
        {(isAdmin || isOperatore) && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => onEdit(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa7bf', fontSize: 14, padding: '0 2px' }}>✏️</button>
            <button onClick={() => onDelete(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa7bf', fontSize: 14, padding: '0 2px' }}>🗑️</button>
          </div>
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2540', lineHeight: 1.3 }}>{task.titolo}</div>

      {task.descrizione && (
        <div style={{ fontSize: 12, color: '#5f6f8c', lineHeight: 1.4 }}>{task.descrizione}</div>
      )}

      {task.aziendaNome && (
        <div style={{ fontSize: 11, color: '#2c3e66', fontWeight: 600 }}>🏢 {task.aziendaNome}</div>
      )}

      {task.allegati?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 11, color: '#9aa7bf', fontWeight: 600 }}>{task.allegati.length} allegat{task.allegati.length === 1 ? 'o' : 'i'}</span>
            <button
              onClick={() => scaricaTuttiAllegati(task.allegati)}
              style={{ fontSize: 11, fontWeight: 700, color: '#2c3e66', background: '#eef1f8', border: '1px solid #c3cde3', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}
            >
              ⬇ Scarica tutti
            </button>
          </div>
          {task.allegati.map(a => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: '#2c3e66', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📎 {a.nome}
            </a>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {isOperatore ? (
            <select
              value={task.assegnatoA || ''}
              onChange={e => {
                const op = operatori?.find(o => o.id === e.target.value);
                onAssegna(task, e.target.value, op?.nome || '');
              }}
              style={{ fontSize: 12, border: '1px solid #dfe5ef', borderRadius: 6, padding: '3px 6px', background: 'white', color: '#374151', cursor: 'pointer', maxWidth: 150 }}
            >
              <option value="">— Non assegnato —</option>
              {(operatori || []).map(op => (
                <option key={op.id} value={op.id}>{op.nome}</option>
              ))}
            </select>
          ) : task.assegnatoNome ? (
            <>
              <Avatar nome={task.assegnatoNome} size={20} />
              <span style={{ fontSize: 11, color: '#45536f', fontWeight: 600 }}>{task.assegnatoNome}</span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: '#9aa7bf' }}>Non assegnato</span>
          )}
        </div>
        {task.scadenza && (
          <span style={{ fontSize: 11, fontWeight: 600, color: scaduta ? '#dc2626' : '#5f6f8c' }}>
            {scaduta ? '⚠️ ' : '📅 '}{fmt(task.scadenza)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        {STATI.map(s => (
          <button
            key={s.id}
            onClick={() => onChangeStato(task, s.id)}
            style={{
              flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 700,
              border: `1px solid ${task.stato === s.id ? s.color : '#dfe5ef'}`,
              borderRadius: 6, cursor: 'pointer',
              background: task.stato === s.id ? s.bg : 'white',
              color: task.stato === s.id ? s.color : '#9aa7bf',
              transition: 'all 0.15s',
            }}
          >{s.icon} {s.label}</button>
        ))}
      </div>
    </div>
  );
}

/* ── MODALE TASK ──────────────────────────────────────────────────────────── */
function ModaleTask({ task, operatori, onClose, onSave, isAdmin, isOperatore }) {
  const [form, setForm] = useState(task || {
    titolo: '', descrizione: '', assegnatoA: '', assegnatoNome: '',
    priorita: 'media', stato: 'da_fare', scadenza: '', aziendaNome: '',
  });
  const [allegatiEsistenti, setAllegatiEsistenti] = useState(task?.allegati || []);
  const [allegatiNuovi, setAllegatiNuovi] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleOperatore = (userId) => {
    const op = operatori.find(o => o.id === userId);
    set('assegnatoA', userId);
    set('assegnatoNome', op ? op.nome : '');
  };

  const handleAddFiles = (e) => {
    const files = Array.from(e.target.files);
    setAllegatiNuovi(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setAllegatiNuovi(prev => [...prev, ...files]);
  };

  const handleSave = () => {
    if (!form.titolo.trim()) { toast.error('Il titolo è obbligatorio'); return; }
    onSave({ ...form, allegatiNuovi, allegatiEsistenti });
  };

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #dfe5ef', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none' };
  const labelStyle = { display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 5, color: '#374151' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '90%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 22px', fontSize: 18 }}>{task ? '✏️ Modifica Task' : '➕ Nuovo Task'}</h2>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Titolo *</label>
          <input value={form.titolo} onChange={e => set('titolo', e.target.value)} style={inputStyle} placeholder="Es. Sopralluogo cantiere..." />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Descrizione</label>
          <textarea value={form.descrizione} onChange={e => set('descrizione', e.target.value)}
            rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Dettagli del task..." />
        </div>

        {(isAdmin || isOperatore) && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Assegnato a</label>
            <select value={form.assegnatoA} onChange={e => handleOperatore(e.target.value)} style={{ ...inputStyle, background: 'white' }}>
              <option value="">— Nessuno —</option>
              {operatori.map(op => <option key={op.id} value={op.id}>{op.nome} ({op.ruolo})</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Priorità</label>
            <select value={form.priorita} onChange={e => set('priorita', e.target.value)} style={{ ...inputStyle, background: 'white' }}>
              {PRIORITA.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Stato</label>
            <select value={form.stato} onChange={e => set('stato', e.target.value)} style={{ ...inputStyle, background: 'white' }}>
              {STATI.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Scadenza</label>
            <input type="date" value={form.scadenza} onChange={e => set('scadenza', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Azienda (opzionale)</label>
            <input value={form.aziendaNome} onChange={e => set('aziendaNome', e.target.value)} style={inputStyle} placeholder="Nome azienda..." />
          </div>
        </div>

        {/* Allegati */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Allegati</label>

          {allegatiEsistenti.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {allegatiEsistenti.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f6f8fc', border: '1px solid #dfe5ef', borderRadius: 6 }}>
                  <a href={a.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, color: '#2c3e66', textDecoration: 'none', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📎 {a.nome}
                  </a>
                  <button type="button" onClick={() => setAllegatiEsistenti(prev => prev.filter(x => x.id !== a.id))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {allegatiNuovi.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {allegatiNuovi.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#eef1f8', border: '1px solid #c3cde3', borderRadius: 6 }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#2c3e66', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {f.name}</span>
                  <button type="button" onClick={() => setAllegatiNuovi(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '18px 14px',
              border: `2px dashed ${isDragging ? '#2c3e66' : '#c9d1e0'}`,
              borderRadius: 10, cursor: 'pointer',
              background: isDragging ? '#eef1f8' : '#fafafa',
              color: isDragging ? '#2c3e66' : '#5f6f8c',
              fontSize: 13, fontWeight: 600,
              userSelect: 'none', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 22 }}>📎</span>
            <span>{isDragging ? 'Rilascia qui' : 'Trascina file qui oppure clicca per scegliere'}</span>
            <input type="file" multiple onChange={handleAddFiles} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14 }}>Annulla</button>
          <button onClick={handleSave} style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: '#2c3e66', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Salva</button>
        </div>
      </div>
    </div>
  );
}

/* ── KANBAN BOARD ─────────────────────────────────────────────────────────── */
function KanbanBoard({ tasks, operatori, isAdmin, onEdit, onDelete, onChangeStato, filtroOp, userData, onAssegna }) {
  const isMobile = useIsMobile();
  const [colAttiva, setColAttiva] = useState('da_fare');
  const [completatiAperti, setCompletatiAperti] = useState(false);
  const [futuriAperti, setFuturiAperti] = useState(false);

  const oggi = isoDate(new Date());
  const tasksFiltrati = filtroOp ? tasks.filter(t => t.assegnatoA === filtroOp) : tasks;

  // per "da_fare": separa quelli di oggi/passati/senza data da quelli futuri
  const daFareVisibili = tasksFiltrati.filter(t => t.stato === 'da_fare' && (!t.scadenza || t.scadenza <= oggi));
  const daFareFuturi   = tasksFiltrati.filter(t => t.stato === 'da_fare' && t.scadenza && t.scadenza > oggi);

  if (isMobile) {
    const col = tasksFiltrati.filter(t => t.stato === colAttiva);
    const isCompletato = colAttiva === 'completato';
    const isDaFare = colAttiva === 'da_fare';
    return (
      <div>
        {/* Selettore colonna */}
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #dfe5ef', marginBottom: 16 }}>
          {STATI.map((s, i) => {
            const count = tasksFiltrati.filter(t => t.stato === s.id).length;
            const active = colAttiva === s.id;
            return (
              <button
                key={s.id}
                onClick={() => { setColAttiva(s.id); if (s.id === 'completato') setCompletatiAperti(true); }}
                style={{
                  flex: 1, padding: '11px 4px', border: 'none',
                  borderRight: i < 2 ? '1px solid #dfe5ef' : 'none',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: active ? s.bg : 'white',
                  color: active ? s.color : '#9aa7bf',
                  transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}
              >
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span>{s.label}</span>
                <span style={{
                  background: active ? s.color : '#dfe5ef',
                  color: active ? 'white' : '#9aa7bf',
                  borderRadius: 8, padding: '0 6px', fontSize: 10, fontWeight: 800,
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Cards della colonna attiva */}
        {isCompletato && !completatiAperti ? (
          <div
            onClick={() => setCompletatiAperti(true)}
            style={{ textAlign: 'center', padding: '22px 0', color: '#059669', fontSize: 13, fontWeight: 600, background: '#f0fdf4', borderRadius: 10, border: '1px dashed #bbf7d0', cursor: 'pointer' }}
          >
            ✅ {col.length} task completati — clicca per espandere
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isDaFare ? (
              <>
                {daFareVisibili.length === 0 && daFareFuturi.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: '#c9d1e0', fontSize: 13, background: '#f6f8fc', borderRadius: 10, border: '1px dashed #dfe5ef' }}>Nessun task</div>
                )}
                {daFareVisibili.map(task => (
                  <CardTask key={task.id} task={task} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} onChangeStato={onChangeStato} userData={userData} operatori={operatori} onAssegna={onAssegna} />
                ))}
                {daFareFuturi.length > 0 && (
                  <>
                    <div
                      onClick={() => setFuturiAperti(v => !v)}
                      style={{ textAlign: 'center', padding: '14px 0', color: '#34508a', fontSize: 13, fontWeight: 600, background: '#eef1f8', borderRadius: 10, border: '1px dashed #c3cde3', cursor: 'pointer' }}
                    >
                      📅 {daFareFuturi.length} task futuri — {futuriAperti ? 'nascondi ▲' : 'mostra ▼'}
                    </div>
                    {futuriAperti && daFareFuturi.map(task => (
                      <CardTask key={task.id} task={task} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} onChangeStato={onChangeStato} userData={userData} operatori={operatori} onAssegna={onAssegna} />
                    ))}
                  </>
                )}
              </>
            ) : (
              col.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#c9d1e0', fontSize: 13, background: '#f6f8fc', borderRadius: 10, border: '1px dashed #dfe5ef' }}>
                  Nessun task
                </div>
              ) : col.map(task => (
                <CardTask key={task.id} task={task} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} onChangeStato={onChangeStato} userData={userData} operatori={operatori} onAssegna={onAssegna} />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── DESKTOP ── */
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {STATI.map(stato => {
        const col = tasksFiltrati.filter(t => t.stato === stato.id);
        const isCompletato = stato.id === 'completato';
        const isDaFare = stato.id === 'da_fare';
        return (
          <div key={stato.id}>
            <div
              onClick={isCompletato ? () => setCompletatiAperti(v => !v) : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                background: stato.bg, border: `1px solid ${stato.border}`,
                borderRadius: completatiAperti || !isCompletato ? '10px 10px 0 0' : 10,
                cursor: isCompletato ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 16 }}>{stato.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: stato.color }}>{stato.label}</span>
              <span style={{ marginLeft: 'auto', background: stato.color, color: 'white', borderRadius: 10, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>{col.length}</span>
              {isCompletato && (
                <span style={{ fontSize: 12, color: stato.color, marginLeft: 4 }}>{completatiAperti ? '▲' : '▼'}</span>
              )}
            </div>
            {(!isCompletato || completatiAperti) && (
              <div style={{
                background: '#f6f8fc', border: `1px solid ${stato.border}`, borderTop: 'none',
                borderRadius: '0 0 10px 10px', padding: 10,
                display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120,
              }}>
                {isDaFare ? (
                  <>
                    {daFareVisibili.length === 0 && daFareFuturi.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: '#c9d1e0', fontSize: 13 }}>Nessun task</div>
                    )}
                    {daFareVisibili.map(task => (
                      <CardTask key={task.id} task={task} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} onChangeStato={onChangeStato} userData={userData} operatori={operatori} onAssegna={onAssegna} />
                    ))}
                    {daFareFuturi.length > 0 && (
                      <>
                        <div
                          onClick={() => setFuturiAperti(v => !v)}
                          style={{ textAlign: 'center', padding: '10px 0', color: '#34508a', fontSize: 12, fontWeight: 600, background: '#eef1f8', borderRadius: 8, border: '1px dashed #c3cde3', cursor: 'pointer', userSelect: 'none' }}
                        >
                          📅 {daFareFuturi.length} task futuri {futuriAperti ? '▲' : '▼'}
                        </div>
                        {futuriAperti && daFareFuturi.map(task => (
                          <CardTask key={task.id} task={task} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} onChangeStato={onChangeStato} userData={userData} operatori={operatori} onAssegna={onAssegna} />
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  col.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#c9d1e0', fontSize: 13 }}>Nessun task</div>
                  ) : col.map(task => (
                    <CardTask key={task.id} task={task} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} onChangeStato={onChangeStato} userData={userData} operatori={operatori} onAssegna={onAssegna} />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── PLANNING SETTIMANALE ─────────────────────────────────────────────────── */
function PlanningSettimanale({ tasks, operatori }) {
  const isMobile = useIsMobile();
  const [lunedi, setLunedi] = useState(() => lunediDella(new Date()));
  const oggi = isoDate(new Date());

  const giorni = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunedi);
    d.setDate(lunedi.getDate() + i);
    return d;
  });

  const oggiIdx = giorni.findIndex(g => isoDate(g) === oggi);
  const [giornoAttivo, setGiornoAttivo] = useState(() => oggiIdx >= 0 ? oggiIdx : 0);

  const prevSettimana = () => { const d = new Date(lunedi); d.setDate(d.getDate() - 7); setLunedi(d); setGiornoAttivo(0); };
  const nextSettimana = () => { const d = new Date(lunedi); d.setDate(d.getDate() + 7); setLunedi(d); setGiornoAttivo(0); };
  const oggiSettimana = () => { setLunedi(lunediDella(new Date())); };

  const tasksPerOp = (opId, giorno) =>
    tasks.filter(t => t.assegnatoA === opId && t.scadenza === isoDate(giorno));

  const tasksNonAssegnati = (giorno) =>
    tasks.filter(t => !t.assegnatoA && t.scadenza === isoDate(giorno));

  /* ── NAV SETTIMANA (comune) ── */
  const NavSettimana = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <button onClick={prevSettimana} style={{ padding: '7px 14px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>←</button>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2540', flex: 1, textAlign: 'center', minWidth: 160 }}>
        {lunedi.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} – {giorni[6].toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
      <button onClick={nextSettimana} style={{ padding: '7px 14px', border: '1px solid #dfe5ef', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>→</button>
      <button onClick={oggiSettimana} style={{ padding: '7px 14px', border: '1px solid #2c3e66', borderRadius: 8, background: '#2c3e66', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Oggi</button>
    </div>
  );

  /* ── VISTA MOBILE ── */
  if (isMobile) {
    const gSelezionato = giorni[giornoAttivo];
    const tasksDelGiorno = tasks.filter(t => t.scadenza === isoDate(gSelezionato));

    return (
      <div>
        <NavSettimana />

        {/* Strip 7 giorni */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {giorni.map((g, i) => {
            const isOggi = isoDate(g) === oggi;
            const isSelected = giornoAttivo === i;
            const conta = tasks.filter(t => t.scadenza === isoDate(g)).length;
            return (
              <button
                key={i}
                onClick={() => setGiornoAttivo(i)}
                style={{
                  flexShrink: 0, width: 46,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '8px 4px 6px', borderRadius: 12,
                  border: `2px solid ${isSelected ? '#2c3e66' : isOggi ? '#c3cde3' : '#dfe5ef'}`,
                  background: isSelected ? '#2c3e66' : isOggi ? '#eef1f8' : 'white',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? 'white' : isOggi ? '#2c3e66' : '#9aa7bf', textTransform: 'uppercase' }}>{GIORNI[i]}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: isSelected ? 'white' : isOggi ? '#2c3e66' : '#1a2540', lineHeight: 1 }}>{g.getDate()}</span>
                {conta > 0 && (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.4)' : '#2c3e66', color: 'white', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{conta}</span>
                )}
                {conta === 0 && <span style={{ width: 16, height: 16 }} />}
              </button>
            );
          })}
        </div>

        {/* Intestazione giorno */}
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2540', marginBottom: 14 }}>
          {GIORNI_EXT[giornoAttivo]} {fmt(isoDate(gSelezionato))}
        </div>

        {/* Task per operatore */}
        {tasksDelGiorno.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#c9d1e0', fontSize: 14, background: '#f6f8fc', borderRadius: 12, border: '1px dashed #dfe5ef' }}>
            Nessun task per questo giorno
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {operatori.map(op => {
              const tOp = tasksPerOp(op.id, gSelezionato);
              if (tOp.length === 0) return null;
              return (
                <div key={op.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Avatar nome={op.nome} size={30} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2540' }}>{op.nome}</div>
                      <div style={{ fontSize: 10, color: '#9aa7bf', textTransform: 'capitalize' }}>{op.ruolo}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 38 }}>
                    {tOp.map(t => {
                      const p = PRIORITA.find(x => x.id === t.priorita) || PRIORITA[1];
                      const scaduta = t.scadenza < oggi && t.stato !== 'completato';
                      const stato = STATI.find(s => s.id === t.stato);
                      return (
                        <div key={t.id} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <BadgePriorita priorita={t.priorita} />
                            {stato && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: stato.color, background: stato.bg, border: `1px solid ${stato.border}`, borderRadius: 4, padding: '1px 6px' }}>
                                {stato.icon} {stato.label}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2540', marginBottom: t.aziendaNome ? 4 : 0 }}>{t.titolo}</div>
                          {t.descrizione && <div style={{ fontSize: 11, color: '#5f6f8c', marginBottom: 4 }}>{t.descrizione}</div>}
                          {t.aziendaNome && <div style={{ fontSize: 11, color: '#2c3e66', fontWeight: 600 }}>🏢 {t.aziendaNome}</div>}
                          {scaduta && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>⚠️ Scaduto</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Non assegnati */}
            {tasksNonAssegnati(gSelezionato).map(t => {
              const p = PRIORITA.find(x => x.id === t.priorita) || PRIORITA[1];
              return (
                <div key={t.id} style={{ background: '#f6f8fc', border: '1px solid #dfe5ef', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: '#9aa7bf', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Non assegnato</div>
                  <BadgePriorita priorita={t.priorita} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#45536f', marginTop: 4 }}>{t.titolo}</div>
                  {t.aziendaNome && <div style={{ fontSize: 11, color: '#2c3e66', fontWeight: 600, marginTop: 2 }}>🏢 {t.aziendaNome}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ── VISTA DESKTOP ── */
  return (
    <div>
      <NavSettimana />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ width: 130, padding: '10px 12px', background: '#f6f8fc', border: '1px solid #dfe5ef', borderRadius: '8px 0 0 0', fontSize: 12, color: '#5f6f8c', textAlign: 'left', fontWeight: 700 }}>
                Operatore
              </th>
              {giorni.map((g, i) => {
                const isOggi = isoDate(g) === oggi;
                return (
                  <th key={i} style={{
                    padding: '10px 6px', textAlign: 'center',
                    background: isOggi ? '#eef1f8' : '#f6f8fc',
                    border: '1px solid #dfe5ef', borderLeft: 'none',
                    borderRadius: i === 6 ? '0 8px 0 0' : 0, minWidth: 110,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isOggi ? '#2c3e66' : '#9aa7bf', textTransform: 'uppercase' }}>{GIORNI[i]}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isOggi ? '#2c3e66' : '#1a2540' }}>{g.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {operatori.map((op) => (
              <tr key={op.id}>
                <td style={{ padding: '10px 12px', border: '1px solid #dfe5ef', borderTop: 'none', background: 'white', verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar nome={op.nome} size={28} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2540' }}>{op.nome}</div>
                      <div style={{ fontSize: 10, color: '#9aa7bf', textTransform: 'capitalize' }}>{op.ruolo}</div>
                    </div>
                  </div>
                </td>
                {giorni.map((g, gi) => {
                  const cellTasks = tasksPerOp(op.id, g);
                  const isOggi = isoDate(g) === oggi;
                  return (
                    <td key={gi} style={{ padding: 6, border: '1px solid #dfe5ef', borderTop: 'none', borderLeft: 'none', background: isOggi ? '#f6f8fc' : 'white', verticalAlign: 'top', minHeight: 60 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cellTasks.map(t => {
                          const p = PRIORITA.find(x => x.id === t.priorita) || PRIORITA[1];
                          return (
                            <div key={t.id} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 6, padding: '4px 7px', fontSize: 11, fontWeight: 600, color: p.color, lineHeight: 1.3 }}>
                              {t.titolo}
                              {t.aziendaNome && <div style={{ fontSize: 10, fontWeight: 400, color: '#2c3e66', marginTop: 2 }}>🏢 {t.aziendaNome}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {tasks.some(t => !t.assegnatoA && t.scadenza) && (
              <tr>
                <td style={{ padding: '10px 12px', border: '1px solid #dfe5ef', borderTop: 'none', background: '#fafafa' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9aa7bf' }}>Non assegnati</div>
                </td>
                {giorni.map((g, gi) => {
                  const cellTasks = tasksNonAssegnati(g);
                  return (
                    <td key={gi} style={{ padding: 6, border: '1px solid #dfe5ef', borderTop: 'none', borderLeft: 'none', background: '#fafafa', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cellTasks.map(t => (
                          <div key={t.id} style={{ background: '#eef1f7', border: '1px solid #dfe5ef', borderRadius: 6, padding: '4px 7px', fontSize: 11, color: '#5f6f8c' }}>{t.titolo}</div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            )}

            {operatori.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9aa7bf', border: '1px solid #dfe5ef', borderTop: 'none' }}>
                  Nessun operatore trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── COMPONENTE PRINCIPALE ────────────────────────────────────────────────── */
function PaginaPlanning({ operatori = [], userData }) {
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState([]);
  const [vistaAttiva, setVistaAttiva] = useState('board');
  const [mostraModale, setMostraModale] = useState(false);
  const [taskInModifica, setTaskInModifica] = useState(null);
  const [filtroOp, setFiltroOp] = useState('');

  const isAdmin = userData?.ruolo === 'admin';
  const isOperatore = userData?.ruolo === 'operatore';

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);

  const tasksFiltrati = tasks.sort((a, b) => {
    if (!a.scadenza && !b.scadenza) return 0;
    if (!a.scadenza) return 1;
    if (!b.scadenza) return -1;
    return a.scadenza.localeCompare(b.scadenza);
  });

  const handleSave = async (form) => {
    try {
      const { allegatiNuovi = [], allegatiEsistenti = [], ...campi } = form;

      // Upload nuovi allegati su Firebase Storage
      const nuoviCaricati = [];
      for (const file of allegatiNuovi) {
        const ts = Date.now();
        const path = `tasks/${ts}_${file.name}`;
        const fileRef = ref(storage, path);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        nuoviCaricati.push({ id: crypto.randomUUID(), nome: file.name, url, path });
      }

      const allegati = [...allegatiEsistenti, ...nuoviCaricati];

      const payload = {
        titolo: campi.titolo || '',
        descrizione: campi.descrizione || '',
        assegnatoA: campi.assegnatoA || '',
        assegnatoNome: campi.assegnatoNome || '',
        priorita: campi.priorita || 'media',
        stato: campi.stato || 'da_fare',
        scadenza: campi.scadenza || '',
        aziendaNome: campi.aziendaNome || '',
        allegati,
      };
      if (taskInModifica) {
        await updateDoc(doc(db, 'tasks', taskInModifica.id), { ...payload, updatedAt: serverTimestamp() });
        toast.success('Task aggiornato');
      } else {
        await addDoc(collection(db, 'tasks'), { ...payload, createdAt: serverTimestamp(), creadaDa: userData?.id || '' });
        toast.success('Task creato');
      }

      const nuovoOp = payload.assegnatoA;
      const vecchioOp = taskInModifica?.assegnatoA || '';
      if (nuovoOp && nuovoOp !== vecchioOp) {
        try {
          await addDoc(collection(db, 'notifiche_operatori'), {
            operatoreId: nuovoOp,
            titolo: '📋 Task assegnato',
            messaggio: payload.titolo || 'Hai un nuovo task',
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.error('Errore invio notifica operatore:', e);
        }
      }
      setMostraModale(false);
      setTaskInModifica(null);
    } catch (err) {
      console.error('Errore salvataggio task:', err);
      toast.error('Errore nel salvataggio');
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Eliminare "${task.titolo}"?`)) return;
    try {
      await deleteDoc(doc(db, 'tasks', task.id));
      toast.success('Task eliminato');
    } catch {
      toast.error('Errore eliminazione');
    }
  };

  const handleChangeStato = async (task, nuovoStato) => {
    if (task.stato === nuovoStato) return;
    try {
      await updateDoc(doc(db, 'tasks', task.id), { stato: nuovoStato, updatedAt: serverTimestamp() });
      if (isOperatore) {
        const etichette = { da_fare: 'Da fare', in_corso: 'In corso', completato: 'Completato' };
        await addDoc(collection(db, 'notifiche_admin'), {
          tipo: 'cambio_stato_task',
          messaggio: `${userData.nome || 'Operatore'} ha aggiornato "${task.titolo}" → ${etichette[nuovoStato] || nuovoStato}`,
          letta: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      toast.error('Errore aggiornamento stato');
    }
  };

  const handleEdit = (task) => { setTaskInModifica(task); setMostraModale(true); };
  const handleNew = () => { setTaskInModifica(null); setMostraModale(true); };

  const handleAssegna = async (task, userId, nome) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        assegnatoA: userId,
        assegnatoNome: nome,
        updatedAt: serverTimestamp(),
      });
      if (userId && userId !== task.assegnatoA) {
        try {
          await addDoc(collection(db, 'notifiche_operatori'), {
            operatoreId: userId,
            titolo: '📋 Task assegnato',
            messaggio: task.titolo || 'Hai un nuovo task',
            createdAt: serverTimestamp(),
          });
        } catch {}
      }
      toast.success(userId ? `Task assegnato a ${nome}` : 'Assegnazione rimossa');
    } catch {
      toast.error('Errore nell\'assegnazione');
    }
  };

  const totDaFare     = tasksFiltrati.filter(t => t.stato === 'da_fare').length;
  const totInCorso    = tasksFiltrati.filter(t => t.stato === 'in_corso').length;
  const totCompletati = tasksFiltrati.filter(t => t.stato === 'completato').length;
  const totScaduti    = tasksFiltrati.filter(t => t.scadenza && t.scadenza < isoDate(new Date()) && t.stato !== 'completato').length;

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#1a2540' }}>📋 Planning & Task</h2>
          {!isMobile && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5f6f8c' }}>Organizza e monitora il lavoro degli operatori</p>}
        </div>
        {(isAdmin || isOperatore) && (
          <button
            onClick={handleNew}
            style={{ padding: isMobile ? '9px 16px' : '10px 20px', background: '#2c3e66', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
          >
            + Nuovo Task
          </button>
        )}
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 12, marginBottom: 20 }}>
        {[
          { label: 'Da fare',    value: totDaFare,     color: '#45536f', bg: '#eef1f7', icon: '⬜' },
          { label: 'In corso',   value: totInCorso,    color: '#d97706', bg: '#fef3c7', icon: '🟡' },
          { label: 'Completati', value: totCompletati, color: '#059669', bg: '#f0fdf4', icon: '✅' },
          { label: 'Scaduti',    value: totScaduti,    color: '#dc2626', bg: '#fef2f2', icon: '⚠️' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 10, padding: isMobile ? '12px 14px' : '14px 16px' }}>
            <div style={{ fontSize: isMobile ? 18 : 22, marginBottom: 2 }}>{s.icon}</div>
            <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── TAB + FILTRI ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: vistaAttiva === 'board' && isAdmin && operatori.length > 0 ? 10 : 0 }}>
          {[
            { id: 'board',    label: isMobile ? '📋 Board'      : '📋 Board' },
            { id: 'planning', label: isMobile ? '📅 Settimanale' : '📅 Planning settimanale' },
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setVistaAttiva(v.id)}
              style={{
                flex: isMobile ? 1 : 'none',
                padding: isMobile ? '9px 8px' : '8px 18px',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: isMobile ? 12 : 13, fontWeight: 700,
                background: vistaAttiva === v.id ? '#2c3e66' : '#eef1f7',
                color: vistaAttiva === v.id ? 'white' : '#45536f',
              }}
            >{v.label}</button>
          ))}
        </div>

        {vistaAttiva === 'board' && isAdmin && operatori.length > 0 && (
          <select
            value={filtroOp}
            onChange={e => setFiltroOp(e.target.value)}
            style={{ width: isMobile ? '100%' : 'auto', padding: '7px 12px', border: '1px solid #dfe5ef', borderRadius: 8, fontSize: 13, background: 'white', color: '#374151', cursor: 'pointer' }}
          >
            <option value="">Tutti gli operatori</option>
            {operatori.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
          </select>
        )}
      </div>

      {/* ── CONTENUTO ── */}
      {vistaAttiva === 'board' ? (
        <KanbanBoard
          tasks={tasksFiltrati}
          operatori={operatori}
          isAdmin={isAdmin}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onChangeStato={handleChangeStato}
          filtroOp={filtroOp}
          userData={userData}
          onAssegna={handleAssegna}
        />
      ) : (
        <PlanningSettimanale
          tasks={tasksFiltrati}
          operatori={operatori}
        />
      )}

      {/* ── MODALE ── */}
      {mostraModale && (
        <ModaleTask
          task={taskInModifica}
          operatori={operatori}
          isAdmin={isAdmin}
          isOperatore={isOperatore}
          onClose={() => { setMostraModale(false); setTaskInModifica(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default PaginaPlanning;
