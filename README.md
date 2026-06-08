# Fiitx Desktop

Fiitx is an Electron + React Mac desktop MVP for a BYOM enterprise agent workbench.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run dist
```

The app uses the provided Fiitx logo from `assets/fiitx-logo.png` and stores model profiles in the Electron user data directory. API keys are encrypted with Electron `safeStorage` when the platform supports it.
