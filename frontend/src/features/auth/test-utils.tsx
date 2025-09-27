import { ReactNode } from "react";
import { AuthContext } from "./AuthContext";

export const MockAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={{ user: null, loading: false, login: async () => {}, logout: async () => {} }}>
    {children}
  </AuthContext.Provider>
);
