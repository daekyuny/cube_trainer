import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/cube_trainer/' : '/',
  plugins: [react()],
  // The solver worker imports this CommonJS package; prebundle it up front so
  // the dev server never reloads the page on the first solve.
  optimizeDeps: { include: ['min2phase.js'] },
}));
