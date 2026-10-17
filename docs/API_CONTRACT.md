
## 8. Virtual Office Socket.IO Contract

Connection:
- Backend: http://localhost:3000
- Transport: Socket.IO

### Join an office

Client emits: office:join

Payload:
{
  "roomId": "office-1",
  "user": {
    "id": "user_id",
    "name": "Test User"
  }
}

Server emits: office:users

Payload: Array of users currently in the office.

### Avatar movement

Client emits: avatar:move

Payload:
{
  "roomId": "office-1",
  "position": {
    "x": 1,
    "y": 0,
    "z": 2
  },
  "rotation": 0
}

Server emits: avatar:moved

Payload:
{
  "userId": "user_id",
  "position": {
    "x": 1,
    "y": 0,
    "z": 2
  },
  "rotation": 0
}

The server must validate room membership and position values
before broadcasting movement to other users in the same room.

### Leaving the office

Client emits: office:leave

Server emits: office:user-left

Payload:
{
  "userId": "user_id"
}

### Rules

- Broadcast movement to other users in the same room.
- Do not trust user IDs supplied by the client without verification.
- Do not allow arbitrary room access without validation.
- Handle disconnects and reconnects.
- Movement events must not be broadcast to unrelated rooms.

These events are planned contracts and must be implemented
and tested before they are considered complete.
