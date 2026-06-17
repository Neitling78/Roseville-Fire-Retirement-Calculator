# Roseville Fire Retirement Calculator (personal copy)

A personal, experimental copy of the CalPERS retirement projection tool. This is
a private sandbox for testing changes — it is **not** the official Local 1592
calculator and is not connected to it. Break it freely; the original is untouched.

## What this is

A single-page React app (built with Vite). The actual calculator lives in
`src/RFF_Retirement_Calculator.jsx`. Everything else is scaffolding.

## How it gets published (no command line needed)

This repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`).
Every time you push a change to the `main` branch, GitHub automatically builds the
site and publishes it to GitHub Pages. You don't need Node, npm, or any tools on
your own computer.

After the first push, enable Pages once:
**Settings → Pages → Build and deployment → Source → "GitHub Actions".**

Your live site will then be at:
`https://<your-username>.github.io/Roseville-Fire-Retirement-Calculator/`

## If you ever rename the repo

Update the `base` line in `vite.config.js` to match the new name (keep the leading
and trailing slashes), then push. Otherwise the published page loads blank.

## Running it on your own computer (optional, advanced)

If you install Node.js later and want a local preview:

```
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).
