import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal } from './Modal';

interface Request { message: string; action: string; resolve: (ok: boolean) => void }

const ConfirmContext = createContext<(message: string, action?: string) => Promise<boolean>>(async () => false);

/** Confirmación dentro de la app (en lugar de window.confirm). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const ask = useCallback(
    (message: string, action = 'Borrar') => new Promise<boolean>((resolve) => setReq({ message, action, resolve })),
    [],
  );
  const close = (ok: boolean) => { req?.resolve(ok); setReq(null); };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {req && (
        <Modal title="¿Seguro?" onClose={() => close(false)}>
          <p className="confirm-text">{req.message}</p>
          <div className="form-actions">
            <button className="btn ghost" onClick={() => close(false)}>Cancelar</button>
            <button className="btn danger" autoFocus onClick={() => close(true)}>{req.action}</button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
