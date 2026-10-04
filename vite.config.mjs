import {defineConfig} from 'vite';
import {resolve} from 'node:path';

export default defineConfig({
  base: './',
  esbuild: {jsx: 'automatic'},
  build: {
    rollupOptions: {
      input: {index: resolve('index.html'), game: resolve('Puzzle.html'), editor: resolve('Editor.html')}
    }
  }
});
