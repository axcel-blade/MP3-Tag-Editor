import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nodeBuiltins = [
  'electron',
  'electron-updater',
  'dotenv',
  'node-id3',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]

// Node-only modules must stay external so Electron loads them at runtime.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
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
