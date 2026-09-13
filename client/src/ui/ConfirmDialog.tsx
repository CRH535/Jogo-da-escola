import { useEffect, useRef } from 'react';
import { RotateCcw, X } from 'lucide-react';

export function ConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="confirm-dialog" aria-labelledby="reset-title" aria-describedby="reset-description"
    onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <h2 id="reset-title">Restaurar configurações?</h2>
    <p id="reset-description">Vídeo, áudio, controles e jogabilidade voltarão aos valores padrão.</p>
    <div className="dialog-actions">
      <button className="button secondary" onClick={onCancel} autoFocus><X aria-hidden="true" />Cancelar</button>
      <button className="button primary" onClick={onConfirm}><RotateCcw aria-hidden="true" />Restaurar</button>
    </div>
  </dialog>;
}
