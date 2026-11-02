import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const proxy = { '/api': process.env.VITE_API_TARGET || 'http://localhost:3000' };

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
