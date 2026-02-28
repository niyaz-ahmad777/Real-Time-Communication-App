import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../state/auth";
import { createSocket } from "../lib/socket";
import { RTC_CONFIG, getLocalStream, getScreenStream } from "../lib/webrtc";

export default function Room() {
  const { token } = useAuth();
  const [roomId, setRoomId] = useState("demo-room");
  const [joined, setJoined] = useState(false);

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  const peersRef = useRef(new Map());     // socketId -> RTCPeerConnection
  const channelsRef = useRef(new Map());  // socketId -> RTCDataChannel
  const [remoteVideos, setRemoteVideos] = useState([]); // {id, stream}

  // whiteboard
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const s = createSocket(token);
    socketRef.current = s;

    s.on("room:users", async ({ users }) => {
      // existing users in room -> create offers to each
      for (const id of users) await createPeerAndOffer(id);
    });

    s.on("room:user-joined", async ({ socketId }) => {
      // when someone joins, we wait: they will create offers to us (because they receive room:users)
      // optional: could create offer here too, but to avoid glare, keep one side offerer.
    });

    s.on("room:user-left", ({ socketId }) => cleanupPeer(socketId));

    s.on("webrtc:offer", async ({ from, sdp }) => {
      const pc = await ensurePeer(from, false);
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit("webrtc:answer", { to: from, sdp: pc.localDescription });
    });

    s.on("webrtc:answer", async ({ from, sdp }) => {
      const pc = peersRef.current.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(sdp);
    });

    s.on("webrtc:ice", async ({ from, candidate }) => {
      const pc = peersRef.current.get(from);
      if (!pc) return;
      try { await pc.addIceCandidate(candidate); } catch {}
    });

    // whiteboard events
    s.on("wb:draw", ({ stroke }) => drawStroke(stroke, false));
    s.on("wb:clear", () => clearBoard(false));

    return () => s.disconnect();
  }, [token]);

  async function join() {
    // local media
    const stream = await getLocalStream();
    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;

    socketRef.current.emit("room:join", { roomId });
    setJoined(true);
  }

  async function ensurePeer(remoteId, isOfferer) {
    if (peersRef.current.has(remoteId)) return peersRef.current.get(remoteId);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(remoteId, pc);

    // add tracks
    localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));

    // remote stream
    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      setRemoteVideos(prev => {
        const exists = prev.find(x => x.id === remoteId);
        if (exists) return prev.map(x => x.id === remoteId ? { id: remoteId, stream } : x);
        return [...prev, { id: remoteId, stream }];
      });
    };

    // ice
    pc.onicecandidate = (ev) => {
      if (ev.candidate) socketRef.current.emit("webrtc:ice", { to: remoteId, candidate: ev.candidate });
    };

    // data channel for file (offerer creates)
    if (isOfferer) {
      const ch = pc.createDataChannel("files");
      setupDataChannel(remoteId, ch);
      channelsRef.current.set(remoteId, ch);
    } else {
      pc.ondatachannel = (ev) => {
        const ch = ev.channel;
        setupDataChannel(remoteId, ch);
        channelsRef.current.set(remoteId, ch);
      };
    }

    return pc;
  }

  async function createPeerAndOffer(remoteId) {
    const pc = await ensurePeer(remoteId, true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit("webrtc:offer", { to: remoteId, sdp: pc.localDescription });
  }

  function cleanupPeer(remoteId) {
    const pc = peersRef.current.get(remoteId);
    if (pc) pc.close();
    peersRef.current.delete(remoteId);
    channelsRef.current.delete(remoteId);
    setRemoteVideos(prev => prev.filter(v => v.id !== remoteId));
  }

  // Screen Share: replace video track
  async function startScreenShare() {
    const screen = await getScreenStream();
    const screenTrack = screen.getVideoTracks()[0];

    // replace in all peers
    for (const pc of peersRef.current.values()) {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
      if (sender) sender.replaceTrack(screenTrack);
    }

    // show locally too
    localVideoRef.current.srcObject = screen;

    screenTrack.onended = () => stopScreenShare();
  }

  async function stopScreenShare() {
    const camStream = await getLocalStream();
    localStreamRef.current = camStream;
    localVideoRef.current.srcObject = camStream;

    const camTrack = camStream.getVideoTracks()[0];
    for (const pc of peersRef.current.values()) {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
      if (sender) sender.replaceTrack(camTrack);
    }
  }

  // ----- File via DataChannel (chunk) -----
  function setupDataChannel(remoteId, ch) {
    let receiving = { meta: null, chunks: [], size: 0 };

    ch.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        const msg = JSON.parse(ev.data);
        if (msg.type === "file-meta") receiving.meta = msg;
        if (msg.type === "file-end" && receiving.meta) {
          const blob = new Blob(receiving.chunks);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = receiving.meta.name;
          a.click();
          receiving = { meta: null, chunks: [], size: 0 };
        }
      } else {
        receiving.chunks.push(ev.data);
      }
    };
  }

  async function sendFile(file) {
    const buf = await file.arrayBuffer();
    const chunkSize = 16 * 1024;
    for (const [id, ch] of channelsRef.current.entries()) {
      if (ch.readyState !== "open") continue;

      ch.send(JSON.stringify({ type: "file-meta", name: file.name, size: file.size }));
      for (let i = 0; i < buf.byteLength; i += chunkSize) {
        ch.send(buf.slice(i, i + chunkSize));
      }
      ch.send(JSON.stringify({ type: "file-end" }));
    }
  }

  // ----- Whiteboard -----
  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    return { x, y };
  }

  function drawStroke(stroke, emit = true) {
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.from.x, stroke.from.y);
    ctx.lineTo(stroke.to.x, stroke.to.y);
    ctx.stroke();

    if (emit) socketRef.current.emit("wb:draw", { roomId, stroke });
  }

  function clearBoard(emit = true) {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (emit) socketRef.current.emit("wb:clear", { roomId });
  }

  function onDown(e) {
    drawing.current = true;
    last.current = getPos(e);
  }
  function onMove(e) {
    if (!drawing.current) return;
    const now = getPos(e);
    drawStroke({ from: last.current, to: now }, true);
    last.current = now;
  }
  function onUp() { drawing.current = false; }

  return (
    <div className="container">
      <h2>Room</h2>

      <div className="row">
        <input value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        {!joined ? <button onClick={join}>Join</button> : <button onClick={startScreenShare}>Share Screen</button>}
        <button onClick={() => clearBoard(true)} disabled={!joined}>Clear Board</button>
        <input type="file" disabled={!joined} onChange={(e) => e.target.files?.[0] && sendFile(e.target.files[0])} />
      </div>

      <div className="grid">
        <div className="card">
          <h3>Local</h3>
          <video ref={localVideoRef} autoPlay playsInline muted />
        </div>

        {remoteVideos.map(v => (
          <div className="card" key={v.id}>
            <h3>Remote: {v.id.slice(0, 6)}</h3>
            <video autoPlay playsInline ref={(el) => { if (el) el.srcObject = v.stream; }} />
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Whiteboard</h3>
        <canvas
          ref={canvasRef}
          width={900}
          height={380}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          style={{ width: "100%", background: "#0b1220", border: "1px solid #2c3f70", borderRadius: 10 }}
        />
      </div>
    </div>
  );
}
