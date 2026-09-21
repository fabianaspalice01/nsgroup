function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Conferma', danger = false }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: '28px 32px',
        maxWidth: 420,
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <p style={{ margin: '0 0 24px', fontSize: 15, color: '#1a2540', lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px',
              border: '1.5px solid #dfe5ef',
              borderRadius: 8,
              background: 'white',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: '#5f6f8c'
            }}
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: 8,
              background: danger ? '#dc2626' : '#2c3e66',
              color: 'white',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
