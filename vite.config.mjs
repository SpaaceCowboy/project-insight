import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import studioPlugin from './scripts/studio-plugin.mjs';

export default defineConfig({
  base: './',
  plugins: [studioPlugin()],
  esbuild: {jsx: 'automatic'},
  build: {
    rollupOptions: {
      input: {index: resolve('index.html'), game: resolve('Puzzle.html'), editor: resolve('Editor.html')}
    }
  }
});
