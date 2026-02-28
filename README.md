# Real-Time Communication App

This repository contains a full-stack real-time communication application with video conferencing, screen sharing, whiteboard, and file transfer capabilities.

## Features

- **Authentication**: JWT-based login/register system
- **Video Conferencing**: WebRTC peer-to-peer video calls
- **Screen Sharing**: Share your screen with participants
- **Whiteboard**: Real-time collaborative drawing
- **File Transfer**: Send files via WebRTC data channels
- **Real-time Signaling**: Socket.IO for WebRTC offer/answer/ICE

## Tech Stack

**Backend:**
- Node.js + Express
- Socket.IO for real-time signaling
- JWT authentication
- CORS enabled

**Frontend:**
- React 18
- Vite for building
- Socket.IO client
- WebRTC API

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- npm

### Server Setup

```bash
cd server
npm install
```

Create `.env` file:
```
PORT=5000
JWT_SECRET=your-super-secret-key-change-this
CLIENT_ORIGIN=http://localhost:5173
```

Run:
```bash
npm run dev  # development with nodemon
npm start    # production
```

### Client Setup

```bash
cd client
npm install
```

Create `.env` file (already provided):
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Run:
```bash
npm run dev    # development
npm run build  # production build
```

## How to Use

1. Start the server: `npm run dev` in the `server` folder
2. Start the client: `npm run dev` in the `client` folder
3. Open `http://localhost:5173` in your browser
4. Register/Login with any credentials (demo mode, no database)
5. Join a room and share the room ID with others
6. Click "Join" to connect
7. Use "Share Screen", whiteboard, or file upload features

## Architecture

### WebRTC Flow
- When users join a room, the server sends a list of existing peers
- New user creates **offers** to existing peers (they create **answers**)
- ICE candidates are exchanged for peer discovery
- Data channels handle file transfers on top of peer connections

### Signaling Flow
- Socket.IO carries all WebRTC signals (offer, answer, ICE candidates)
- Events: `webrtc:offer`, `webrtc:answer`, `webrtc:ice`
- Whiteboard: `wb:draw`, `wb:clear`
- Room management: `room:join`, `room:users`, `room:user-joined`, `room:user-left`

## Known Limitations

- Demo authentication (no password validation)
- No database or user persistence
- No call recording
- STUN server only (Google's public server)
- Browser-based only (Chrome/Firefox/Edge recommended)

## Future Improvements

- Add MongoDB for persistent user data
- Implement SFU (Selective Forwarding Unit) for better scalability
- Add UI for muting audio/video
- Implement chat messages
- Add recording capabilities

## License

MIT
