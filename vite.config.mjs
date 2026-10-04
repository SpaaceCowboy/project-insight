import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import {cpSync} from 'node:fs';

export default defineConfig({
  base: './',
  esbuild: {jsx: 'automatic'},
  build: {
    rollupOptions: {
      input: {index: resolve('index.html'), game: resolve('Puzzle.html'), editor: resolve('Editor.html')}
    }
  },
  plugins: [{
    name: 'sound-assets',
    closeBundle() {cpSync('sounds', 'dist/sounds', {recursive: true})}
  }]
});
