
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

## 9. WebRTC Voice Signaling & Proximity Audio Contract

Author: Sarthak (Audio Engineering Lead)

### Peer-to-Peer Voice Signal Relay

Client emits: `voice:signal`

Payload:
```json
{
  "to": "target_socket_id",
  "signal": {
    "type": "offer | answer | candidate",
    "sdp": "...",
    "candidate": "..."
  }
}
```

Server forwards to target peer: `voice:signal`

Payload:
```json
{
  "from": "sender_socket_id",
  "signal": { ... }
}
```

### Voice Status (Speaking & Mute State)

Client emits: `voice:status`

Payload:
```json
{
  "muted": false,
  "speaking": true
}
```

Server broadcasts to room: `voice:status`

Payload:
```json
{
  "userId": "sender_socket_id",
  "muted": false,
  "speaking": true
}
```

### Spatial Proximity Calculation Rules

- 3D Euclidean distance formula: $\text{distance} = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2 + (z_2 - z_1)^2}$
- Min Hearing Distance: 2 units (100% volume / Gain = 1.0)
- Max Cutoff Distance: 9 units (0% volume / Gain = 0.0)
- Stereo Panning: relative horizontal offset $\Delta x = x_2 - x_1$ maps to Left (-1.0) / Right (+1.0) ear.

