import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const proxy = { '/api': 'http://localhost:3000' };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
