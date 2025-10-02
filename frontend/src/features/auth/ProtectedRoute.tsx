import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    const target = location.pathname.startsWith("/client") ? "/login-client" : "/login";
    return <Navigate to={target} replace />;
  }

  const roles = user.roles ?? [];
  if (roles.includes("Client") && !location.pathname.startsWith("/client")) {
    return <Navigate to="/client/matters" replace />;
  }

  return <Outlet />;
};
