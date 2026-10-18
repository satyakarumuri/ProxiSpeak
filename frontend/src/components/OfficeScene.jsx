import React, { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { io } from "socket.io-client";
import { SpatialAudioEngine, WebRTCVoiceManager } from "../audio/index.js";

const SOCKET_URL = "http://localhost:3000";
const ROOM_ID = "office-1";

function Desk({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[2, 0.12, 1]} />
        <meshStandardMaterial color="#9b7653" />
      </mesh>

      {[
        [-0.85, 0.5, -0.35],
        [0.85, 0.5, -0.35],
        [-0.85, 0.5, 0.35],
        [0.85, 0.5, 0.35]
      ].map((leg, index) => (
        <mesh key={index} position={leg} castShadow>
          <boxGeometry args={[0.09, 1, 0.09]} />
          <meshStandardMaterial color="#51443b" />
        </mesh>
      ))}

      <mesh position={[0, 1.42, -0.25]}>
        <boxGeometry args={[0.65, 0.45, 0.08]} />
        <meshStandardMaterial
          color="#172554"
          emissive="#1d4ed8"
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh position={[0, 1.18, -0.25]}>
        <boxGeometry args={[0.08, 0.25, 0.08]} />
        <meshStandardMaterial color="#737373" />
      </mesh>

      <mesh position={[0, 0.55, 0.95]}>
        <boxGeometry args={[0.65, 0.12, 0.65]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      <mesh position={[0, 0.95, 1.23]}>
        <boxGeometry args={[0.65, 0.75, 0.12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  );
}

function AvatarModel({
  name,
  position,
  color = "#38bdf8",
  smooth = false,
  isSpeaking = false,
  proximityStats = null
}) {
  const groupRef = useRef();
  const targetPosition = useRef(new THREE.Vector3(...position));

  useEffect(() => {
    targetPosition.current.set(
      position[0],
      position[1],
      position[2]
    );
  }, [position]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (smooth) {
      groupRef.current.position.lerp(
        targetPosition.current,
        1 - Math.exp(-10 * Math.min(delta, 0.1))
      );
    } else {
      groupRef.current.position.set(
        position[0],
        position[1],
        position[2]
      );
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body capsule with glow if speaking */}
      <mesh position={[0, 1, 0]} castShadow>
        <capsuleGeometry args={[0.35, 0.65, 4, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={isSpeaking ? "#22c55e" : "#000000"}
          emissiveIntensity={isSpeaking ? 0.6 : 0}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#f0c7a4" />
      </mesh>

      {/* 3D Label & Speaking Status */}
      <Html position={[0, 2.35, 0]} center distanceFactor={10}>
        <div className="avatar-label-container">
          {isSpeaking && <span className="speaking-badge">🎙 SPEAKING</span>}
          <div className="avatar-label">{name}</div>
          {proximityStats && proximityStats.inRange && (
            <span className="avatar-proximity-label">
              🔊 {Math.round(proximityStats.gain * 100)}% vol
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

function LocalAvatar({ name, socket, connected, isSpeaking, onPositionUpdate }) {
  const avatarRef = useRef();
  const keys = useRef({});
  const lastSent = useRef(0);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)
      ) {
        event.preventDefault();
      }

      keys.current[key] = true;
    };

    const onKeyUp = (event) => {
      keys.current[event.key.toLowerCase()] = false;
    };

    const onBlur = () => {
      keys.current = {};
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useFrame((_, delta) => {
    const avatar = avatarRef.current;
    if (!avatar) return;

    const movement = new THREE.Vector3();
    const pressed = keys.current;

    if (pressed.w || pressed.arrowup) movement.z -= 1;
    if (pressed.s || pressed.arrowdown) movement.z += 1;
    if (pressed.a || pressed.arrowleft) movement.x -= 1;
    if (pressed.d || pressed.arrowright) movement.x += 1;

    if (movement.lengthSq() > 0) {
      movement.normalize();
      avatar.position.addScaledVector(
        movement,
        4 * Math.min(delta, 0.05)
      );

      avatar.position.x = THREE.MathUtils.clamp(
        avatar.position.x, -9, 9
      );
      avatar.position.z = THREE.MathUtils.clamp(
        avatar.position.z, -7, 7
      );

      if (onPositionUpdate) {
        onPositionUpdate([avatar.position.x, 0, avatar.position.z]);
      }
    }

    const now = performance.now();

    if (connected && socket?.connected && now - lastSent.current >= 66) {
      lastSent.current = now;

      socket.emit("avatar:move", {
        roomId: ROOM_ID,
        position: {
          x: avatar.position.x,
          y: 0,
          z: avatar.position.z
        },
        rotation: 0
      });
    }
  });

  return (
    <group ref={avatarRef} position={[0, 0, 2]}>
      <AvatarModel
        name={name || "You"}
        position={[0, 0, 0]}
        color="#3b82f6"
        isSpeaking={isSpeaking}
      />
    </group>
  );
}

function OfficeEnvironment({
  name,
  socket,
  connected,
  remoteUsers,
  isLocalSpeaking,
  peerSpeakingMap,
  proximityStatsMap,
  onLocalPositionUpdate
}) {
  return (
    <>
      <color attach="background" args={["#dbeafe"]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[5, 10, 5]} intensity={2} castShadow />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.08, 0]}
        receiveShadow
      >
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>

      <mesh position={[0, 2.5, -9]}>
        <boxGeometry args={[22, 5, 0.2]} />
        <meshStandardMaterial color="#bfdbfe" />
      </mesh>

      <mesh position={[-11, 2.5, 0]}>
        <boxGeometry args={[0.2, 5, 18]} />
        <meshStandardMaterial color="#c7d2fe" />
      </mesh>

      <mesh position={[11, 2.5, 0]}>
        <boxGeometry args={[0.2, 5, 18]} />
        <meshStandardMaterial color="#c7d2fe" />
      </mesh>

      <Desk position={[-5, 0, -3]} />
      <Desk position={[0, 0, -3]} />
      <Desk position={[5, 0, -3]} />
      <Desk position={[-5, 0, 2]} />
      <Desk position={[5, 0, 2]} />

      <LocalAvatar
        name={name}
        socket={socket}
        connected={connected}
        isSpeaking={isLocalSpeaking}
        onPositionUpdate={onLocalPositionUpdate}
      />

      {remoteUsers.map((user, index) => (
        <AvatarModel
          key={user.id}
          name={user.name}
          position={[
            user.position?.x ?? (index % 3) * 2 - 2,
            user.position?.y ?? 0,
            user.position?.z ?? -1
          ]}
          color="#a78bfa"
          smooth
          isSpeaking={!!peerSpeakingMap[user.id]}
          proximityStats={proximityStatsMap[user.id]}
        />
      ))}
    </>
  );
}

export default function OfficeScene({ name = "You" }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [connectionMessage, setConnectionMessage] = useState(
    "Connecting to office..."
  );

  // Audio & Voice Chat State (Sarthak's Module)
  const [muted, setMuted] = useState(true);
  const [speakingLevel, setSpeakingLevel] = useState(0);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [peerSpeakingMap, setPeerSpeakingMap] = useState({});
  const [proximityStatsMap, setProximityStatsMap] = useState({});
  const [simAudioActive, setSimAudioActive] = useState(false);

  const localPosRef = useRef([0, 0, 2]);
  const spatialEngine = useRef(null);
  const voiceManager = useRef(null);
  const simAudioCtxRef = useRef(null);
  const socketRef = useRef(null);

  // Initialize Spatial Engine & WebRTC Voice Manager
  useEffect(() => {
    spatialEngine.current = new SpatialAudioEngine({
      minDistance: 2.0, // 100% volume within 2 Three.js units
      maxDistance: 9.0, // 0% volume cutoff beyond 9 units
      panSpan: 7.0      // Left/Right stereo panning range
    });

    voiceManager.current = new WebRTCVoiceManager({
      onSignal: (targetPeerId, signal) => {
        if (socketRef.current?.connected) {
          socketRef.current.emit("voice:signal", {
            to: targetPeerId,
            signal
          });
        }
      },
      onPeerStream: (peerId, stream) => {
        spatialEngine.current?.addPeerStream(peerId, stream);
      },
      onPeerLeave: (peerId) => {
        spatialEngine.current?.removePeer(peerId);
        setPeerSpeakingMap((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    });

    return () => {
      spatialEngine.current?.cleanup();
      voiceManager.current?.cleanup();
      if (simAudioCtxRef.current) {
        simAudioCtxRef.current.close();
      }
    };
  }, []);

  // Update proximity audio for all remote users
  const updateAudioProximity = useCallback((localPos, usersList) => {
    if (!spatialEngine.current) return;

    const stats = {};
    (usersList || []).forEach((user) => {
      if (!user.id) return;
      const peerPos = user.position || { x: 0, y: 0, z: 0 };
      const res = spatialEngine.current.updatePeerProximity(
        user.id,
        { x: localPos[0], y: localPos[1], z: localPos[2] },
        peerPos
      );
      if (res) {
        stats[user.id] = res;
      }
    });

    setProximityStatsMap(stats);
  }, []);

  const handleLocalPositionUpdate = useCallback((newPos) => {
    localPosRef.current = newPos;
    updateAudioProximity(newPos, remoteUsers);
  }, [remoteUsers, updateAudioProximity]);

  // Speaking detection poll loop for local microphone
  useEffect(() => {
    let interval;
    if (!muted && spatialEngine.current) {
      interval = setInterval(() => {
        const level = spatialEngine.current.getSpeakingLevel("local");
        const pct = Math.round(level * 100);
        const speaking = level > 0.08;

        setSpeakingLevel(pct);
        setIsLocalSpeaking(speaking);

        if (socketRef.current?.connected) {
          socketRef.current.emit("voice:status", { speaking, muted: false });
        }
      }, 90);
    } else {
      setSpeakingLevel(0);
      setIsLocalSpeaking(false);
      if (socketRef.current?.connected) {
        socketRef.current.emit("voice:status", { speaking: false, muted: true });
      }
    }

    return () => clearInterval(interval);
  }, [muted]);

  // Toggle Microphone
  async function handleToggleMic() {
    await spatialEngine.current?.ensureAudioContext();

    if (!muted) {
      voiceManager.current?.setMuted(true);
      setMuted(true);
      return;
    }

    try {
      const stream = await voiceManager.current?.startMicrophone();
      spatialEngine.current?.setLocalStream(stream);
      voiceManager.current?.setMuted(false);
      setMuted(false);

      // Call all existing peers in the room
      remoteUsers.forEach((user) => {
        voiceManager.current?.callPeer(user.id);
      });
    } catch (err) {
      alert("Microphone access failed: " + err.message);
    }
  }

  // Toggle Simulated 3D Audio for Solo Testing
  async function handleToggleAudioSim() {
    await spatialEngine.current?.ensureAudioContext();

    if (!simAudioActive) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      simAudioCtxRef.current = ctx;

      // Add a simulated sound emitter to each remote user or a dummy peer
      const peersToSimulate = remoteUsers.length > 0
        ? remoteUsers
        : [{ id: "sim-peer-1", name: "Desk Chime", position: { x: -5, y: 0, z: -3 } }];

      peersToSimulate.forEach((peer, i) => {
        const dest = ctx.createMediaStreamDestination();
        const freqs = [261.63, 329.63, 392.0, 523.25];
        let idx = i;

        function chime() {
          if (!simAudioCtxRef.current || simAudioCtxRef.current.state === "closed") return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freqs[idx % freqs.length], ctx.currentTime);
          idx++;

          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

          osc.connect(gain);
          gain.connect(dest);

          osc.start();
          osc.stop(ctx.currentTime + 0.46);

          setTimeout(chime, 800 + i * 200);
        }

        chime();
        spatialEngine.current.addPeerStream(peer.id, dest.stream);
      });

      setSimAudioActive(true);
      updateAudioProximity(localPosRef.current, remoteUsers);
    } else {
      if (simAudioCtxRef.current) {
        simAudioCtxRef.current.close();
        simAudioCtxRef.current = null;
      }
      remoteUsers.forEach((u) => spatialEngine.current?.removePeer(u.id));
      spatialEngine.current?.removePeer("sim-peer-1");
      setSimAudioActive(false);
    }
  }

  // Socket Connection & WebRTC Signaling Integration
  useEffect(() => {
    const token = localStorage.getItem("proxispeak_token");

    if (!token) {
      setConnectionMessage("Please log in again.");
      return;
    }

    const client = io(SOCKET_URL, {
      auth: { token },
      reconnection: true
    });

    setSocket(client);
    socketRef.current = client;

    client.on("connect", () => {
      setConnected(true);
      setConnectionMessage("Joining office...");

      client.emit(
        "office:join",
        { roomId: ROOM_ID, user: { name } },
        (result) => {
          if (!result?.ok) {
            setConnectionMessage(
              result?.message || "Unable to join office."
            );
            return;
          }

          const existingPeers = (result.users || []).filter(
            (user) => user.id !== client.id
          );
          setRemoteUsers(existingPeers);
          setConnectionMessage("Connected to virtual office");
          updateAudioProximity(localPosRef.current, existingPeers);

          // If mic already active, initiate voice calls
          if (!muted) {
            existingPeers.forEach((p) => voiceManager.current?.callPeer(p.id));
          }
        }
      );
    });

    client.on("connect_error", (error) => {
      setConnected(false);
      setConnectionMessage(`Connection error: ${error.message}`);
    });

    client.on("disconnect", () => {
      setConnected(false);
      setConnectionMessage("Disconnected. Reconnecting...");
      setRemoteUsers([]);
      setPeerSpeakingMap({});
      setProximityStatsMap({});
    });

    client.on("office:users", (users) => {
      const activePeers = (users || []).filter((user) => user.id !== client.id);
      setRemoteUsers(activePeers);
      updateAudioProximity(localPosRef.current, activePeers);
    });

    client.on("office:user-joined", (user) => {
      if (user.id === client.id) return;

      setRemoteUsers((previous) => {
        const updated = [...previous.filter((item) => item.id !== user.id), user];
        updateAudioProximity(localPosRef.current, updated);
        return updated;
      });

      // Automatically initiate WebRTC voice call to new user
      if (!muted) {
        voiceManager.current?.callPeer(user.id);
      }
    });

    client.on("avatar:moved", (update) => {
      setRemoteUsers((previous) => {
        const updated = previous.map((user) =>
          user.id === update.userId
            ? {
                ...user,
                position: update.position,
                rotation: update.rotation
              }
            : user
        );
        updateAudioProximity(localPosRef.current, updated);
        return updated;
      });
    });

    client.on("office:user-left", ({ userId }) => {
      setRemoteUsers((previous) => {
        const updated = previous.filter((user) => user.id !== userId);
        updateAudioProximity(localPosRef.current, updated);
        return updated;
      });
      voiceManager.current?.removePeer(userId);
      spatialEngine.current?.removePeer(userId);
    });

    // WebRTC Voice Signaling Handlers (Sarthak's Module)
    client.on("voice:signal", ({ from, signal }) => {
      voiceManager.current?.handleSignal(from, signal);
    });

    client.on("voice:status", ({ userId, speaking }) => {
      setPeerSpeakingMap((prev) => ({
        ...prev,
        [userId]: !!speaking
      }));
    });

    return () => {
      client.emit("office:leave");
      client.disconnect();
    };
  }, [name, muted, updateAudioProximity]);

  return (
    <div className="office-canvas">
      {/* 3D Proximity Voice HUD (Sarthak's Audio Module) */}
      <div className="voice-hud">
        <div className="voice-hud-header">
          <div className="voice-hud-title">
            <span>🎧</span> 3D Proximity Audio
          </div>
          <span className="voice-status-tag">
            {connected ? "Live WebRTC" : "Offline"}
          </span>
        </div>

        <div className="voice-hud-actions">
          <button
            className={`voice-btn voice-btn-mic ${muted ? "muted" : ""}`}
            onClick={handleToggleMic}
            title="Toggle Microphone (M)"
          >
            {muted ? "🎙 Unmute Mic" : "⊘ Mute Mic"}
          </button>

          <button
            className={`voice-btn voice-btn-sim ${simAudioActive ? "active" : ""}`}
            onClick={handleToggleAudioSim}
            title="Test Proximity Chimes in Headphones"
          >
            {simAudioActive ? "⏹ Stop Test Audio" : "▶ Test 3D Sound"}
          </button>
        </div>

        {!muted && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
              <span>Mic Activity:</span>
              <strong>{speakingLevel}% {isLocalSpeaking ? "(Speaking)" : ""}</strong>
            </div>
            <div className="voice-meter-bar">
              <div
                className="voice-meter-fill"
                style={{ width: `${speakingLevel}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <Canvas shadows camera={{ position: [11, 12, 16], fov: 45 }}>
        <OfficeEnvironment
          name={name}
          socket={socket}
          connected={connected}
          remoteUsers={remoteUsers}
          isLocalSpeaking={isLocalSpeaking}
          peerSpeakingMap={peerSpeakingMap}
          proximityStatsMap={proximityStatsMap}
          onLocalPositionUpdate={handleLocalPositionUpdate}
        />

        <OrbitControls
          makeDefault
          target={[0, 0.5, 0]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={8}
          maxDistance={28}
        />
      </Canvas>

      <div className="office-controls">
        <strong>Movement controls</strong>
        <span>W A S D or arrow keys</span>
        <span>Drag to rotate · Scroll to zoom</span>
        <span>{connectionMessage}</span>
        <span>People in office: {remoteUsers.length + 1}</span>
      </div>
    </div>
  );
}
