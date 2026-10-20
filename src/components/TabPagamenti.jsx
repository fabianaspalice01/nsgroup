import { useState } from 'react';
import ConfirmModal from './ConfirmModal';
import ModalePagamento from './ModalePagamento';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import toast from 'react-hot-toast';

function TabPagamenti({ azienda, onUpdateAzienda, readOnly, vistaCliente = false }) {
  const [mostraModalePagamento, setMostraModalePagamento] = useState(false);
  const [pagamentoInModifica, setPagamentoInModifica] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const formatData = (dataStr) => {
    const [anno, mese, giorno] = dataStr.split('-');
    return `${giorno}/${mese}/${anno}`;
  };

  const handleAddPagamento = () => {
    setPagamentoInModifica(null);
    setMostraModalePagamento(true);
  };

  const handleSavePagamento = async (datiPagamento, file) => {
    if (saving) return;
    setSaving(true);
    try {
      let pdfUrl = null;
      let pdfPath = null;

      if (file) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        pdfPath = `pagamenti/${azienda.id}/${fileName}`;
        const storageRef = ref(storage, pdfPath);
        await uploadBytes(storageRef, file);
        pdfUrl = await getDownloadURL(storageRef);
      }

      const pagamentoCompleto = {
        ...datiPagamento,
        id: crypto.randomUUID(),
        pdfUrl,
        pdfPath
      };

      const pagamenti = azienda.pagamenti || [];
      await onUpdateAzienda(azienda.id, { pagamenti: [...pagamenti, pagamentoCompleto] });

      setMostraModalePagamento(false);
      setPagamentoInModifica(null);
      toast.success('Pagamento registrato con successo!');
    } catch (error) {
      console.error('Errore nel salvataggio del pagamento:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePagamento = (pagamentoId) => {
    setConfirm({
      message: 'Sei sicuro di voler eliminare questo pagamento?',
      onConfirm: () => { setConfirm(null); _eliminaPagamento(pagamentoId); }
    });
  };

  const _eliminaPagamento = async (pagamentoId) => {
    try {
      const pagamento = (azienda.pagamenti || []).find((p) => p.id === pagamentoId);
      if (pagamento?.pdfPath) {
        const pdfRef = ref(storage, pagamento.pdfPath);
        await deleteObject(pdfRef);
      }
      const pagamentiAggiornati = (azienda.pagamenti || []).filter((p) => p.id !== pagamentoId);
      await onUpdateAzienda(azienda.id, { pagamenti: pagamentiAggiornati });
      toast.success('Pagamento eliminato con successo!');
    } catch (error) {
      console.error("Errore nell'eliminazione del pagamento:", error);
      toast.error("Errore nell'eliminazione del pagamento");
    }
  };

  const iconaMetodo = {
    'Bonifico': '🏦',
    'Contanti': '💵',
    'Assegno': '📝'
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <h3 style={{ margin: 0 }}>💰 Storico Pagamenti ({(azienda.pagamenti || []).length})</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-muted)' }}>
            {vistaCliente ? 'Totale versato' : 'Totale incassato'}: €{' '}
            {(azienda.pagamenti || [])
              .reduce((sum, p) => sum + parseFloat(p.importo || 0), 0)
              .toFixed(2)
              .replace('.', ',')}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={handleAddPagamento}
            style={{
              background: 'var(--success)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            + Registra Pagamento
          </button>
        )}
      </div>

      {(!azienda.pagamenti || azienda.pagamenti.length === 0) ? (
        <p style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: '20px', background: 'white', borderRadius: '10px' }}>
          Nessun pagamento registrato
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[...(azienda.pagamenti || [])].sort((a, b) => new Date(b.data) - new Date(a.data)).map((pagamento) => (
            <div
              key={pagamento.id}
              style={{
                background: 'white',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 24 }}>{iconaMetodo[pagamento.metodoPagamento] || '💳'}</span>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>
                      € {parseFloat(pagamento.importo).toFixed(2).replace('.', ',')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {formatData(pagamento.data)} • {pagamento.metodoPagamento}
                    </div>
                  </div>
                </div>

                {pagamento.numeroFattura && (
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 4 }}>
                    📄 Fattura: {pagamento.numeroFattura}
                  </div>
                )}

                {pagamento.descrizione && (
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 4 }}>
                    {pagamento.descrizione}
                  </div>
                )}

                {pagamento.note && (
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)', fontStyle: 'italic', marginTop: 4 }}>
                    {pagamento.note}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {pagamento.pdfUrl && (
                  <a
                    href={pagamento.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'var(--primary-soft)',
                      border: '1px solid var(--line)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      color: 'var(--primary-ink)',
                      textDecoration: 'none',
                      fontWeight: 'bold'
                    }}
                  >
                    📄 Contabile
                  </a>
                )}
                {!readOnly && (
                  <button
                    onClick={() => handleDeletePagamento(pagamento.id)}
                    style={{
                      background: 'var(--danger-soft)',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'var(--danger)',
                      fontWeight: 'bold'
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {mostraModalePagamento && (
        <ModalePagamento
          onClose={() => {
            setMostraModalePagamento(false);
            setPagamentoInModifica(null);
          }}
          onSave={handleSavePagamento}
          pagamento={pagamentoInModifica}
        />
      )}
    </div>
  );
}

export default TabPagamenti;
