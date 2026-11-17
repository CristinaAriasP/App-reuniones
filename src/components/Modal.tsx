import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana modal accesible:
 * - Escape la cierra.
 * - El foco del teclado se queda dentro mientras está abierta (Tab y Mayús+Tab dan la vuelta).
 * - Al cerrarla, el foco vuelve al botón que la abrió.
 */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Elemento que tenía el foco al abrir (se guarda antes de que un campo con autoFocus lo tome)
  const [previous] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const box = ref.current!;
    // Si ningún campo pide el foco (autoFocus), se pone en la propia ventana
    if (!box.contains(document.activeElement)) box.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    box.addEventListener('keydown', onKey);
    return () => {
      box.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [previous]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
