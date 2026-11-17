import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Si algo falla de forma inesperada, muestra un mensaje claro en lugar de una página en blanco
 * o un error técnico. El detalle solo va a la consola del navegador (para depurar), nunca a la pantalla.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error inesperado en la app', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="login-wrap">
        <div className="login-card" role="alert">
          <h1>Algo ha fallado</h1>
          <p className="muted">
            Ha ocurrido un error inesperado. Tus datos no se han perdido: están guardados.
            Recarga la página para seguir.
          </p>
          <button className="btn primary large full" onClick={() => location.reload()}>Recargar la página</button>
        </div>
      </main>
    );
  }
}
