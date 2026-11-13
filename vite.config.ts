import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' permite publicar la app en cualquier ruta (p. ej. GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 1200,
    // Un solo archivo JS: más simple de publicar en cualquier sitio
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
