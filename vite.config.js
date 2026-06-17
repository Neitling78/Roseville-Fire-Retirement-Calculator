import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site lives at:
//   https://<your-username>.github.io/Roseville-Fire-Retirement-Calculator/
// `base` must match the repo name (case-sensitive) with leading + trailing slash.
// If you rename the repo, update this line to match the new name.
export default defineConfig({
  plugins: [react()],
  base: '/Roseville-Fire-Retirement-Calculator/',
})
