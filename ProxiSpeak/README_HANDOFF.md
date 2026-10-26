# ProxiSpeak — source snapshot

This package contains the available ProxiSpeak frontend and backend source snapshot plus role-specific instructions. It is a working handoff snapshot, not proof that every feature has passed runtime testing.

## Contents
- `frontend/src/App.jsx` — React application
- `frontend/src/main.jsx` — frontend entry point
- `frontend/src/styles.css` — application styles
- `frontend/package.json`, `vite.config.js`, `index.html` — frontend setup
- `frontend/public/office-scene.png` — office scene asset
- `backend/src/server.js` — Express/Socket.IO backend
- `backend/package.json`, `.env.example`, `.gitignore` — backend setup

## Run
1. Install a current Node.js LTS release and npm.
2. Open a terminal in `backend`, run `npm install`, review `.env.example`, create a local `.env` if required, then use the script listed by `npm run`.
3. Open another terminal in `frontend`, run `npm install`, then `npm run dev`.
4. Follow the terminal output and verify frontend/backend URLs and CORS settings.

No dependency lockfiles are included in this source snapshot. `npm install` may resolve newer compatible dependency versions; for reproducible installs, generate and commit lockfiles after validating the chosen versions.

## Safety and verification
- Do not commit `.env`, credentials, or tokens.
- Test all claimed features in the running application. Check the README testing checklist.
- A ZIP integrity check does not establish that the application builds or runs without errors.
