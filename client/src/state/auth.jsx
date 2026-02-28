import React, { createContext, useContext, useMemo, useState } from "react";
import { api } from "../lib/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));

  async function login(email, password) {
    const d = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(d.token);
    setUser(d.user);
    localStorage.setItem("token", d.token);
    localStorage.setItem("user", JSON.stringify(d.user));
  }

  async function register(name, email, password) {
    const d = await api("/auth/register", { method: "POST", body: { name, email, password } });
    setToken(d.token);
    setUser(d.user);
    localStorage.setItem("token", d.token);
    localStorage.setItem("user", JSON.stringify(d.user));
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  const value = useMemo(() => ({ token, user, login, register, logout }), [token, user]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
