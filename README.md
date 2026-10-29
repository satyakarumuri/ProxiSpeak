# ProxiSpeak — Geospatial Proximity Audio Ecosystem

A browser-based virtual office with shared office chat, presence, draggable/click-to-move avatars, direct messages, direct audio/video calls, and proximity-based WebRTC audio.

## Requirements
- Node.js 18+ (20+ recommended)
- npm
- A modern browser with microphone permissions

## Run locally

Terminal 1 — backend:
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Terminal 2 — frontend:
```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Open a second browser profile or another device to test multiple users. Both users must enable Proximity Voice and grant microphone permission. Headphones are recommended.

## Environment
Backend `backend/.env`:
```env
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
```
Frontend can use `frontend/.env` with `VITE_API_URL=http://localhost:3000` if the backend is hosted elsewhere.

## Current implementation notes
- Accounts and chat history are persisted in a local SQLite database at `backend/data/proxispeak.sqlite` by default.
- MongoDB is **not** the active persistence engine in this build. Do not describe MongoDB as implemented until a MongoDB URI is configured and account/message persistence is migrated and tested.
- The Help page includes a local FAQ assistant for common app questions. It does not call a generative AI model or external AI API.
- Proximity audio uses WebRTC peer-to-peer connections and a STUN server. Some networks require a TURN server; add credentials through environment configuration before production deployment.
- Use HTTPS in deployed environments for microphone/camera access. Configure a production JWT secret, strict CORS origins, authentication/authorization for signaling, rate limits, and appropriate data retention before public deployment.
- Room signaling is scoped to the socket's office room. The current UI uses the default `office-general` room; a full multi-room selector is not included.

## Testing checklist
1. Open two browser profiles and sign in as different guest names.
2. Confirm each appears in People and on the office map.
3. Enable Proximity Voice on both; test with headphones.
4. Move avatars within/outside the hearing radius and check fade behavior.
5. Toggle mic off/on, mute incoming audio, and test direct audio/video calls.
6. Inspect browser DevTools Console and Network if WebRTC remains in `connecting` or `failed` state.
7. Test on separate devices/networks before deployment.

## Build frontend
```bash
cd frontend
npm install
npm run build
```

## Update notes (October 2026)

This update adds:
- Office-only home canvas; chat panels no longer appear on the home page.
- Chat menu with Office Chat and Personal Chat entry points.
- Camera and screen-share publishing to online teammates using a separate WebRTC media mesh from proximity voice.
- Camera/screen previews beside the teammate's office avatar, plus media connection status text.
- Backend-persisted profile photos (PNG/JPEG/WEBP/GIF, max 1 MB) and profile editing.
- Profile name updates and live camera/share status broadcast.

### Run locally
1. Open a terminal in `backend` and run `npm install`, then `npm start`.
2. Open another terminal in `frontend` and run `npm install`, then `npm run dev`.
3. Keep `VITE_API_URL=http://localhost:3000` for local use, or set it to your deployed backend URL.
4. Camera/microphone/screen capture require localhost or HTTPS. Test with two browsers/laptops. Some networks require a TURN server; this build currently configures Google STUN only.
5. Profile photos are stored in SQLite under `backend/data`. Back up this directory; for hosting, attach persistent storage or migrate profile storage to a persistent managed service.

Note: WebRTC media delivery is network-dependent and should be tested with two real clients before production deployment. Do not use the development JWT fallback in production; set a unique strong `JWT_SECRET` and set `FRONTEND_URL` to the deployed frontend origin.
