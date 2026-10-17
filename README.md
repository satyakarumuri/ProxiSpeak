# ProxiSpeak — Geospatial Proximity Audio Ecosystem

## Project Overview

ProxiSpeak is a browser-based virtual office where users can move around a shared 3D workspace and communicate with nearby teammates through proximity-based voice chat.

## Technology Stack

- **Frontend:** React, Vite, Three.js
- **Backend:** Node.js, Express
- **Database:** MongoDB Atlas, Mongoose
- **Real-time communication:** Socket.IO
- **Voice communication:** WebRTC, Web Audio API

## Project Structure

```text
ProxiSpeak/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── socket/
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json
├── docs/
│   └── API_CONTRACT.md
└── README.md
```

## Prerequisites

Install Node.js and npm, Git, and a code editor such as Visual Studio Code. A MongoDB Atlas account is required for the current database setup.

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/satyakarumuri/ProxiSpeak.git
cd ProxiSpeak
git checkout satya-lead
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create `backend/.env` using your own local credentials:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret
```

Never commit `.env` or share real credentials.

### 4. Start the backend

```bash
npm run dev
```

The backend should run at `http://localhost:3000`.

Health check: `http://localhost:3000/api/health`

### 5. Install and start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, normally `http://localhost:5173`.

## Current Progress

- [x] React frontend foundation
- [x] Express backend foundation
- [x] MongoDB Atlas connection
- [x] User registration and login APIs
- [x] Login and registration interface
- [ ] 3D virtual office
- [ ] Avatar movement and real-time synchronization
- [ ] Proximity-based voice communication
- [ ] Integration testing and final demonstration

## Team Workflow

- Members develop on their assigned branches.
- Do not merge into `main` before the end review.
- Coordinate changes to shared files before integration.
- Test changes and report completed work before requesting review.
- Never commit environment files, passwords, tokens or generated dependency folders.

## API Documentation

See `docs/API_CONTRACT.md` for authentication endpoints, response formats, team module ownership and integration rules.
