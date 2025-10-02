import { ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface RoleGuardProps {
  allow?: string[];
  deny?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

const RoleGuard = ({ allow, deny, fallback = null, children }: RoleGuardProps) => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const userRoles = user.roles ?? [];
  const isDenied = deny?.some((role) => userRoles.includes(role));
  if (isDenied) {
    return <>{fallback}</>;
  }

  const isAllowed = !allow || allow.some((role) => userRoles.includes(role));
  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RoleGuard;
