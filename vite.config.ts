import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { garden: 'index.html', legacy: 'legacy/index.html', browserVerification: 'tests/browser-check.html' },
      output: { manualChunks: { three: ['three'] } },
    },
    chunkSizeWarningLimit: 550,
  },
});
