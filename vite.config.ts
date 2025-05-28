import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),],
  // optimizeDeps: {
  //   exclude: ['laz-perf'] // Exclude laz-perf from optimization to prevent WASM loading issues
  // },
  assetsInclude: ['**/*.wasm'], // Include .wasm files as assets
  build: {
    target: 'esnext',
    modulePreload: {
      polyfill: true
    }
  }
})
