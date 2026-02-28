import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuth } from "./state/auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Room from "./pages/Room";

function Private({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { token, logout } = useAuth();

  return (
    <div className="wrap">
      <header className="top">
        <Link className="brand" to="/">RTC App</Link>
        {token ? <button onClick={logout}>Logout</button> : null}
      </header>

      <Routes>
        <Route path="/" element={<Private><Room /></Private>} />
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
