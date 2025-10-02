import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

interface RoleProtectedRouteProps {
  allow: string[];
  fallbackPath?: string;
}

const RoleProtectedRoute = ({ allow, fallbackPath = "/dashboard" }: RoleProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-500">Checking access…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const hasAccess = allow.some((role) => user.roles.includes(role));

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
};

export default RoleProtectedRoute;
