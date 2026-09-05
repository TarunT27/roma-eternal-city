import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({ plugins: [react(), viteSingleFile()], base: './', build: { assetsInlineLimit: 5000000, outDir: 'dist' }, server: { port: 5173, strictPort: true } });
