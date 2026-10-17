
# ProxiSpeak API Contract

## 1. Project Overview

Project: ProxiSpeak - Geospatial Proximity Audio Ecosystem

Frontend: React + Vite
Backend: Node.js + Express
Database: MongoDB Atlas
Real-time communication: Socket.IO
Voice communication: WebRTC

## 2. Backend Base URL

Local development:
http://localhost:3000

## 3. Authentication APIs

### Register

Endpoint: POST /api/auth/register

Request body:
{
  "name": "Test User",
  "email": "user@example.com",
  "password": "ExamplePass123!"
}

Success: HTTP 201

Response:
{
  "message": "Registration successful",
  "user": {
    "id": "user_id",
    "name": "Test User",
    "email": "user@example.com"
  }
}

### Login

Endpoint: POST /api/auth/login

Request body:
{
  "email": "user@example.com",
  "password": "ExamplePass123!"
}

Success: HTTP 200

Response:
{
  "message": "Login successful",
  "token": "authentication_token",
  "user": {
    "id": "user_id",
    "name": "Test User",
    "email": "user@example.com"
  }
}

Never commit real passwords, JWT secrets or database credentials.

## 4. Health Check

Endpoint: GET /api/health

Success: HTTP 200

Response:
{
  "status": "ok",
  "project": "ProxiSpeak",
  "message": "Backend is running",
  "database": "connected"
}

## 5. Team Module Ownership

Member 2:
Login and registration frontend UI and validation.

Member 3:
Backend authentication routes and authentication security.
Coordinate with the team lead before changing existing auth routes.

Member 4:
MongoDB user schema, database operations and profile functions.
Coordinate schema changes with the team lead.

Member 5:
Virtual office UI, desks, avatars, status indicators and placeholder controls.

Team Lead:
Project integration, API contracts, real-time movement,
proximity voice integration, testing, documentation and demo.

## 6. Integration Rules

1. Each member works on their assigned Git branch.
2. Do not merge any branch into main before the end review.
3. Keep the existing folder structure unless changes are agreed upon.
4. Test changes before requesting integration.
5. Do not commit .env, node_modules or build output.
6. Coordinate before modifying shared files.
7. Report changed files, tests and known issues when submitting work.

## 7. Planned Real-Time Features

Socket.IO:
- Join and leave office rooms.
- Synchronize avatar positions.
- Track online users and movement.
- Handle disconnects and reconnects.

WebRTC:
- Establish voice connections between nearby users.
- Use distance-based audio attenuation.
- Support microphone mute and unmute.

These real-time features are planned and are not yet implemented.
