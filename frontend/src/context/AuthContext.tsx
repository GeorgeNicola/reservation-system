/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
} from "react";
import api from "../api/axios";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: "patient" | "doctor";
}

export const AuthContext = createContext<AuthContextType | null>(null);

function getInitialAuthState(): AuthState {
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  if (token && userStr) {
    try {
      const user: User = JSON.parse(userStr);
      const fullPayload = JSON.parse(atob(token.split(".")[1]));
      if (fullPayload.exp * 1000 > Date.now()) {
        return { user, token, isAuthenticated: true, loading: false };
      }
    } catch {
      /* invalid stored data */
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
  return { user: null, token: null, isAuthenticated: false, loading: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(getInitialAuthState);

  // Clean up expired tokens on mount (runs once, no setState needed)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp * 1000 <= Date.now()) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { user, token } = res.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setState({ user, token, isAuthenticated: true, loading: false });
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await api.post("/auth/register", data);
    const { user, token } = res.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setState({ user, token, isAuthenticated: true, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
