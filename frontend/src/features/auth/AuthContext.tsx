import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  mfa_enabled: boolean;
  roles: string[];
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, otp?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get<User>("/users/me/");
      setUser(me);
    } catch (error) {
      setUser(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    refreshUser().catch(() => undefined).finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string, otp?: string) => {
    setLoading(true);
    try {
      const payload: Record<string, string> = { email, password };
      if (otp) {
        payload.otp = otp;
      }
      const data = await api.post<User>("/auth/login/", payload);
      setUser(data);
      navigate("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error("Unexpected login error");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout/");
    setUser(null);
    navigate("/login");
  }, [navigate]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
