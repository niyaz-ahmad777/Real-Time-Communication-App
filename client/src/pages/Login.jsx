import React, { useState } from "react";
import { useAuth } from "../state/auth";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  return (
    <div className="container card">
      <h2>Login</h2>
      {err && <p className="err">{err}</p>}
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={async () => {
        try {
          await login(email, password);
          nav("/");
        } catch (e) {
          setErr(e.message);
        }
      }}>Login</button>
      <p><Link to="/register">Register</Link></p>
    </div>
  );
}
