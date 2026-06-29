import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { builtinModules } from 'node:module'

const nodeBuiltins = [
  'electron',
  'dotenv',
  'music-metadata',
  'node-id3',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]

// Node-only modules must stay external so Electron loads them at runtime.
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.js',
        vite: {
          build: {
            rollupOptions: {
              external: nodeBuiltins,
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.js',
      },
    }),
  ],
})
