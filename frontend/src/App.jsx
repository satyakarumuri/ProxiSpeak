import { useEffect, useState, useRef } from "react";
import "./App.css";
import { SpatialAudioEngine } from "./audio/SpatialAudioEngine.js";

const initialUsers = [
  { id: 1, name: "You (Sarthak)", x: 44, y: 48, color: "#7567F8", you: true },
  { id: 2, name: "Alex", x: 67, y: 30, color: "#F29D69" },
  { id: 3, name: "Mia", x: 26, y: 70, color: "#51BBA7" },
  { id: 4, name: "Sam", x: 75, y: 72, color: "#E879A9" },
];

export default function App() {
  const [users, setUsers] = useState(initialUsers);
  const [muted, setMuted] = useState(true);
  const [micStream, setMicStream] = useState(null);
  const [micError, setMicError] = useState("");
  const [activeTab, setActiveTab] = useState("Office");

  // Spatial Audio State (Sarthak's Audio Module)
  const [spatialAudioActive, setSpatialAudioActive] = useState(false);
  const [speakingLevel, setSpeakingLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [peerAudioStats, setPeerAudioStats] = useState({});

  const spatialEngineRef = useRef(null);
  const simAudioCtxRef = useRef(null);

  // Initialize SpatialAudioEngine once
  useEffect(() => {
    spatialEngineRef.current = new SpatialAudioEngine({
      minDistance: 6,   // Under 6% distance: 100% volume
      maxDistance: 35,  // Over 35% distance: 0% volume (cutoff)
      panSpan: 25,      // Stereo pan horizontal range
    });

    return () => {
      if (spatialEngineRef.current) {
        spatialEngineRef.current.cleanup();
      }
      if (simAudioCtxRef.current) {
        simAudioCtxRef.current.close();
      }
    };
  }, []);

  // Update proximity audio calculations when avatars move
  useEffect(() => {
    if (!spatialEngineRef.current) return;

    const myUser = users.find((u) => u.you);
    if (!myUser) return;

    const stats = {};
    users.forEach((peer) => {
      if (peer.you) return;
      const res = spatialEngineRef.current.updatePeerProximity(
        peer.id,
        { x: myUser.x, y: myUser.y },
        { x: peer.x, y: peer.y }
      );
      if (res) {
        stats[peer.id] = res;
      }
    });

    setPeerAudioStats(stats);
  }, [users, spatialAudioActive]);

  // Speaking detection poll loop (detects user talking into microphone)
  useEffect(() => {
    let interval;
    if (micStream && !muted && spatialEngineRef.current) {
      interval = setInterval(() => {
        const level = spatialEngineRef.current.getSpeakingLevel("local");
        setSpeakingLevel(Math.round(level * 100));
        setIsSpeaking(level > 0.08);
      }, 80);
    } else {
      setSpeakingLevel(0);
      setIsSpeaking(false);
    }

    return () => clearInterval(interval);
  }, [micStream, muted]);

  // Handle Microphone Toggle
  async function handleMicToggle() {
    setMicError("");

    if (!muted) {
      micStream?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      setMuted(true);
      return;
    }

    if (micStream) {
      micStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      setMuted(false);
      return;
    }

    try {
      await spatialEngineRef.current?.ensureAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      spatialEngineRef.current?.setLocalStream(stream);
      setMicStream(stream);
      setMuted(false);
    } catch (error) {
      setMicError(
        error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access in your browser settings."
          : "Could not access the microphone. Check your device and browser permissions."
      );
    }
  }

  // Toggle 3D Spatial Audio Simulation for Nearby Peers
  async function handleToggleSpatialSimulation() {
    if (!spatialEngineRef.current) return;
    await spatialEngineRef.current.ensureAudioContext();

    if (!spatialAudioActive) {
      // Create simulated ambient voice streams for Alex, Mia, Sam
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      simAudioCtxRef.current = ctx;

      const peerFrequencies = {
        2: [261.63, 329.63], // Alex: C4, E4
        3: [329.63, 392.00], // Mia: E4, G4
        4: [392.00, 523.25], // Sam: G4, C5
      };

      Object.entries(peerFrequencies).forEach(([peerId, freqs]) => {
        const dest = ctx.createMediaStreamDestination();
        let idx = 0;

        function playChord() {
          if (!simAudioCtxRef.current || simAudioCtxRef.current.state === "closed") return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freqs[idx % freqs.length], ctx.currentTime);
          idx++;

          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

          osc.connect(gain);
          gain.connect(dest);

          osc.start();
          osc.stop(ctx.currentTime + 0.42);

          setTimeout(playChord, 700 + parseInt(peerId) * 120);
        }

        playChord();
        spatialEngineRef.current.addPeerStream(peerId, dest.stream);
      });

      setSpatialAudioActive(true);
    } else {
      if (simAudioCtxRef.current) {
        simAudioCtxRef.current.close();
        simAudioCtxRef.current = null;
      }
      [2, 3, 4].forEach((id) => spatialEngineRef.current.removePeer(id));
      setSpatialAudioActive(false);
    }
  }

  // Keyboard navigation (WASD / Arrows)
  useEffect(() => {
    function handleMovement(event) {
      const key = event.key.toLowerCase();

      const directions = {
        arrowup: [0, -3],
        w: [0, -3],
        arrowdown: [0, 3],
        s: [0, 3],
        arrowleft: [-3, 0],
        a: [-3, 0],
        arrowright: [3, 0],
        d: [3, 0],
      };

      if (event.target instanceof HTMLElement) {
        if (
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
          event.target.isContentEditable
        ) {
          return;
        }
      }

      if (directions[key]) {
        event.preventDefault();
        moveAvatar(...directions[key]);
      }
    }

    window.addEventListener("keydown", handleMovement);
    return () => window.removeEventListener("keydown", handleMovement);
  }, []);

  function moveAvatar(dx, dy) {
    setUsers((current) =>
      current.map((user) =>
        user.you
          ? {
              ...user,
              x: Math.max(8, Math.min(92, user.x + dx)),
              y: Math.max(12, Math.min(88, user.y + dy)),
            }
          : user
      )
    );
  }

  function handleMapClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setUsers((current) =>
      current.map((user) =>
        user.you
          ? {
              ...user,
              x: Math.max(8, Math.min(92, x)),
              y: Math.max(12, Math.min(88, y)),
            }
          : user
      )
    );
  }

  const myUser = users.find((user) => user.you);

  const nearbyUsers = users.filter((user) => {
    if (user.you) return false;
    return Math.hypot(user.x - myUser.x, user.y - myUser.y) < 35;
  });

  return (
    <main className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <strong>ProxiSpeak</strong>
            <span>Virtual workspace</span>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>
        {["Office", "People", "Settings"].map((tab) => (
          <button
            key={tab}
            className={`nav-item ${activeTab === tab ? "selected" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            <span>{tab === "Office" ? "▦" : tab === "People" ? "♧" : "⚙"}</span>
            {tab}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            <strong>Spatial Engine Online</strong>
            <span>Web Audio API Active</span>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR DIGITAL OFFICE</p>
            <h1>{activeTab === "Office" ? "Good to see you, Sarthak!" : activeTab}</h1>
          </div>
          <div className="profile">
            <div className="profile-avatar">S</div>
            <div>
              <strong>Sarthak</strong>
              <span>Audio Engineer</span>
            </div>
          </div>
        </header>

        {activeTab === "Office" ? (
          <>
            <section className="welcome-card">
              <div>
                <span className="live-badge">
                  <span /> LIVE 3D SPATIAL AUDIO
                </span>
                <h2>A little closer.<br />A lot more connected.</h2>
                <p>Move around the office and experience proximity-based voice volume and stereo panning.</p>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <div className="art-person">🎧</div>
                <div className="art-spark spark-one">✳</div>
                <div className="art-spark spark-two">✦</div>
              </div>
            </section>

            <div className="section-heading">
              <div>
                <h2>Office floor</h2>
                <p>Click or use WASD to walk. Proximity ring shows audio range.</p>
              </div>
              <span className="people-count">♧ {users.length} people in office</span>
            </div>

            {/* Office 2D Map */}
            <section
              className="office-map"
              aria-label="Interactive virtual office map"
              onClick={handleMapClick}
            >
              {/* Proximity Radar Ring */}
              <div
                className="proximity-ring"
                style={{
                  left: `${myUser.x}%`,
                  top: `${myUser.y}%`,
                  width: "180px",
                  height: "180px",
                }}
              />

              <div className="room room-meeting">
                <span className="room-label">MEETING ROOM</span>
                <div className="meeting-table">
                  <span /><span /><span /><span />
                </div>
              </div>

              <div className="room room-lounge">
                <span className="room-label">LOUNGE</span>
                <div className="sofa" />
                <div className="coffee-table" />
              </div>

              <div className="room room-work">
                <span className="room-label">OPEN WORKSPACE</span>
                {[0, 1, 2, 3].map((item) => (
                  <div className="desk" key={item}>
                    <div className="monitor" />
                    <div className="chair" />
                  </div>
                ))}
              </div>

              <div className="plant plant-one">✿</div>
              <div className="plant plant-two">✿</div>
              <div className="plant plant-three">✿</div>

              {/* Avatars */}
              {users.map((user) => {
                const userSpeaking = user.you ? isSpeaking : false;
                return (
                  <div
                    key={user.id}
                    className={`map-user ${user.you ? "current-user" : ""}`}
                    style={{ left: `${user.x}%`, top: `${user.y}%`, "--avatar": user.color }}
                    title={`${user.name}${user.you ? " (you)" : ""}`}
                  >
                    <div className={`user-avatar ${userSpeaking ? "is-speaking" : ""}`}>
                      {user.you ? "S" : user.name.charAt(0)}
                    </div>
                    <span className="user-name">{user.name}</span>
                    {user.you && <span className="you-indicator">YOU</span>}
                  </div>
                );
              })}

              <div className="map-hint">Click the map, then use WASD or arrow keys to move around</div>
            </section>

            {/* Bottom Grid: Nearby People & Audio Control Card */}
            <section className="bottom-grid">
              {/* Nearby People */}
              <div className="content-card">
                <div className="card-heading">
                  <div>
                    <h3>Nearby people</h3>
                    <p>Live spatial proximity calculation</p>
                  </div>
                  <span className="online-count">{nearbyUsers.length} in audio range</span>
                </div>
                {nearbyUsers.length ? (
                  nearbyUsers.map((user) => {
                    const stats = peerAudioStats[user.id];
                    const volPct = stats ? Math.round(stats.gain * 100) : 0;
                    const panLabel =
                      stats && stats.pan !== 0
                        ? stats.pan < 0
                          ? "Left ear"
                          : "Right ear"
                        : "Center";

                    return (
                      <div className="person-row" key={user.id}>
                        <div className="small-avatar" style={{ "--avatar": user.color }}>
                          {user.name[0]}
                        </div>
                        <div className="person-details">
                          <strong>{user.name}</strong>
                          <span>
                            <i /> Connected &middot;
                            {spatialAudioActive && (
                              <span className="peer-audio-tag">
                                🔊 {volPct}% Vol
                                <span className="peer-pan-tag">({panLabel})</span>
                              </span>
                            )}
                          </span>
                        </div>
                        <span className="distance-label">
                          {Math.round(Math.hypot(user.x - myUser.x, user.y - myUser.y))}m
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="empty-state">No one in hearing range. Walk closer to talk!</p>
                )}
              </div>

              {/* Your Audio Controls (Sarthak's Module) */}
              <div className="content-card audio-card">
                <div className="audio-icon">🎧</div>
                <h3>Spatial Proximity Audio</h3>
                <p>
                  {muted
                    ? "Microphone is muted. Turn it on to test speaking detection."
                    : "Microphone active · Speaking indicator enabled."}
                </p>

                <div className="audio-controls-row">
                  <button
                    className={`mic-button ${muted ? "muted" : ""}`}
                    onClick={handleMicToggle}
                  >
                    {muted ? "🎙 Unmute Microphone" : "⊘ Mute Microphone"}
                  </button>

                  <button
                    className={`spatial-toggle-btn ${spatialAudioActive ? "" : "off"}`}
                    onClick={handleToggleSpatialSimulation}
                  >
                    {spatialAudioActive
                      ? "⏹ Stop Spatial Audio"
                      : "▶ Listen to Nearby Peers"}
                  </button>
                </div>

                {/* Speaking Level Meter */}
                {!muted && (
                  <div className="mic-level-container">
                    <div className="mic-level-label">
                      <span>Mic Speaking Level:</span>
                      <strong>{speakingLevel}% {isSpeaking ? "(Speaking)" : ""}</strong>
                    </div>
                    <div className="mic-level-bg">
                      <div
                        className="mic-level-fill"
                        style={{ width: `${speakingLevel}%` }}
                      />
                    </div>
                  </div>
                )}

                <span className="audio-note">
                  Powered by <b>SpatialAudioEngine</b> (Web Audio API &middot; GainNode &middot; StereoPannerNode &middot; WebRTC Core)
                </span>
                {micError && <p role="alert" className="mic-error">{micError}</p>}
              </div>
            </section>
          </>
        ) : activeTab === "People" ? (
          <section className="content-card page-card">
            <h2>People in your workspace</h2>
            <p className="page-description">Virtual office members.</p>
            {users.map((user) => (
              <div className="person-row" key={user.id}>
                <div className="small-avatar" style={{ "--avatar": user.color }}>
                  {user.you ? "S" : user.name[0]}
                </div>
                <div className="person-details">
                  <strong>{user.name}{user.you ? " (you)" : ""}</strong>
                  <span><i /> In the office</span>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <section className="content-card page-card">
            <h2>Spatial Audio Settings</h2>
            <p className="page-description">Configure proximity audio attenuation and thresholds.</p>
            <div className="settings-row">
              <div>
                <strong>Web Audio API Engine</strong>
                <p>Status: Active and running with stereo spatial panner.</p>
              </div>
              <span className="badge-status live" style={{ background: "#22c55e", color: "white", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                Operational
              </span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Proximity Hearing Radius</strong>
                <p>Cutoff distance: 35% office width (Gain fades to 0% beyond this radius).</p>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <strong>Stereo Directional Panning</strong>
                <p>Audio is dynamically panned between Left (-1.0) and Right (+1.0) channels.</p>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
