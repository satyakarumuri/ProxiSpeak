
import { useEffect, useState } from "react";
import "./App.css";

const initialUsers = [
  { id: 1, name: "You", x: 44, y: 48, color: "#7567F8", you: true },
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

  
async function handleMicToggle() {
  setMicError("");

  // Mute the existing microphone track.
  if (!muted) {
    micStream?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setMuted(true);
    return;
  }

  // Re-enable an existing microphone stream.
  if (micStream) {
    micStream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    setMuted(false);
    return;
  }

  // Request permission and start the microphone.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });

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

// ADD THIS BLOCK HERE
useEffect(() => {
  return () => {
    micStream?.getTracks().forEach((track) => track.stop());
  };
}, [micStream]);


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

  return () => {
    window.removeEventListener("keydown", handleMovement);
  };
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
            <strong>Workspace online</strong>
            <span>Local demo mode</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR DIGITAL OFFICE</p>
            <h1>{activeTab === "Office" ? "Good to see you!" : activeTab}</h1>
          </div>
          <div className="profile">
            <div className="profile-avatar">Y</div>
            <div>
              <strong>Your profile</strong>
              <span>Frontend developer</span>
            </div>
          </div>
        </header>

        {activeTab === "Office" ? (
          <>
            <section className="welcome-card">
              <div>
                <span className="live-badge">
                  <span /> LIVE WORKSPACE
                </span>
                <h2>A little closer.<br />A lot more connected.</h2>
                <p>Move around the office and discover conversations nearby.</p>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <div className="art-person">✦</div>
                <div className="art-spark spark-one">✳</div>
                <div className="art-spark spark-two">✦</div>
              </div>
            </section>

            <div className="section-heading">
              <div>
                <h2>Office floor</h2>
                <p>Explore your shared workspace</p>
              </div>
              <span className="people-count">♧ {users.length} people</span>
            </div>

            <section
              className="office-map"
               aria-label="Interactive virtual office map"
               onClick={handleMapClick}
              >
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

              {users.map((user) => (
                <div
                  key={user.id}
                  className={`map-user ${user.you ? "current-user" : ""}`}
                  style={{ left: `${user.x}%`, top: `${user.y}%`, "--avatar": user.color }}
                  title={`${user.name}${user.you ? " (you)" : ""}`}
                >
                  <div className="user-avatar">
                    {user.you ? "Y" : user.name.charAt(0)}
                  </div>
                  <span className="user-name">{user.name}</span>
                  {user.you && <span className="you-indicator">YOU</span>}
                </div>
              ))}

              <div className="map-hint">Click the map, then use WASD or arrow keys</div>
            </section>

            <section className="bottom-grid">
              <div className="content-card">
                <div className="card-heading">
                  <div>
                    <h3>Nearby people</h3>
                    <p>People around your avatar</p>
                  </div>
                  <span className="online-count">{nearbyUsers.length} nearby</span>
                </div>
                {nearbyUsers.length ? (
                  nearbyUsers.map((user) => (
                    <div className="person-row" key={user.id}>
                      <div className="small-avatar" style={{ "--avatar": user.color }}>
                        {user.name[0]}
                      </div>
                      <div className="person-details">
                        <strong>{user.name}</strong>
                        <span><i /> In the office</span>
                      </div>
                      <span className="distance-label">
                        {Math.round(Math.hypot(user.x - myUser.x, user.y - myUser.y))}m
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">No one nearby. Move around to explore!</p>
                )}
              </div>

              <div className="content-card audio-card">
                <div className="audio-icon">♫</div>
                <h3>Your audio</h3>
               <p>
                 {muted
                 ? "Your microphone is muted."
                 : "Microphone active · Audio is not yet connected to other users."}
               </p>
                <button
                  className={`mic-button ${muted ? "muted" : ""}`}
                  onClick={handleMicToggle}                
                  >
                  {muted ? "♩  Unmute microphone" : "⊘  Mute microphone"}
                </button>
                <span className="audio-note">
                {muted
                ? "Microphone muted"
                : "Microphone active · Not yet connected to other users"}
                </span>
                {micError && <p role="alert" className="mic-error">{micError}</p>}
              </div>
            </section>
          </>
        ) : activeTab === "People" ? (
          <section className="content-card page-card">
            <h2>People in your workspace</h2>
            <p className="page-description">Sample users for the local prototype.</p>
            {users.map((user) => (
              <div className="person-row" key={user.id}>
                <div className="small-avatar" style={{ "--avatar": user.color }}>
                  {user.you ? "Y" : user.name[0]}
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
            <h2>Workspace settings</h2>
            <p className="page-description">Local prototype preferences.</p>
            <div className="settings-row">
              <div>
                <strong>Microphone control</strong>
                <p>Toggle the demo mute state.</p>
              </div>
              <button className={`mic-button ${muted ? "muted" : ""}`} onClick={handleMicToggle}>
                {muted ? "Muted" : "Unmuted"}
              </button>
            </div>
            <p className="audio-note">Real microphone access and proximity audio are not connected yet.</p>
          </section>
        )}
      </section>
    </main>
  );
}
