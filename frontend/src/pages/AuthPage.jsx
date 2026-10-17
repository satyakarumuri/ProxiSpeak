
import React, { useState } from "react";
import { registerUser, loginUser } from "../services/authService";
import OfficeScene from "../components/OfficeScene";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const result = isLogin
        ? await loginUser(email, password)
        : await registerUser(name, email, password);

      if (isLogin) {
        localStorage.setItem("proxispeak_token", result.token);
        setUser(result.user);
        setMessage("Login successful!");
      } else {
        setMessage("Registration successful! You can now log in.");
        setIsLogin(true);
        setPassword("");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (user) {
  return (
    <main className="office-page">
      <header className="office-header">
        <div>
          <h1>ProxiSpeak</h1>
          <p>Virtual Office · Welcome, {user.name}</p>
        </div>

        <button
          className="logout-button"
          onClick={() => {
            localStorage.removeItem("proxispeak_token");
            setUser(null);
            setPassword("");
            setMessage("");
          }}
        >
          Log out
        </button>
      </header>

      <OfficeScene name={user.name} />
    </main>
  );
}

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>ProxiSpeak</h1>
        <p>Connect with people in your virtual office.</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={isLogin ? "active" : ""}
            onClick={() => {
              setIsLogin(true);
              setMessage("");
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={!isLogin ? "active" : ""}
            onClick={() => {
              setIsLogin(false);
              setMessage("");
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={50}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password (minimum 8 characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={72}
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : isLogin
                ? "Login"
                : "Create account"}
          </button>
        </form>

        {message && <p className="auth-message">{message}</p>}
      </section>
    </main>
  );
}
