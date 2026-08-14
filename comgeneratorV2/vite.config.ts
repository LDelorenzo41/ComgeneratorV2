import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait()
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  esbuild: {
    // Les console.log sont retirés du bundle de production (identifiants
    // utilisateur, identifiants de session Stripe, Price IDs y transitaient).
    // console.error et console.warn sont conservés : ils restent utiles pour
    // diagnostiquer un incident en production.
    // En développement (vite dev), rien n'est retiré : les logs restent
    // disponibles pour le débogage.
    pure: ['console.log', 'console.debug', 'console.info'],
  },
});


