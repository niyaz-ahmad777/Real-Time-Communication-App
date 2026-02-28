const { verifyToken } = require("./utils/jwt");

function setupSocket(io) {
  // socket auth via token in handshake auth
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));
      const user = verifyToken(token);
      socket.user = user;
      next();
    } catch (e) {
      next(new Error("Bad token"));
    }
  });

  io.on("connection", (socket) => {
    // join room
    socket.on("room:join", ({ roomId }) => {
      socket.join(roomId);
      // tell others new user joined
      socket.to(roomId).emit("room:user-joined", { socketId: socket.id, user: socket.user });

      // send current members list to new user
      const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const others = clients.filter(id => id !== socket.id);
      socket.emit("room:users", { users: others });
    });

    // signaling: offer/answer/ice
    socket.on("webrtc:offer", ({ to, sdp }) => io.to(to).emit("webrtc:offer", { from: socket.id, sdp }));
    socket.on("webrtc:answer", ({ to, sdp }) => io.to(to).emit("webrtc:answer", { from: socket.id, sdp }));
    socket.on("webrtc:ice", ({ to, candidate }) => io.to(to).emit("webrtc:ice", { from: socket.id, candidate }));

    // whiteboard events broadcast (room)
    socket.on("wb:draw", ({ roomId, stroke }) => socket.to(roomId).emit("wb:draw", { stroke }));
    socket.on("wb:clear", ({ roomId }) => socket.to(roomId).emit("wb:clear"));

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        socket.to(roomId).emit("room:user-left", { socketId: socket.id });
      }
    });
  });
}

module.exports = { setupSocket };
