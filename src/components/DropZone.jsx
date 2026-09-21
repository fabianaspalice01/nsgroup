import { useState, useRef } from 'react';

const SCHEMES = {
    blue:   { color: '#2c3e66', bg: '#dde3f0', border: '#c3cde3', dragBg: '#c3cde3' },
    yellow: { color: '#a16207', bg: '#fef3c7', border: '#fde68a', dragBg: '#fde68a' },
};

let _counter = 0;

function DropZone({ accept, onFile, onRemove, file, label, compact = false, colorScheme = 'blue', multiple = false }) {
    const [dragging, setDragging] = useState(false);
    const id = useRef(`dz-${++_counter}`).current;
    const camId = useRef(`dzc-${_counter}`).current;

    // mostra bottone fotocamera se l'accept include immagini
    const hasCamera = accept && /image|jpg|jpeg|png/i.test(accept);

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        (multiple ? files : files.slice(0, 1)).forEach(onFile);
    };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); if (!dragging) setDragging(true); };
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
    const handleDragLeave = () => setDragging(false);
    const handleChange = (e) => {
        const files = Array.from(e.target.files);
        (multiple ? files : files.slice(0, 1)).forEach(onFile);
        e.target.value = '';
    };

    const dragProps = { onDrop: handleDrop, onDragOver: handleDragOver, onDragEnter: handleDragEnter, onDragLeave: handleDragLeave };

    const hiddenStyle = { position: 'absolute', opacity: 0, width: '0.1px', height: '0.1px', overflow: 'hidden', pointerEvents: 'none' };
    // input per file/galleria
    const fileInput = <input id={id} type="file" accept={accept} multiple={multiple} style={hiddenStyle} onChange={handleChange} />;
    // input per fotocamera diretta (mobile)
    const camInput = hasCamera
        ? <input id={camId} type="file" accept="image/*" capture="environment" style={hiddenStyle} onChange={handleChange} />
        : null;

    /* ── COMPACT ── */
    if (compact) {
        const s = SCHEMES[colorScheme] ?? SCHEMES.blue;
        const baseStyle = {
            fontSize: 11, color: s.color, whiteSpace: 'nowrap', cursor: 'pointer',
            padding: '3px 8px', background: dragging ? s.dragBg : s.bg,
            borderRadius: 4, border: `1px solid ${dragging ? s.color : s.border}`,
            transition: 'all 0.1s', display: 'inline-block', userSelect: 'none',
        };
        return (
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', position: 'relative' }} {...dragProps}>
                {fileInput}
                {camInput}
                <label htmlFor={id} style={baseStyle}>📎 {label ?? 'Allega'}</label>
                {hasCamera && (
                    <label htmlFor={camId} style={{ ...baseStyle, background: dragging ? s.dragBg : s.bg }}>📷 Foto</label>
                )}
            </span>
        );
    }

    /* ── FILE GIÀ SELEZIONATO ── */
    if (file) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, position: 'relative' }}>
                {fileInput}{camInput}
                <span style={{ flex: 1, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                    ✓ {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </span>
                {onRemove && (
                    <button type="button" onClick={e => { e.preventDefault(); onRemove(); }}
                        style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        ✕ Rimuovi
                    </button>
                )}
            </div>
        );
    }

    /* ── FULL (drag-and-drop) ── */
    return (
        <div {...dragProps} style={{ borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
            {fileInput}{camInput}
            <label htmlFor={id} style={{
                display: 'block', width: '100%', padding: '18px 12px',
                border: `2px dashed ${dragging ? '#2c3e66' : '#c9d1e0'}`,
                borderRadius: 8,
                background: dragging ? '#eef1f8' : '#f6f8fc',
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                boxSizing: 'border-box', userSelect: 'none',
            }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📂</div>
                <div style={{ fontSize: 13, color: dragging ? '#2c3e66' : '#5f6f8c', fontWeight: dragging ? 700 : 400 }}>
                    {dragging ? 'Rilascia il file qui' : (label ?? 'Trascina qui o clicca per selezionare')}
                </div>
                <div style={{ fontSize: 11, color: '#9aa7bf', marginTop: 3 }}>oppure clicca per sfogliare</div>
            </label>
            {hasCamera && (
                <label htmlFor={camId} style={{
                    display: 'block', width: '100%', padding: '10px', marginTop: 6,
                    background: '#eef1f8', border: '1px solid #c3cde3', borderRadius: 8,
                    cursor: 'pointer', textAlign: 'center', fontSize: 13,
                    color: '#2c3e66', fontWeight: 600, userSelect: 'none', boxSizing: 'border-box',
                }}>
                    📷 Scatta foto
                </label>
            )}
        </div>
    );
}

export default DropZone;
