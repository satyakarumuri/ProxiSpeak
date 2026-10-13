
import { useEffect, useState } from "react";
import "./App.css";

const DEMO_USERS = [
  { id: 2, name: "Alex", role: "Product Designer", status: "Available", x: 67, y: 30, color: "#F29D69" },
  { id: 3, name: "Mia", role: "Developer", status: "Available", x: 26, y: 70, color: "#51BBA7" },
  { id: 4, name: "Sam", role: "Team Member", status: "Busy", x: 75, y: 72, color: "#E879A9" },
];

const DEFAULT_PROFILE = {
  name: "",
  email: "",
  role: "Frontend Developer",
  status: "Available",
  bio: "",
  avatar: "",
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [account, setAccount] = useState(() =>
    readStorage("proxispeak-account", null)
  );
  const [accounts, setAccounts] = useState(() =>
    readStorage("proxispeak-demo-accounts", [])
  );
  const [authPage, setAuthPage] = useState("login");
  const [activeTab, setActiveTab] = useState("Office");
  const [users, setUsers] = useState([
  {
    id: 1,
    name: "You",
    role: "Frontend Developer",
    status: "Available",
    x: 44,
    y: 48,
    color: "#8C7CF6",
    you: true,
  },
  ...DEMO_USERS,
]);
  const [muted, setMuted] = useState(true);
  const [micStream, setMicStream] = useState(null);
  const [micError, setMicError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [notice, setNotice] = useState("");
  const [authError, setAuthError] = useState("");

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [profileForm, setProfileForm] = useState(DEFAULT_PROFILE);

  const myUser = {
    id: 1,
    ...profileForm,
    name: profileForm.name || "You",
    x: 44,
    y: 48,
    color: "#8C7CF6",
    you: true,
  };

  const allUsers = users.map((user) =>
  user.id === 1
    ? {
        ...user,
        ...profileForm,
        x: user.x,
        y: user.y,
        color: user.color,
        you: true,
      }
    : user
  );

  // Restore the signed-in user's profile.
  useEffect(() => {
    if (account) {
      setProfileForm({ ...DEFAULT_PROFILE, ...account });
    }
  }, [account]);

  // Stop microphone tracks when leaving the application.
  useEffect(() => {
    return () => {
      micStream?.getTracks().forEach((track) => track.stop());
    };
  }, [micStream]);

  function saveAccounts(nextAccounts) {
    setAccounts(nextAccounts);
    localStorage.setItem(
      "proxispeak-demo-accounts",
      JSON.stringify(nextAccounts)
    );
  }

  function updateProfileField(field, value) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function register(event) {
    event.preventDefault();
    setAuthError("");

    if (registerForm.password.length < 8) {
      setAuthError("Use a password with at least 8 characters.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError("Your passwords do not match.");
      return;
    }

    if (
      accounts.some(
        (item) =>
          item.email.toLowerCase() === registerForm.email.trim().toLowerCase()
      )
    ) {
      setAuthError("An account with this email already exists. Please sign in.");
      return;
    }

    const newAccount = {
      ...DEFAULT_PROFILE,
      name: registerForm.name.trim(),
      email: registerForm.email.trim().toLowerCase(),
      role: "Frontend Developer",
      status: "Available",
      password: registerForm.password,
    };

    const nextAccounts = [...accounts, newAccount];
    saveAccounts(nextAccounts);

    // Prototype-only local session.
    const publicProfile = { ...newAccount };
    delete publicProfile.password;
    setAccount(publicProfile);
    localStorage.setItem("proxispeak-account", JSON.stringify(publicProfile));
    setProfileForm(publicProfile);
    setActiveTab("Office");
  }

  function login(event) {
    event.preventDefault();
    setAuthError("");

    const found = accounts.find(
      (item) =>
        item.email.toLowerCase() === loginForm.email.trim().toLowerCase() &&
        item.password === loginForm.password
    );

    if (!found) {
      setAuthError(
        "We couldn't find a matching demo account. Create an account first."
      );
      return;
    }

    const publicProfile = { ...found };
    delete publicProfile.password;
    setAccount(publicProfile);
    localStorage.setItem("proxispeak-account", JSON.stringify(publicProfile));
    setProfileForm(publicProfile);
    setActiveTab("Office");
  }

  function saveProfile(event) {
    event.preventDefault();

    const updated = { ...profileForm };
    setAccount(updated);
    localStorage.setItem("proxispeak-account", JSON.stringify(updated));

    const nextAccounts = accounts.map((item) =>
      item.email === updated.email
        ? { ...item, ...updated, password: item.password }
        : item
    );

    saveAccounts(nextAccounts);
    setEditingProfile(false);
    setNotice("Your profile has been saved on this device.");
    setTimeout(() => setNotice(""), 3000);
  }

  function logout() {
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
    }

    setMicStream(null);
    setMuted(true);
    setAccount(null);
    setActiveTab("Office");
    setSelectedUser(null);
    localStorage.removeItem("proxispeak-account");
  }

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setMicStream(stream);
      setMuted(false);
    } catch (error) {
      setMicError(
        error.name === "NotAllowedError"
          ? "Microphone permission was denied. Check your browser settings."
          : "Could not access the microphone. Check your device and permissions."
      );
    }
  }

  function moveAvatar(dx, dy) {
    setUsers((current) =>
      current.map((user) =>
        user.id === 1
          ? {
              ...user,
              x: Math.max(8, Math.min(92, user.x + dx)),
              y: Math.max(12, Math.min(88, user.y + dy)),
            }
          : user
      )
    );
  }

  useEffect(() => {
    if (!account || activeTab !== "Office") return;

    function handleMovement(event) {
      if (
        event.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
          event.target.isContentEditable)
      ) {
        return;
      }

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

      const direction = directions[event.key.toLowerCase()];
      if (direction) {
        event.preventDefault();
        moveAvatar(...direction);
      }
    }

    window.addEventListener("keydown", handleMovement);
    return () => window.removeEventListener("keydown", handleMovement);
  }, [account, activeTab]);

  function handleMapClick(event) {
    if (event.target.closest(".map-user")) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setUsers((current) =>
      current.map((user) =>
        user.id === 1
          ? {
              ...user,
              x: Math.max(8, Math.min(92, x)),
              y: Math.max(12, Math.min(88, y)),
            }
          : user
      )
    );
  }

  const currentUser = allUsers[0];
  const nearbyUsers = allUsers.filter(
    (user) =>
      !user.you &&
      Math.hypot(user.x - currentUser.x, user.y - currentUser.y) < 35
  );

  function openUserCard(user) {
    if (user.you) {
      setActiveTab("Profile");
      setSelectedUser(null);
    } else {
      setSelectedUser(user);
    }
  }

  function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setNotice("Please choose an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setNotice("Choose an image smaller than 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateProfileField("avatar", reader.result);
    };
    reader.readAsDataURL(file);
  }

  if (!account) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="brand-icon">P</div>
            <div>
              <strong>ProxiSpeak</strong>
              <span>Your people, closer.</span>
            </div>
          </div>

          <div className="auth-illustration" aria-hidden="true">
            <span>🌿</span>
            <span>🪴</span>
            <span>🛋️</span>
            <span>💜</span>
          </div>

          <p className="eyebrow">YOUR COZY DIGITAL WORKSPACE</p>
          <h1>
            {authPage === "login" ? "Welcome back!" : "Make yourself at home."}
          </h1>
          <p className="auth-subtitle">
            {authPage === "login"
              ? "Sign in and pick up where your team left off."
              : "Create your account and join your virtual office."}
          </p>

          {authPage === "login" ? (
            <form onSubmit={login} className="auth-form">
              <label>
                Email address
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm({ ...loginForm, email: event.target.value })
                  }
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm({
                      ...loginForm,
                      password: event.target.value,
                    })
                  }
                />
              </label>
              <button className="auth-primary" type="submit">
                Sign in to ProxiSpeak →
              </button>
              <p className="auth-switch">
                New around here?{" "}
                <button type="button" onClick={() => {
                  setAuthError("");
                  setAuthPage("register");
                }}>
                  Create an account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={register} className="auth-form">
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  autoComplete="name"
                  placeholder="Your name"
                  value={registerForm.name}
                  onChange={(event) =>
                    setRegisterForm({ ...registerForm, name: event.target.value })
                  }
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm({ ...registerForm, email: event.target.value })
                  }
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      password: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  value={registerForm.confirmPassword}
                  onChange={(event) =>
                    setRegisterForm({
                      ...registerForm,
                      confirmPassword: event.target.value,
                    })
                  }
                />
              </label>
              <button className="auth-primary" type="submit">
                Create my account →
              </button>
              <p className="auth-switch">
                Already have an account?{" "}
                <button type="button" onClick={() => {
                  setAuthError("");
                  setAuthPage("login");
                }}>
                  Sign in
                </button>
              </p>
            </form>
          )}

          {authError && <p role="alert" className="mic-error">{authError}</p>}
          <p className="prototype-note">
            Frontend prototype · Accounts are stored only in this browser.
          </p>
        </section>
      </main>
    );
  }

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

        <p className="nav-label">YOUR WORKSPACE</p>
        {["Office", "People", "Profile", "Settings"].map((tab) => (
          <button
            key={tab}
            className={`nav-item ${activeTab === tab ? "selected" : ""}`}
            onClick={() => {
              setActiveTab(tab);
              setSelectedUser(null);
            }}
          >
            <span>
              {tab === "Office" ? "▦" : tab === "People" ? "♧" : tab === "Profile" ? "☺" : "⚙"}
            </span>
            {tab}
          </button>
        ))}

        <button className="sidebar-bottom signout-button" onClick={logout}>
          <span className="status-dot" />
          <span>
            <strong>Sign out</strong>
            <small>Local demo session</small>
          </span>
        </button>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR DIGITAL OFFICE</p>
            <h1>
              {activeTab === "Office"
                ? "Good to see you!"
                : activeTab === "Profile"
                  ? "My profile"
                  : activeTab}
            </h1>
          </div>
          <button
            className="profile top-profile-button"
            onClick={() => setActiveTab("Profile")}
          >
            {profileForm.avatar ? (
              <img className="profile-avatar profile-photo" src={profileForm.avatar} alt="" />
            ) : (
              <div className="profile-avatar">
                {(profileForm.name || "Y").charAt(0).toUpperCase()}
              </div>
            )}
            <span className="top-profile-text">
              <strong>{profileForm.name}</strong>
              <span>{profileForm.role}</span>
            </span>
          </button>
        </header>

        {activeTab === "Office" && (
          <>
            <section className="welcome-card">
              <div>
                <span className="live-badge"><span /> LOCAL WORKSPACE</span>
                <h2>A little closer.<br />A lot more connected.</h2>
                <p>Move around the office and discover your teammates nearby.</p>
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
                <p>Click a teammate to view their profile card</p>
              </div>
              <span className="people-count">♧ {allUsers.length} people</span>
            </div>

            <section className="office-map" aria-label="Interactive virtual office map" onClick={handleMapClick}>
              <div className="room room-meeting">
                <span className="room-label">MEETING ROOM</span>
                <div className="meeting-table"><span /><span /><span /><span /></div>
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

              {allUsers.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  className={`map-user ${user.you ? "current-user" : ""}`}
                  style={{ left: `${user.x}%`, top: `${user.y}%`, "--avatar": user.color }}
                  onClick={(event) => {
                    event.stopPropagation();
                    openUserCard(user);
                  }}
                  aria-label={`View ${user.name}'s profile`}
                >
                  {user.avatar ? (
                    <img className="user-avatar user-photo" src={user.avatar} alt="" />
                  ) : (
                    <span className="user-avatar">
                      {user.you ? user.name.charAt(0).toUpperCase() : user.name.charAt(0)}
                    </span>
                  )}
                  <span className="user-name">{user.name}</span>
                  {user.you && <span className="you-indicator">YOU</span>}
                </button>
              ))}
              <div className="map-hint">Click an empty spot to move · WASD or arrow keys</div>

              {selectedUser && (
                <section className="colleague-card" onClick={(event) => event.stopPropagation()}>
                  <button className="colleague-close" onClick={() => setSelectedUser(null)} aria-label="Close profile">×</button>
                  <div className="colleague-avatar" style={{ "--avatar": selectedUser.color }}>
                    {selectedUser.avatar ? <img src={selectedUser.avatar} alt="" /> : selectedUser.name.charAt(0)}
                  </div>
                  <h3>{selectedUser.name}</h3>
                  <p>{selectedUser.role || "Team member"}</p>
                  <span className="colleague-status"><i /> {selectedUser.status || "Available"}</span>
                  <p className="colleague-bio">{selectedUser.bio || "Part of the ProxiSpeak workspace."}</p>
                </section>
              )}
            </section>

            <section className="bottom-grid">
              <div className="content-card">
                <div className="card-heading">
                  <div><h3>Nearby people</h3><p>People around your avatar</p></div>
                  <span className="online-count">{nearbyUsers.length} nearby</span>
                </div>
                {nearbyUsers.length ? nearbyUsers.map((user) => (
                  <button className="person-row person-row-button" key={user.id} onClick={() => openUserCard(user)}>
                    <div className="small-avatar" style={{ "--avatar": user.color }}>
                      {user.name.charAt(0)}
                    </div>
                    <div className="person-details">
                      <strong>{user.name}</strong>
                      <span><i /> {user.status || "In the office"}</span>
                    </div>
                    <span className="distance-label">
                      {Math.round(Math.hypot(user.x - currentUser.x, user.y - currentUser.y))} units
                    </span>
                  </button>
                )) : <p className="empty-state">No one nearby. Move around to explore!</p>}
              </div>

              <div className="content-card audio-card">
                <div className="audio-icon">♫</div>
                <h3>Your audio</h3>
                <p>{muted ? "Your microphone is muted." : "Microphone active · Audio is not connected to other users yet."}</p>
                <button className={`mic-button ${muted ? "muted" : ""}`} onClick={handleMicToggle}>
                  {muted ? "♩ Unmute microphone" : "⊘ Mute microphone"}
                </button>
                {micError && <p role="alert" className="mic-error">{micError}</p>}
                <span className="audio-note">Proximity voice chat needs backend/WebRTC integration.</span>
              </div>
            </section>
          </>
        )}

        {activeTab === "People" && (
          <section className="content-card page-card">
            <h2>People in your workspace</h2>
            <p className="page-description">Select a person to view their colleague profile card.</p>
            {allUsers.map((user) => (
              <button className="person-row person-row-button" key={user.id} onClick={() => openUserCard(user)}>
                <div className="small-avatar" style={{ "--avatar": user.color }}>{user.name.charAt(0)}</div>
                <div className="person-details">
                  <strong>{user.name}{user.you ? " (you)" : ""}</strong>
                  <span><i /> {user.status || "In the office"}</span>
                </div>
              </button>
            ))}
          </section>
        )}

        {activeTab === "Profile" && (
          <section className="content-card page-card profile-editor">
            <div className="profile-editor-heading">
              <div>
                <h2>My profile</h2>
                <p className="page-description">Manage how your teammates see you.</p>
              </div>
              {!editingProfile && <button className="profile-edit-button" onClick={() => setEditingProfile(true)}>Edit profile</button>}
            </div>

            <form onSubmit={saveProfile}>
              <div className="profile-upload">
                {profileForm.avatar ? (
                  <img className="large-profile-photo" src={profileForm.avatar} alt="Your profile" />
                ) : (
                  <div className="large-profile-avatar">{(profileForm.name || "Y").charAt(0).toUpperCase()}</div>
                )}
                {editingProfile && (
                  <label className="upload-label">
                    Change picture
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                )}
              </div>

              <label className="profile-field">Display name
                <input disabled={!editingProfile} required value={profileForm.name} onChange={(event) => updateProfileField("name", event.target.value)} />
              </label>
              <label className="profile-field">Email address
                <input disabled value={profileForm.email} type="email" />
              </label>
              <label className="profile-field">Job title / role
                <input disabled={!editingProfile} value={profileForm.role} onChange={(event) => updateProfileField("role", event.target.value)} />
              </label>
              <label className="profile-field">Availability
                <select disabled={!editingProfile} value={profileForm.status} onChange={(event) => updateProfileField("status", event.target.value)}>
                  <option>Available</option>
                  <option>Busy</option>
                  <option>Away</option>
                </select>
              </label>
              <label className="profile-field">About me
                <textarea disabled={!editingProfile} rows="3" maxLength="180" placeholder="A little about you..." value={profileForm.bio} onChange={(event) => updateProfileField("bio", event.target.value)} />
              </label>

              {editingProfile && (
                <div className="profile-form-actions">
                  <button type="button" className="profile-cancel-button" onClick={() => {
                    setProfileForm({ ...DEFAULT_PROFILE, ...account });
                    setEditingProfile(false);
                  }}>Cancel</button>
                  <button type="submit" className="auth-primary">Save changes</button>
                </div>
              )}
            </form>
            {notice && <p role="status" className="profile-notice">{notice}</p>}
            <p className="prototype-note">Your profile is saved locally in this browser. It is not yet shared with other real users.</p>
          </section>
        )}

        {activeTab === "Settings" && (
          <section className="content-card page-card">
            <h2>Workspace settings</h2>
            <p className="page-description">Manage your local prototype session.</p>
            <div className="settings-row">
              <div><strong>Microphone control</strong><p>Toggle microphone access for this browser.</p></div>
              <button className={`mic-button ${muted ? "muted" : ""}`} onClick={handleMicToggle}>{muted ? "Muted" : "Unmuted"}</button>
            </div>
            <div className="settings-row">
              <div><strong>Your profile</strong><p>Edit your name, role, picture and status.</p></div>
              <button className="profile-edit-button" onClick={() => setActiveTab("Profile")}>Open profile</button>
            </div>
            <p className="audio-note">Real authentication and shared workspace data will require a backend.</p>
          </section>
        )}
      </section>
    </main>
  );
}
